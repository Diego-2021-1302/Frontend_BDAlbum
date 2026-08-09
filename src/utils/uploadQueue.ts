export interface PendingUploadChunk {
  index: number;
  blob: Blob;
  size: number;
}

export interface PendingUpload {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  tag: string;
  takenAt: string;
  description: string;
  totalChunks: number;
  completedChunks: number[];
  uploadedBytes: number;
  status: 'pending' | 'running' | 'failed' | 'done';
  createdAt: number;
  lastError?: string;
  chunks: PendingUploadChunk[];
  uploadUrl: string;
  authToken?: string;
  uuid?: string;
}

const DB_NAME = 'album-bd-upload-db';
const STORE_NAME = 'uploads';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePendingUpload(upload: PendingUpload): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(upload);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function updatePendingUpload(upload: PendingUpload): Promise<void> {
  await savePendingUpload(upload);
}

export async function getPendingUploads(): Promise<PendingUpload[]> {
  const db = await openDb();
  const result = await new Promise<PendingUpload[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as PendingUpload[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

export async function getPendingUpload(id: string): Promise<PendingUpload | null> {
  const db = await openDb();
  const result = await new Promise<PendingUpload | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as PendingUpload | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

export async function deletePendingUpload(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function clearPendingUploads(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
