import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../api/api';
import { useAuthStore } from '../store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { MediaItem } from '../types';

dayjs.locale('es');

interface GroupedMonth {
  name: string;
  days: Record<string, MediaItem[]>;
  total: number;
}

// ── Tarjeta de Medio (Optimizado para Safari/iOS) ────────────────
const MediaCard = React.memo(({ item, onAction, onClick }: { 
  item: MediaItem; 
  onAction: (item: MediaItem, e: any) => void;
  onClick: (item: MediaItem) => void;
}) => {
  const isVideo = item.type === 'video';
  
  const displaySrc = useMemo(() => {
    if (isVideo) {
      const thumbPath = item.thumbnail_url ?? item.thumbnail_path;
      return thumbPath ? apiService.buildFileUrl(thumbPath) : null;
    }
    return apiService.buildFileUrl(item.file_url ?? item.file_path);
  }, [item, isVideo]);

  const handleActionStart = (e: any) => onAction(item, e);

  return (
    <div 
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={handleActionStart}
      onTouchStart={handleActionStart}
      onClick={() => onClick(item)}
      className="aspect-[4/5] overflow-hidden rounded-2xl border border-white/5 bg-white/5 relative cursor-pointer group shadow-lg active:scale-[0.98] transition-all"
    >
      <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
        {displaySrc ? (
          <img
            src={displaySrc}
            alt=""
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.opacity = '0';
            }}
          />
        ) : (
          <div className="w-full h-full bg-slate-900/50 flex items-center justify-center">
            {isVideo ? (
              <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                <svg className="w-7 h-7 text-white/10" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-3xl bg-white/5 flex items-center justify-center border border-white/5">
                <svg className="w-7 h-7 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 15a1 1 0 011-1h14a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm0-6a1 1 0 011-1h4l2 2h8a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4z" /></svg>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[9px] font-bold text-white border border-white/10 uppercase tracking-wider">
        {item.tag}
      </div>

      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
             <svg className="w-5 h-5 text-white/80 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </div>
  );
});

const Gallery: React.FC = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  
  const queryYear = Number(searchParams.get('year')) || 0;
  const returnYear = Number(location.state?.returnYear) || 0;
  const initialYear = queryYear || returnYear || new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedTag, setSelectedTag] = useState('');
  const [search, setSearch] = useState('');
  
  const [actionItem, setActionItem] = useState<MediaItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [editForm, setEditForm] = useState<MediaItem | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);

  const { data: items = [], isLoading } = useQuery<MediaItem[]>({
    queryKey: ['media'],
    queryFn: () => apiService.fetchMedia(),
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => 
      query.state.data?.some(i => i.type === 'video' && i.hls_status !== 'ready' && i.hls_status !== 'failed') ? 3000 : false,
  });

  const availableYears = useMemo(() => 
    Array.from(new Set(items.map(item => dayjs(item.taken_at).year()))).sort((a, b) => b - a),
  [items]);

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  useEffect(() => {
    setSearchParams({ year: selectedYear.toString() });
  }, [selectedYear, setSearchParams]);

  const filteredItems = useMemo(() => {
    const s = search.toLowerCase();
    return items.filter(item => {
      const date = dayjs(item.taken_at);
      return date.year() === selectedYear &&
             (!selectedTag || item.tag === selectedTag) &&
             (!search || item.description?.toLowerCase().includes(s));
    }).sort((a, b) => dayjs(b.taken_at).diff(dayjs(a.taken_at)));
  }, [items, selectedYear, selectedTag, search]);

  const groupedItems = useMemo(() => {
    const months: Record<string, GroupedMonth> = {};
    filteredItems.forEach(item => {
      const dObj = dayjs(item.taken_at);
      const mName = dObj.format('MMMM');
      const dKey = dObj.format('DD/MM/YYYY');
      if (!months[mName]) months[mName] = { name: mName, days: {}, total: 0 };
      if (!months[mName].days[dKey]) months[mName].days[dKey] = [];
      months[mName].days[dKey].push(item);
      months[mName].total++;
    });
    return Object.values(months);
  }, [filteredItems]);

  // ── Restauración de Scroll (Optimizado para Safari/iOS) ───────
  useEffect(() => {
    if (!isLoading && groupedItems.length > 0) {
      const savedScroll = sessionStorage.getItem('gallery_scroll_pos');
      if (savedScroll) {
        requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(savedScroll));
          setTimeout(() => sessionStorage.removeItem('gallery_scroll_pos'), 500);
        });
      }
    }
  }, [isLoading, groupedItems]);

  const handleMediaClick = useCallback((item: MediaItem) => {
    sessionStorage.setItem('gallery_scroll_pos', window.scrollY.toString());
    navigate(`/reels?id=${item.id}&year=${selectedYear}`, { 
      state: { items: filteredItems, returnYear: selectedYear } 
    });
  }, [navigate, selectedYear, filteredItems]);

  const handleActionStart = useCallback((item: MediaItem, e: any) => {
    const coords = e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    touchStartPos.current = coords;
    longPressTimer.current = setTimeout(() => {
      setActionItem(item);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, 600);
  }, []);

  const handleActionEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    touchStartPos.current = null;
  }, []);

  const handleExecuteDelete = async () => {
    if (!actionItem?.id) return;
    setLoadingAction(true);
    try {
      await apiService.deleteMedia(actionItem.id);
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setActionItem(null);
      setIsConfirmingDelete(false);
    } catch (e) {
      alert('Error al eliminar');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleUpdate = async () => {
    if (!editForm?.id) return;
    try {
      await apiService.updateMedia(editForm.id, editForm);
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setIsEditing(false);
      setActionItem(null);
    } catch (e) {
      alert('Error al actualizar');
    }
  };

  return (
    <div 
      className="min-h-[100dvh] bg-[#050712] pb-24" 
      onMouseUp={handleActionEnd} onTouchEnd={handleActionEnd}>
      
      <header className="sticky top-0 z-40 bg-[#050712]/80 backdrop-blur-xl px-6 py-4 flex justify-between items-center border-b border-white/5">
        <div className="w-10">
          {/* Panel de administrador - Verificación robusta */}
          {user?.username?.trim().toUpperCase() === 'UNICOMICOPTERO' && (
            <Link to="/admin" className="p-2 text-white/40 hover:text-[#7C1039] transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </Link>
          )}
        </div>
        <h1 className="font-title text-2xl tracking-tight text-white">Breese <span className="text-[#7C1039] mx-1">y</span> Diego</h1>
        <div className="w-10" />
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#1e0a14] via-[#0a0c1a] to-[#050712] p-8 rounded-[40px] border border-white/5 mb-10 shadow-2xl">
          <div className="relative z-10 text-center">
            <h2 className="font-title text-3xl sm:text-5xl mb-3 text-white tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">Nuestros Momentos</h2>
            <p className="text-white/30 text-xs mb-8 font-bold uppercase tracking-[0.3em]">CHERRY - GHOST</p>
            
            <div className="flex justify-center items-center gap-8 mb-10">
              <img src="/assets/images/cereza.png" className="h-14 drop-shadow-[0_0_15px_rgba(124,16,57,0.4)]" alt="Cherry" />
              <div className="h-10 w-[1px] bg-white/10" />
              <img src="/assets/images/ghost.png" className="h-14 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]" alt="Ghost" />
            </div>

            <div className="inline-flex flex-col items-center px-8 py-4 bg-white/5 backdrop-blur-md rounded-3xl border border-white/5 mb-10 min-w-[200px]">
              <p className="text-4xl font-black text-white mb-1">{filteredItems.length}</p>
              <p className="text-[9px] text-[#7C1039] font-black uppercase tracking-[0.2em]">Recuerdos en {selectedYear}</p>
            </div>

            <div className="space-y-4 max-w-sm mx-auto">
              <div className="relative group">
                <input 
                  type="text" placeholder="Buscar un recuerdo especial..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-3.5 px-12 text-sm text-white outline-none focus:bg-white/10 focus:border-[#7C1039]/50 transition-all placeholder:text-white/20"
                />
                <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#7C1039] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))} 
                    className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-xs text-white outline-none appearance-none cursor-pointer focus:border-[#7C1039]/50"
                  >
                    {availableYears.map(y => <option key={y} value={y} className="bg-[#050712]">{y}</option>)}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
                <div className="relative">
                  <select 
                    value={selectedTag} 
                    onChange={(e) => setSelectedTag(e.target.value)} 
                    className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-xs text-white outline-none appearance-none cursor-pointer focus:border-[#7C1039]/50"
                  >
                    <option value="">Todos</option>
                    <option value="B">B - Breese</option>
                    <option value="D">D - Diego</option>
                    <option value="BD">BD - Ambos</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </div>

              {/* Botón de Logout simplificado integrado debajo de los filtros */}
              <div className="flex justify-center pt-4">
                <button 
                  onClick={() => logout()} 
                  className="text-white/20 hover:text-white/50 transition-colors text-[10px] font-black uppercase tracking-[0.2em] py-2 px-4"
                >
                  cerrar sesión
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-14">
          {isLoading ? (
            <div className="grid grid-cols-3 gap-3 animate-pulse">
              {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-[4/5] bg-white/5 rounded-2xl" />)}
            </div>
          ) : (
            groupedItems.map(month => (
              <div key={month.name}>
                <div className="sticky top-16 z-20 bg-[#050712]/80 backdrop-blur-md py-4 flex items-baseline gap-3">
                  <h3 className="text-3xl font-black capitalize text-white">{month.name}</h3>
                  <span className="text-white/10 font-bold text-lg">{selectedYear}</span>
                </div>
                <div className="space-y-10">
                  {Object.entries(month.days).map(([date, dayItems]) => (
                    <div key={date}>
                      <p className="text-[10px] font-black text-[#7C1039] uppercase tracking-[0.2em] mb-4 px-1 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-[#7C1039]" />
                        {date}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {dayItems.map(item => (
                          <MediaCard 
                            key={item.id} 
                            item={item} 
                            onAction={handleActionStart} 
                            onClick={handleMediaClick}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Botón flotante para Subir recuerdos (Navegación directa a página) */}
      <Link 
        to="/upload" 
        className="fixed bottom-10 right-8 z-50 w-16 h-16 bg-[#2a0a14] rounded-full flex items-center justify-center shadow-2xl shadow-[#7C1039]/40 hover:scale-110 active:scale-90 transition-all border border-white/10 group"
      >
        <img src="/assets/images/cereza.png" className="w-8 h-8 drop-shadow-lg group-hover:rotate-12 transition-transform" alt="Upload" />
      </Link>

      {/* Modales de Menú y Acción */}
      <AnimatePresence>
        {actionItem && !isEditing && !isConfirmingDelete && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActionItem(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="relative w-full max-w-sm bg-[#0a0c1a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-white/5 flex items-center gap-4">
                <div className="w-16 h-20 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
                   <img src={apiService.buildFileUrl(actionItem.thumbnail_url ?? actionItem.thumbnail_path ?? actionItem.file_url)} className="w-full h-full object-cover" alt="Preview" />
                </div>
                <div><p className="text-white font-bold text-lg line-clamp-1">{actionItem.description || 'Recuerdo'}</p><p className="text-white/40 text-xs">{dayjs(actionItem.taken_at).format('DD MMMM YYYY')}</p></div>
              </div>
              <div className="p-2 space-y-1">
                <button onClick={() => { setIsEditing(true); setEditForm({...actionItem}); }} className="flex items-center gap-4 w-full p-4 text-blue-400 hover:bg-white/5 rounded-2xl transition-all">
                  <span className="font-bold">Editar Recuerdo</span>
                </button>
                <button onClick={() => setIsConfirmingDelete(true)} className="flex items-center gap-4 w-full p-4 text-red-500 hover:bg-red-500/5 rounded-2xl transition-all">
                  <span className="font-bold">Eliminar para siempre</span>
                </button>
                <button onClick={() => setActionItem(null)} className="w-full p-4 text-white/20 text-[10px] font-black uppercase tracking-[0.2em]">Cerrar</button>
              </div>
            </motion.div>
          </div>
        )}

        {isConfirmingDelete && actionItem && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsConfirmingDelete(false)} className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm bg-[#1a050d] border border-red-900/20 rounded-[40px] p-8 text-center shadow-2xl">
              <h3 className="text-2xl font-bold text-white mb-2">¿Borrar recuerdo?</h3>
              <p className="text-white/40 mb-8 text-sm">Esta acción no se puede deshacer.</p>
              <div className="flex gap-3">
                <button onClick={() => setIsConfirmingDelete(false)} className="flex-1 py-4 rounded-2xl bg-white/5 text-white font-bold">No</button>
                <button disabled={loadingAction} onClick={handleExecuteDelete} className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-bold flex items-center justify-center">
                  {loadingAction ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : 'Sí, borrar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isEditing && editForm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditing(false)} className="absolute inset-0 bg-black/95 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-[#0a0c1a] border border-white/10 rounded-[40px] p-8 shadow-2xl">
              <h3 className="text-2xl font-bold text-white mb-6">Editar Recuerdo</h3>
              <div className="space-y-6">
                <input type="date" value={dayjs(editForm.taken_at).format('YYYY-MM-DD')} onChange={(e) => setEditForm({ ...editForm, taken_at: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-[#7C1039]" />
                <select value={editForm.tag} onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none">
                  <option value="B">Breese</option><option value="D">Diego</option><option value="BD">Ambos</option>
                </select>
                <textarea rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none resize-none" />
                <div className="flex gap-3 pt-4">
                  <button onClick={() => setIsEditing(false)} className="flex-1 py-4 rounded-2xl bg-white/5 text-white font-bold">Cancelar</button>
                  <button onClick={handleUpdate} className="flex-1 py-4 rounded-2xl bg-[#7C1039] text-white font-bold">Guardar</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Gallery;