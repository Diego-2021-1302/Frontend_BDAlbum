import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api/api';
import { extractExifDate } from '../utils/exifExtractor';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';

const Upload: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [tag, setTag] = useState('B');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [warning, setWarning] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

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

  React.useEffect(() => {
    return () => cleanupPreviews();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files.length) {
      setError('Por favor, selecciona al menos un recuerdo');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    let uploadedBytes = 0;

    try {
      for (const fileItem of files) {
        const formData = new FormData();
        formData.append('file', fileItem);
        formData.append('taken_at', dayjs(date).format('YYYY-MM-DD'));
        formData.append('tag', tag);
        formData.append('description', description);

        await apiService.uploadMedia(formData, (progressEvent) => {
          if (progressEvent.total) {
            const fileProgress = (progressEvent.loaded / progressEvent.total) * fileItem.size;
            const percent = Math.round(((uploadedBytes + fileProgress) * 100) / totalSize);
            setUploadProgress(Math.min(percent, 100));
          }
        });

        uploadedBytes += fileItem.size;
      }

      queryClient.invalidateQueries({ queryKey: ['media'] });
      navigate('/');
    } catch (err: any) {
      setError('Error al subir: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploading(false);
      setUploadProgress(0);
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
        <h1 className="text-lg font-bold tracking-tight">Nuevo Recuerdo</h1>
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
            className={`aspect-[4/5] bg-[#0B1120] rounded-2xl border-2 border-dashed transition-all duration-500 flex flex-col items-center justify-center overflow-hidden relative group cursor-pointer ${previews.length ? 'border-transparent ring-1 ring-white/10 shadow-2xl shadow-black/50' : 'border-white/20 hover:border-white/30 hover:bg-white/5'}`}
            onClick={() => document.getElementById('fileInput')?.click()}
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
                <p className="text-white font-bold mb-1">Cargar recuerdos</p>
                <p className="text-white/40 text-sm">Toca para seleccionar fotos o videos</p>
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
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0 }}
                className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-400 text-[10px] font-bold text-center uppercase tracking-widest"
              >
                {error}
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
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] uppercase tracking-[0.2em] font-bold text-white/50">
                  <span>Guardando en la nube</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden p-[2px] border border-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    className="bg-gradient-to-r from-[#7C1039] via-[#9a1447] to-[#7C1039] h-full rounded-full shadow-[0_0_10px_rgba(124,16,57,0.5)]"
                  />
                </div>
              </div>
            )}
            
            <button
              type="submit"
              disabled={uploading || !files.length}
              className="w-full bg-[#7C1039] text-white font-bold py-4 rounded-2xl shadow-lg shadow-[#7C1039]/20 hover:bg-[#9a1447] active:scale-95 disabled:opacity-30 disabled:grayscale transition-all uppercase tracking-widest text-sm"
            >
              {uploading ? 'Cargando...' : 'Confirmar Recuerdo'}
            </button>
          </div>
        </motion.form>
      </main>
    </div>
  );
};

export default Upload;
