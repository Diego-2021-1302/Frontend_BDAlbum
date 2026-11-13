const DB_NAME = 'album-bd-upload-db';
const STORE_NAME = 'uploads';
let queueProcessing = null;
let queueCancellationRequested = false;
const activeChunkControllers = new Set();

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function openUploadDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getQueuedUploads() {
  const database = await openUploadDatabase();
  const uploads = await new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return uploads;
}

async function saveQueuedUpload(upload) {
  const database = await openUploadDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(upload);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function deleteQueuedUpload(id) {
  const database = await openUploadDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function notifyClients(upload) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => client.postMessage({ type: 'UPLOAD_QUEUE_UPDATE', upload }));
}

function calculateCompletedBytes(upload) {
  const completed = new Set(upload.completedChunks || []);
  return (upload.chunks || [])
    .filter((chunk) => completed.has(chunk.index))
    .reduce((total, chunk) => total + chunk.size, 0);
}

async function sendChunk(upload, chunk) {
  const url = `${upload.uploadUrl.replace(/\/$/, '')}/api/media/upload-chunk`;
  const formData = new FormData();
  formData.append('chunk', chunk.blob, upload.fileName);
  formData.append('uuid', upload.uuid);
  formData.append('index', String(chunk.index));
  formData.append('total', String(upload.totalChunks));
  formData.append('filename', upload.fileName);
  formData.append('tag', upload.tag);
  formData.append('taken_at', upload.takenAt);
  if (upload.description) formData.append('description', upload.description);

  let lastError;
  const controller = new AbortController();
  activeChunkControllers.add(controller);
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: upload.authToken ? { Authorization: `Bearer ${upload.authToken}`, Accept: 'application/json' } : { Accept: 'application/json' },
          body: formData,
          signal: controller.signal,
        });
        if (response.ok) return;

        const error = new Error(`Error HTTP ${response.status} al subir el fragmento`);
        if (response.status < 500 && response.status !== 408 && response.status !== 429) throw error;
        lastError = error;
      } catch (error) {
        if (queueCancellationRequested || controller.signal.aborted) throw error;
        if (error instanceof Error && error.message.startsWith('Error HTTP ') && !/HTTP (408|429|5\d\d)/.test(error.message)) {
          throw error;
        }
        lastError = error;
      }

      if (attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(15000, 1000 * (attempt + 1) * 2)));
      }
    }
    throw lastError || new Error('No se pudo subir el fragmento');
  } finally {
    activeChunkControllers.delete(controller);
  }
}

async function processUpload(upload) {
  if (queueCancellationRequested) return;
  const completed = new Set(upload.completedChunks || []);
  const chunks = (upload.chunks || []).filter((chunk) => !completed.has(chunk.index));
  const updatedUpload = { ...upload, status: 'running', lastError: undefined };
  await saveQueuedUpload(updatedUpload);
  await notifyClients(updatedUpload);

  try {
    for (const chunk of chunks) {
      if (queueCancellationRequested) return;
      await sendChunk(updatedUpload, chunk);
      if (queueCancellationRequested) return;
      completed.add(chunk.index);
      updatedUpload.completedChunks = Array.from(completed);
      updatedUpload.uploadedBytes = calculateCompletedBytes(updatedUpload);
      await saveQueuedUpload(updatedUpload);
      await notifyClients(updatedUpload);
    }

    updatedUpload.status = 'done';
    updatedUpload.uploadedBytes = updatedUpload.fileSize;
    await saveQueuedUpload(updatedUpload);
    await notifyClients(updatedUpload);
    await deleteQueuedUpload(updatedUpload.id);
  } catch (error) {
    if (queueCancellationRequested) return;
    updatedUpload.status = 'failed';
    updatedUpload.uploadedBytes = calculateCompletedBytes(updatedUpload);
    updatedUpload.lastError = error instanceof Error ? error.message : 'Error al subir el recuerdo';
    await saveQueuedUpload(updatedUpload);
    await notifyClients(updatedUpload);
    throw error;
  }
}

function processUploadQueue() {
  if (queueProcessing) {
    return queueCancellationRequested
      ? queueProcessing.then(() => processUploadQueue())
      : queueProcessing;
  }

  queueCancellationRequested = false;
  queueProcessing = getQueuedUploads()
    .then(async (uploads) => {
      let processingError;
      for (const upload of uploads) {
        if (queueCancellationRequested) break;
        try {
          if (upload.status === 'done') {
            await deleteQueuedUpload(upload.id);
            continue;
          }
          await processUpload(upload);
        } catch (error) {
          processingError ||= error;
        }
      }
      if (processingError) throw processingError;
    })
    .finally(() => {
      queueProcessing = null;
    });
  return queueProcessing;
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'PROCESS_UPLOADS') {
    event.waitUntil(processUploadQueue());
  } else if (event.data?.type === 'CANCEL_UPLOADS') {
    queueCancellationRequested = true;
    activeChunkControllers.forEach((controller) => controller.abort());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'upload-sync') {
    event.waitUntil(processUploadQueue());
  }
});
