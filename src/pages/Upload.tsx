import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { extractExifDate } from '../utils/exifExtractor';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import { clearPendingUploads, deletePendingUpload, getPendingUploads, savePendingUpload, updatePendingUpload, PendingUpload } from '../utils/uploadQueue';

const Upload: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditMode = Boolean(editId);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState('B');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [warning, setWarning] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadingItem, setLoadingItem] = useState(false);
  const [backgroundUploadActive, setBackgroundUploadActive] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadMessageTone, setUploadMessageTone] = useState<'success' | 'error'>('success');
  const [queuedUploads, setQueuedUploads] = useState<PendingUpload[]>([]);
  const abortControllersRef = React.useRef<Record<string, AbortController>>({});
  const queueProcessingRef = React.useRef(false);
  const uploadChunkProgressRef = React.useRef<Record<string, number>>({});

  const UPLOAD_PROGRESS_METADATA_KEY = 'album_bd_upload_progress';

  type StoredUploadProgress = {
    uploadedBytes: number;
    currentChunkIndex?: number;
    currentChunkBytes?: number;
  };

  const loadStoredUploadProgress = (uploadId: string): StoredUploadProgress | undefined => {
    try {
      const stored = localStorage.getItem(UPLOAD_PROGRESS_METADATA_KEY);
      if (!stored) return undefined;
      const parsed = JSON.parse(stored) as Record<string, StoredUploadProgress>;
      return parsed[uploadId];
    } catch {
      return undefined;
    }
  };

  const saveStoredUploadProgress = (uploadId: string, progress: StoredUploadProgress) => {
    try {
      const stored = localStorage.getItem(UPLOAD_PROGRESS_METADATA_KEY);
      const parsed = stored ? JSON.parse(stored) as Record<string, StoredUploadProgress> : {};
      parsed[uploadId] = { ...parsed[uploadId], ...progress };
      localStorage.setItem(UPLOAD_PROGRESS_METADATA_KEY, JSON.stringify(parsed));
    } catch {
      // No-op
    }
  };

  const removeStoredUploadProgress = (uploadId: string) => {
    try {
      const stored = localStorage.getItem(UPLOAD_PROGRESS_METADATA_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Record<string, StoredUploadProgress>;
      delete parsed[uploadId];
      localStorage.setItem(UPLOAD_PROGRESS_METADATA_KEY, JSON.stringify(parsed));
    } catch {
      // No-op
    }
  };

  const clearAllStoredUploadProgress = () => {
    try {
      localStorage.removeItem(UPLOAD_PROGRESS_METADATA_KEY);
    } catch {
      // No-op
    }
  };

  const hydrateStoredProgress = (upload: PendingUpload) => {
    const stored = loadStoredUploadProgress(upload.id);
    const hydrated = stored && stored.uploadedBytes > upload.uploadedBytes
      ? {
          ...upload,
          uploadedBytes: Math.min(upload.fileSize, stored.uploadedBytes),
        }
      : upload;

    if (hydrated.status === 'pending' && hydrated.uploadedBytes > 0) {
      return { ...hydrated, status: 'running' };
    }

    return hydrated;
  };

  const isVideo = files[0]?.type.startsWith('video/');

  const cleanupPreviews = () => {
    previews.forEach((url) => URL.revokeObjectURL(url));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    cleanupPreviews();

    const previewUrls = selectedFiles.map((file) => URL.createObjectURL(file));
    setFiles(selectedFiles);
    setPreviews(previewUrls);
    setError(null);
    setWarning(null);

    const dates = await Promise.all(selectedFiles.map(async (file) => {
      if (file.type.startsWith('image/')) {
        const exifDate = await extractExifDate(file);
        return exifDate ?? dayjs(file.lastModified).format('YYYY-MM-DD');
      }
      return dayjs(file.lastModified).format('YYYY-MM-DD');
    }));

    const uniqueDates = Array.from(new Set(dates));
    if (uniqueDates.length === 1) {
      setDate(uniqueDates[0]);
    } else {
      setWarning('Algunas fotos tienen fechas diferentes. Se usará la fecha de la primera foto.');
      setDate(dates[0]);
    }
  };

  useEffect(() => {
    if (!isEditMode || !editId) {
      setDescription('');
      setTag('B');
      setDate(dayjs().format('YYYY-MM-DD'));
      setPreviews([]);
      return;
    }

    let active = true;
    setLoadingItem(true);
    setError(null);

    apiService.fetchMediaById(Number(editId))
      .then((item) => {
        if (!active) return;
        setDescription(item.description || '');
        setTag(item.tag || 'B');
        setDate(dayjs(item.taken_at).format('YYYY-MM-DD'));

        const previewUrl = apiService.buildFileUrl(
          item.thumbnail_url ?? item.thumbnail_path ?? item.file_url,
          item.type === 'video' ? 'video' : 'image'
        );

        if (previewUrl) {
          cleanupPreviews();
          setPreviews([previewUrl]);
        } else {
          setPreviews([]);
        }
      })
      .catch(() => {
        if (active) {
          setError('No se pudo cargar el recuerdo para editar.');
        }
      })
      .finally(() => {
        if (active) setLoadingItem(false);
      });

    return () => {
      active = false;
    };
  }, [editId, isEditMode]);

  useEffect(() => {
    const restorePendingUploads = async () => {
      try {
        const pendingUploads = await getPendingUploads();
        const hydratedUploads = pendingUploads.map(hydrateStoredProgress);
        setQueuedUploads(hydratedUploads);
        if (hydratedUploads.length) {
          await processPendingUploads();
        }
      } catch (error) {
        console.error('No se pudieron restaurar las subidas pendientes:', error);
      }
    };

    void restorePendingUploads();
    const interval = window.setInterval(() => {
      void getPendingUploads().then((pendingUploads) => {
        setQueuedUploads((currentQueued) => {
          const completedOrFailed = currentQueued.filter((item) => item.status === 'done' || item.status === 'failed');
          const pendingOrRunning = pendingUploads.filter((item) => !completedOrFailed.some((completed) => completed.id === item.id));
          return [...completedOrFailed, ...pendingOrRunning];
        });
      });
    }, 1000);

    return () => {
      window.clearInterval(interval);
      cleanupPreviews();
    };
  }, []);

  const getUploadStrategy = (fileSize: number) => {
    const hugeFile = fileSize > 500 * 1024 * 1024;
    const largeFile = fileSize > 250 * 1024 * 1024;
    const chunkSize = hugeFile
      ? 8 * 1024 * 1024
      : largeFile
        ? 16 * 1024 * 1024
        : fileSize > 120 * 1024 * 1024
          ? 24 * 1024 * 1024
          : 32 * 1024 * 1024;

    const concurrency = Math.min(4, Math.max(2, Math.ceil((navigator.hardwareConcurrency || 4) / 2)));

    return {
      chunkSize: Math.min(chunkSize, 32 * 1024 * 1024),
      concurrency,
    };
  };

  const uploadChunkWithRetry = async (
    chunkIndex: number,
    chunk: Blob,
    uuid: string,
    totalChunks: number,
    file: File,
    onProgress: (progressEvent: any) => void,
    attempt = 0
  ) => {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('uuid', uuid);
    formData.append('index', chunkIndex.toString());
    formData.append('total', totalChunks.toString());
    formData.append('filename', file.name);
    formData.append('tag', tag);
    formData.append('taken_at', dayjs(date).format('YYYY-MM-DD'));
    if (description) formData.append('description', description);

    try {
      await apiService.uploadChunk(formData, onProgress);
    } catch (err: any) {
      const isRetryable = !err.response || err.response.status >= 500 || err.response.status === 408 || err.code === 'ECONNABORTED' || err.message?.toLowerCase()?.includes('network error');
      if (attempt < 5 && isRetryable) {
        const delay = Math.min(15000, 1000 * (attempt + 1) * 2 + Math.floor(Math.random() * 1000));
        await new Promise((resolve) => setTimeout(resolve, delay));
        return uploadChunkWithRetry(chunkIndex, chunk, uuid, totalChunks, file, onProgress, attempt + 1);
      }
      throw err;
    }
  };

  const scheduleBackgroundSync = async () => {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('upload-sync');
      } catch (error) {
        console.warn('No se pudo registrar background sync:', error);
      }
    }
  };

  useEffect(() => {
    const totalBytes = queuedUploads.reduce((sum, upload) => sum + upload.fileSize, 0);
    const uploadedBytes = queuedUploads.reduce((sum, upload) => sum + upload.uploadedBytes, 0);
    if (totalBytes > 0) {
      setUploadProgress(Math.min(100, Math.round((uploadedBytes / totalBytes) * 100)));
    } else if (!backgroundUploadActive) {
      setUploadProgress(0);
    }
  }, [queuedUploads, backgroundUploadActive]);

  const enqueueUploadForBackground = async (file: File) => {
    const { chunkSize } = getUploadStrategy(file.size);
    const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));
    const chunks: PendingUpload['chunks'] = [];

    for (let index = 0; index < totalChunks; index++) {
      const start = index * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      chunks.push({ index, blob: file.slice(start, end), size: end - start });
    }

    const { uploadUrl, baseUrl } = useAuthStore.getState();
    const effectiveUploadUrl = uploadUrl || baseUrl;

    const upload: PendingUpload = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      tag,
      takenAt: dayjs(date).format('YYYY-MM-DD'),
      description,
      totalChunks,
      completedChunks: [],
      uploadedBytes: 0,
      status: 'pending',
      createdAt: Date.now(),
      chunks,
      uploadUrl: effectiveUploadUrl,
      authToken: localStorage.getItem('auth_token') || undefined,
      uuid: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };

    await savePendingUpload(upload);
    setQueuedUploads((current) => [...current, upload]);
    return upload;
  };

  const processPendingUploads = async () => {
    if (queueProcessingRef.current) return;
    queueProcessingRef.current = true;

    try {
      const pendingUploads = await getPendingUploads();
      if (!pendingUploads.length) {
        setBackgroundUploadActive(false);
        return;
      }

      setBackgroundUploadActive(true);
      setUploadMessage('Procesando la cola de subidas...');
      setUploadMessageTone('success');

      await Promise.all(
        pendingUploads.map((upload) => resumeBackgroundUpload(upload))
      );
    } finally {
      queueProcessingRef.current = false;
    }
  };

  const cancelAllUploads = async () => {
    Object.values(abortControllersRef.current).forEach((controller) => controller.abort());
    abortControllersRef.current = {};
    await clearPendingUploads();
    clearAllStoredUploadProgress();
    setQueuedUploads([]);
    setUploading(false);
    setBackgroundUploadActive(false);
    setUploadProgress(0);
    setUploadMessage('Subida cancelada. Todo ha sido limpiado.');
    setUploadMessageTone('error');
  };

  const cancelQueuedUpload = async (uploadId: string) => {
    await cancelAllUploads();
  };

  const resumeBackgroundUpload = async (upload: PendingUpload, onProgress?: (uploadedBytesForUpload: number) => void) => {
    const runningUpload: PendingUpload = { ...upload, status: 'running' };
    await updatePendingUpload(runningUpload);
    setQueuedUploads((current) => current.map((item) => item.id === runningUpload.id ? runningUpload : item));

    const { chunkSize, concurrency } = getUploadStrategy(upload.fileSize);
    const totalChunks = Math.max(1, Math.ceil(upload.fileSize / chunkSize));
    const chunkQueue = upload.chunks.slice();
    const completed = new Set(upload.completedChunks);
    const uuid = upload.uuid || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let uploadedBytes = upload.uploadedBytes;
    let currentChunkBytes = 0;

    const controller = new AbortController();
    abortControllersRef.current[upload.id] = controller;

    const progressSaveThreshold = Math.max(256 * 1024, Math.floor(upload.fileSize / 120));
    let lastPersistedBytes = uploadedBytes;
    let lastDisplayedBytes = uploadedBytes;

    const updateProgress = (bytes: number, persist = false) => {
      const currentBytes = Math.min(upload.fileSize, uploadedBytes + bytes);
      const displayedBytes = Math.max(lastDisplayedBytes, currentBytes);
      if (displayedBytes > lastDisplayedBytes) {
        lastDisplayedBytes = displayedBytes;
      }
      if (persist || displayedBytes - lastPersistedBytes >= progressSaveThreshold || displayedBytes === upload.fileSize) {
        lastPersistedBytes = displayedBytes;
        saveStoredUploadProgress(upload.id, { uploadedBytes: displayedBytes });
      }
      if (persist) {
        uploadedBytes = displayedBytes;
      }
      const updatedUpload: PendingUpload = {
        ...upload,
        completedChunks: Array.from(completed),
        uploadedBytes: displayedBytes,
        status: 'running',
        uuid,
      };
      setQueuedUploads((current) => current.map((item) => item.id === updatedUpload.id ? updatedUpload : item));
      onProgress?.(displayedBytes);
    };

    const worker = async () => {
      while (chunkQueue.length > 0) {
        if (controller.signal.aborted) {
          throw new Error('cancelled');
        }
        const next = chunkQueue.shift();
        if (!next) break;
        if (completed.has(next.index)) continue;

        const formData = new FormData();
        formData.append('chunk', next.blob);
        formData.append('uuid', uuid);
        formData.append('index', next.index.toString());
        formData.append('total', totalChunks.toString());
        formData.append('filename', upload.fileName);
        formData.append('tag', upload.tag);
        formData.append('taken_at', upload.takenAt);
        if (upload.description) formData.append('description', upload.description);

        currentChunkBytes = 0;
        const onChunkProgress = (event: any) => {
          if (!event?.loaded) return;
          const chunkProgress = Math.min(next.size, event.loaded);
          currentChunkBytes = Math.max(currentChunkBytes, chunkProgress);
          updateProgress(currentChunkBytes, false);
        };

    try {
          await apiService.uploadChunk(formData, onChunkProgress, controller.signal);
          completed.add(next.index);
          uploadedBytes += next.size;
          currentChunkBytes = 0;
          updateProgress(0, true);
          const persistedUpload = {
            ...upload,
            completedChunks: Array.from(completed),
            uploadedBytes,
            status: 'running',
            uuid,
          };
          await updatePendingUpload(persistedUpload);
        } catch (err: any) {
          if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED' || err?.message === 'cancelled') {
            return;
          }
          const retryable = !err.response || err.response.status >= 500 || err.response.status === 408 || err.code === 'ECONNABORTED' || err.message?.toLowerCase()?.includes('network error');
          if (retryable) {
            chunkQueue.push(next);
            await new Promise((resolve) => setTimeout(resolve, 1500));
          } else {
            throw err;
          }
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, totalChunks) }, () => worker());
    await Promise.all(workers);

    const finalUpload: PendingUpload = {
      ...upload,
      completedChunks: Array.from(completed),
      uploadedBytes,
      status: completed.size === totalChunks ? 'done' : 'failed',
      lastError: completed.size === totalChunks ? undefined : 'Subida incompleta',
    };

    await updatePendingUpload(finalUpload);
    setQueuedUploads((current) => current.map((item) => item.id === finalUpload.id ? finalUpload : item));
    delete abortControllersRef.current[finalUpload.id];

    if (finalUpload.status === 'done') {
      await deletePendingUpload(finalUpload.id);
      removeStoredUploadProgress(finalUpload.id);
      await queryClient.invalidateQueries({ queryKey: ['media'], refetchType: 'all' });
      setUploadMessage('Carga completada correctamente.');
      setUploadMessageTone('success');
      setUploadProgress(100);
      setBackgroundUploadActive(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditMode && editId) {
      setUploading(true);
      setError(null);
      try {
        await apiService.updateMedia(Number(editId), {
          tag,
          description,
          taken_at: dayjs(date).format('YYYY-MM-DD'),
        });
        await queryClient.invalidateQueries({ queryKey: ['media'], refetchType: 'all' });
        navigate('/');
      } catch (err: any) {
        setError('Error al guardar: ' + (err.response?.data?.message || err.message));
      } finally {
        setUploading(false);
      }
      return;
    }

    if (!files.length) {
      setError('Por favor, selecciona al menos un recuerdo');
      return;
    }

    if (!navigator.onLine) {
      setError('Sin conexión. Por favor vuelve a intentarlo cuando tengas internet.');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadMessage('Recuerdos agregados a la cola. Puedes seguir enviando nuevos recuerdos.');
    setUploadMessageTone('success');

    try {
      await Promise.all(files.map(async (file) => enqueueUploadForBackground(file)));

      setFiles([]);
      cleanupPreviews();
      setPreviews([]);
      setDescription('');
      setTag('B');
      setDate(dayjs().format('YYYY-MM-DD'));
      setWarning(null);
        setBackgroundUploadActive(true);

      void processPendingUploads();
      void scheduleBackgroundSync();
    } catch (err: any) {
      console.error('Error al encolar recuerdos:', err);
      const isSizeError = err?.response?.status === 413;
      setUploadMessageTone('error');
      setUploadMessage(isSizeError ? 'Archivo demasiado grande.' : 'Error al encolar recuerdos. Intenta de nuevo.');
      setError(isSizeError ? 'Archivo demasiado grande.' : 'Error al encolar recuerdos. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050712] text-white flex flex-col relative overflow-hidden font-sans">
      <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-[#7C1039]/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] bg-[#7C1039]/10 rounded-full blur-[100px] pointer-events-none" />

      <header className="sticky top-0 z-40 bg-[#050712]/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between border-b border-white/10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white/70 hover:text-white transition-all active:scale-90">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold tracking-tight">{isEditMode ? 'Editar Recuerdo' : 'Nuevo Recuerdo'}</h1>
        <div className="w-8" />
      </header>

      <main className="flex-1 p-6 max-w-xl mx-auto w-full relative z-10 overflow-y-auto">
        <motion.form 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          onSubmit={handleSubmit} 
          className="space-y-8"
        >
          <div 
            className={`aspect-[4/5] bg-[#0B1120] rounded-2xl border-2 border-dashed transition-all duration-500 flex flex-col items-center justify-center overflow-hidden relative group ${isEditMode ? 'border-white/10 cursor-default' : 'cursor-pointer'} ${previews.length ? 'border-transparent ring-1 ring-white/10 shadow-2xl shadow-black/50' : 'border-white/20 hover:border-white/30 hover:bg-white/5'}`}
            onClick={() => {
              if (!isEditMode) {
                document.getElementById('fileInput')?.click();
              }
            }}
          >
            {previews.length ? (
              previews.length === 1 ? (
                <div className="w-full h-full relative">
                  {isVideo ? (
                    <video src={previews[0]} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                  ) : (
                    <img src={previews[0]} alt="Preview" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-sm">
                    <div className="p-4 bg-white/10 rounded-full border border-white/20 mb-2">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v16h16V4H4zm2 2h12v12H6V6z" />
                      </svg>
                    </div>
                    <p className="text-white text-sm font-bold">Cambiar archivos</p>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full grid grid-cols-2 gap-2 p-2">
                  {previews.slice(0, 4).map((previewUrl, index) => (
                    <div key={index} className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/10">
                      {files[index]?.type.startsWith('video/') ? (
                        <video src={previewUrl} className="w-full h-full object-cover" muted playsInline loop />
                      ) : (
                        <img src={previewUrl} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                      )}
                    </div>
                  ))}
                  {previews.length > 4 && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 text-white text-sm font-bold">
                      +{previews.length - 4} más
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="text-center p-8">
                <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10 group-hover:bg-[#7C1039]/20 transition-all duration-500">
                  <svg className="w-8 h-8 text-white/40 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <p className="text-white font-bold mb-1">{isEditMode ? 'Recuerdo actual' : 'Cargar recuerdos'}</p>
                <p className="text-white/40 text-sm">{isEditMode ? 'Puedes ajustar su información y fecha.' : 'Toca para seleccionar fotos o videos'}</p>
              </div>
            )}
            {isEditMode && (
              <div className="absolute inset-x-4 bottom-4 rounded-full bg-black/60 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/80 text-center">
                Editando recuerdo existente
              </div>
            )}
            <input 
              id="fileInput"
              type="file" 
              accept="image/*,video/*" 
              className="hidden" 
              multiple
              onChange={handleFileChange}
            />
            {previews.length > 1 && (
              <div className="absolute bottom-4 left-4 rounded-full bg-black/60 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-white/80">
                {previews.length} recuerdos seleccionados
              </div>
            )}
          </div>

          <AnimatePresence>
            {(error || uploadMessage) && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0 }}
                className={`border p-4 rounded-2xl text-[10px] font-bold text-center uppercase tracking-widest ${uploadMessageTone === 'success' && !error ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}
              >
                {error || uploadMessage}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-6 bg-white/5 p-8 rounded-[32px] border border-white/10 shadow-xl backdrop-blur-md">
            <div>
              <label className="text-[10px] text-white font-bold mb-4 block uppercase tracking-[0.2em]">Descripción del momento</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-white/5 text-white border border-white/10 rounded-2xl p-4 focus:border-[#7C1039]/50 focus:bg-white/10 transition-all outline-none resize-none placeholder:text-white/20"
                placeholder="Escribe algo sobre este día..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] text-white font-bold block uppercase tracking-[0.2em]">¿Quién aparece?</label>
                <div className="relative">
                  <select 
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    className="w-full bg-white/5 text-white border border-white/10 rounded-2xl p-4 appearance-none focus:border-[#7C1039]/50 focus:bg-white/10 outline-none transition-all cursor-pointer"
                  >
                    <option value="B" className="bg-[#050712]">B - Breese</option>
                    <option value="D" className="bg-[#050712]">D - Diego</option>
                    <option value="BD" className="bg-[#050712]">BD - Ambos</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] text-white font-bold block uppercase tracking-[0.2em]">Fecha capturada</label>
                <input 
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white/5 text-white border border-white/10 rounded-2xl p-4 focus:border-[#7C1039]/50 focus:bg-white/10 outline-none transition-all [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 space-y-4">
            {warning && (
              <div className="text-yellow-300 text-[11px] uppercase tracking-[0.2em] font-bold text-center">
                {warning}
              </div>
            )}
                <button
              type="submit"
              disabled={uploading || (loadingItem && isEditMode) || (!isEditMode && !files.length)}
              className="w-full bg-[#7C1039] text-white font-bold py-4 rounded-2xl shadow-lg shadow-[#7C1039]/20 hover:bg-[#9a1447] active:scale-95 disabled:opacity-30 disabled:grayscale transition-all uppercase tracking-widest text-sm"
            >
              {uploading ? (isEditMode ? 'Guardando...' : 'Agregando a la cola...') : (isEditMode ? 'Guardar cambios' : 'Agregar a la cola')}
            </button>
            {queuedUploads.length > 0 && (
              <div className="mt-8 space-y-4">
                <div className="rounded-[28px] border border-white/10 bg-[#07101f]/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Cola de subidas</p>
                      <h2 className="text-white text-lg font-semibold">Recuerdos en proceso</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/70">{queuedUploads.length} en cola</span>
                      <button
                        type="button"
                        onClick={cancelAllUploads}
                        className="rounded-full border border-red-500/25 bg-red-500/10 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-red-300 hover:bg-red-500/20 transition-all"
                      >
                        Cancelar todo
                      </button>
                    </div>
                  </div>
                  <p className="mb-4 text-[12px] leading-6 text-white/50">El recuerdo ya está en la cola. Puedes seguir agregando más mientras se sube en segundo plano.</p>
                  <div className="space-y-3">
                    {queuedUploads.map((upload) => {
                      const percent = upload.fileSize ? Math.round((upload.uploadedBytes / upload.fileSize) * 100) : 0;
                      const statusLabel = upload.status === 'pending'
                        ? 'Pendiente'
                        : upload.status === 'running'
                          ? 'Subiendo'
                          : upload.status === 'done'
                            ? 'Completado'
                            : 'Error';
                      const badgeColor = upload.status === 'done'
                        ? 'bg-emerald-500/15 text-emerald-200'
                        : upload.status === 'running'
                          ? 'bg-[#7C1039]/15 text-[#f6c3e2]'
                          : 'bg-white/10 text-white/60';
                      return (
                        <div key={upload.id} className="rounded-[28px] border border-white/10 bg-[#0b1423] p-4">
                          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">{upload.fileName}</p>
                              <p className="mt-1 text-[11px] text-white/40">{(upload.uploadedBytes / 1024 / 1024).toFixed(2)} / {(upload.fileSize / 1024 / 1024).toFixed(2)} MB · {upload.tag} · {upload.takenAt}</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${badgeColor}`}>{statusLabel}</span>
                          </div>
                          <div className="mb-3 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-white/50">
                            <span>Progreso</span>
                            <span>{percent}%</span>
                          </div>
                          <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                            <motion.div
                              initial={false}
                              animate={{ width: `${percent}%` }}
                              className="h-full rounded-full bg-gradient-to-r from-[#7C1039] via-[#9a1447] to-[#7C1039] shadow-[0_0_10px_rgba(124,16,57,0.35)]"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.form>
      </main>
    </div>
  );
};

export default Upload;
