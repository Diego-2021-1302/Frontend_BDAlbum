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

// ── SKELETON PROFESIONAL ───────────────────────────────────────
const GallerySkeleton = () => (
  <div className="space-y-16 animate-pulse px-2">
    {[1, 2].map(m => (
      <div key={m} className="space-y-8">
        <div className="h-12 w-40 bg-white/5 rounded-2xl" />
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="aspect-[3/4] bg-white/5 rounded-3xl" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

// ── TARJETA MULTIMEDIA PREMIUM ──────────────────────────────────
const MediaCard = React.memo(({ item, index, onAction, onClick }: {
  item: MediaItem; 
  index: number;
  onAction: (item: MediaItem, e: any) => void;
  onClick: (item: MediaItem) => void;
}) => {
  const isVideo = item.type === 'video';
  const [loaded, setLoaded] = useState(false);
  const [isInView, setIsInView] = useState(index < 4);
  const [retryCount, setRetryCount] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (index < 4) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [index]);

  const displaySrc = useMemo(() => {
    if (!isInView) return null;
    if (isVideo && !item.thumbnail_path) return null;
    const path = item.thumbnail_path ?? item.file_path;
    // Añadimos una marca de tiempo por intento para forzar la recarga si falló por 429
    const cacheBuster = retryCount > 0 ? `?r=${retryCount}` : '';
    return path ? apiService.buildFileUrl(path, isVideo ? 'video' : 'image') + cacheBuster : null;
  }, [item, isVideo, isInView, retryCount]);

  const handleError = () => {
    if (retryCount < 3) {
        setTimeout(() => setRetryCount(prev => prev + 1), 2000);
    }
  };

  return (
    <div
      ref={cardRef}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => onAction(item, e)}
      onTouchStart={(e) => onAction(item, e)}
      onClick={() => onClick(item)}
      data-id={item.id}
      className="group relative aspect-[3/4] overflow-hidden rounded-2xl sm:rounded-[2rem] bg-white/[0.03] border border-white/5 cursor-pointer transform-gpu transition-all duration-500 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)] active:scale-[0.97]"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent animate-pulse" />

      <div className="absolute inset-0 z-0">
        {displaySrc ? (
          <img
            src={displaySrc}
            alt=""
            onLoad={() => setLoaded(true)}
            onError={handleError}
            className={`w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110
              ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
            loading="lazy"
            decoding="async"
          />
        ) : isVideo && !item.thumbnail_path ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-[#7C1039]/5">
             <div className="w-6 h-6 border-2 border-[#7C1039]/30 border-t-[#7C1039] rounded-full animate-spin" />
             <span className="text-[8px] font-black text-[#7C1039] uppercase tracking-widest opacity-40">Procesando</span>
          </div>
        ) : null}
      </div>

      {/* Overlay Gradiente */}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Badge de Tag - Rediseñado */}
      <div className="absolute top-3 left-3 z-20 px-2.5 py-1 bg-black/30 backdrop-blur-xl rounded-full border border-white/10 shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-[-10px] group-hover:translate-y-0">
        <span className="text-[9px] font-black text-white/90 tracking-[0.1em] uppercase">{item.tag}</span>
      </div>

      {/* Indicador de Video Premium */}
      {isVideo && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-2xl transition-transform duration-500 group-hover:scale-110">
             <svg className="w-5 h-5 text-white/90 fill-current translate-x-0.5" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </div>
        </div>
      )}

      {/* Info rápida al hover (Mobile friendly long press) */}
      <div className="absolute bottom-4 left-4 right-4 z-20 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
        <p className="text-[10px] font-medium text-white/60 truncate uppercase tracking-widest">
            {dayjs(item.taken_at).format('DD · MM · YYYY')}
        </p>
      </div>
    </div>
  );
});

// ── SECCIÓN DE DÍA VIRTUALIZADA PRO ───────────────────────────────
const DaySection = React.memo(({ date, items, onAction, onClick }: {
  date: string;
  items: MediaItem[];
  onAction: (item: MediaItem, e: any) => void;
  onClick: (item: MediaItem) => void;
}) => {
  return (
    <div
      className="space-y-6 mb-12"
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: 'auto 400px',
        contain: 'layout style paint'
      } as any}
    >
      <div className="flex items-center gap-4 px-2">
        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        <p className="text-[10px] font-black text-[#7C1039] uppercase tracking-[0.4em] whitespace-nowrap opacity-60">
          {date}
        </p>
        <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-white/5 to-transparent" />
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-3">
        {items.map((item, idx) => (
          <div key={item.id} data-id={item.id}>
            <MediaCard item={item} index={idx} onAction={onAction} onClick={onClick} />
          </div>
        ))}
      </div>
    </div>
  );
});

// ── CONTADOR DE TIEMPO PREMIUM ──────────────────────────────────
const LoveCounter = () => {
  const startDate = dayjs('2026-08-16 22:05');
  const [now, setNow] = useState(dayjs());

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);

  const years = now.diff(startDate, 'year');
  const months = now.diff(startDate, 'month') % 12;

  // Cálculo de días basado en calendario para evitar el desfase de 24h
  const days = now.startOf('day').diff(startDate.startOf('day'), 'day');

  const hours = now.diff(startDate, 'hour') % 24;
  const minutes = now.diff(startDate, 'minute') % 60;
  const seconds = now.diff(startDate, 'second') % 60;

  const stats = [
    { label: 'Años', val: years },
    { label: 'Meses', val: months },
    { label: 'Días', val: days },
    { label: 'Hrs', val: hours },
    { label: 'Min', val: minutes },
    { label: 'Seg', val: seconds },
  ];

  return (
    <div className="w-full px-4 pt-4 pb-2 relative z-40">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto relative group"
      >
        {/* Glow de Fondo Estético */}
        <div className="absolute -inset-2 bg-gradient-to-r from-[#7C1039]/10 via-transparent to-[#7C1039]/10 rounded-[2.5rem] blur-3xl opacity-50 group-hover:opacity-80 transition duration-1000"></div>

        {/* Contenedor Flotante Premium con Borde Animado Secuencial */}
        <div className="relative bg-[#0a0b14]/70 backdrop-blur-3xl rounded-[2.2rem] p-6 sm:p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] overflow-hidden border border-white/[0.05]">

          {/* Border Beam Effect (Luxury Shimmer) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[2.2rem]">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="beamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="50%" stopColor="#7C1039" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>

              {/* Soft Outer Glow */}
              <motion.rect
                x="0" y="0" width="100" height="100" rx="8"
                fill="none"
                stroke="url(#beamGradient)"
                strokeWidth="3"
                initial={{ pathLength: 0.2, pathOffset: 0, opacity: 0 }}
                animate={{
                  pathOffset: [0, 1],
                  opacity: [0, 0.3, 0.3, 0]
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "linear",
                  times: [0, 0.1, 0.9, 1]
                }}
                style={{ filter: 'blur(5px)' }}
              />

              {/* Precise Light Core */}
              <motion.rect
                x="0" y="0" width="100" height="100" rx="8"
                fill="none"
                stroke="url(#beamGradient)"
                strokeWidth="0.6"
                initial={{ pathLength: 0.15, pathOffset: 0, opacity: 0 }}
                animate={{
                  pathOffset: [0, 1],
                  opacity: [0, 1, 1, 0]
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "linear",
                  times: [0, 0.1, 0.9, 1]
                }}
              />
            </svg>
          </div>

          <div className="flex flex-col gap-6 relative z-10">
            {/* Header: Romanticismo & Contexto */}
            <div className="flex items-center justify-between border-b border-white/5 pb-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1a1b26] to-[#050712] border border-white/10 flex items-center justify-center shadow-lg relative">
                  <span className="text-[#7C1039] font-serif italic text-base tracking-tighter select-none">BD</span>
                  {/* Glow interno del logo */}
                  <div className="absolute inset-0 rounded-full bg-[#7C1039]/5 blur-sm"></div>
                </div>
                <div className="flex flex-col">
                  <h3 className="text-[10px] font-black tracking-[0.4em] text-[#7C1039] uppercase select-none">Nuestro Eterno Comienzo</h3>
                  <p className="text-[9px] text-white/40 font-medium tracking-tight">16 de Agosto • El día que todo cambió</p>
                </div>
              </div>

              {/* Status "Live" Premium */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#7C1039]/5 border border-[#7C1039]/20">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7C1039] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7C1039]"></span>
                </div>
                <span className="text-[8px] font-black text-[#7C1039] uppercase tracking-widest hidden xs:block">Latido a Latido</span>
              </div>
            </div>

            {/* Grid del Contador: Tipografía de Lujo */}
            <div className="grid grid-cols-3 sm:grid-cols-6 items-center gap-y-4 sm:gap-x-0">
              {stats.map((item, index) => (
                <div key={item.label} className="flex flex-col items-center relative group/item">
                  <div className="h-10 sm:h-12 flex items-center justify-center">
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={item.val}
                        initial={{ opacity: 0, y: 15, filter: 'blur(8px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: -15, filter: 'blur(8px)' }}
                        transition={{
                          type: "spring",
                          stiffness: 450,
                          damping: 30
                        }}
                        className={`text-2xl sm:text-4xl font-black tabular-nums tracking-tighter ${item.label === 'Seg' ? 'text-[#7C1039] drop-shadow-[0_0_15px_rgba(124,16,57,0.5)]' : 'text-white'}`}
                      >
                        {item.val}
                      </motion.span>
                    </AnimatePresence>
                  </div>

                  <span className="text-[7px] sm:text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mt-1 group-hover/item:text-white/40 transition-colors select-none">
                    {item.label}
                  </span>

                  {/* Separador vertical sutil */}
                  {index < stats.length - 1 && (
                    <div className="hidden sm:block absolute -right-[1px] top-1/2 -translate-y-1/2 h-8 w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Efecto de Luces Perimetrales Secuenciales (Esquinas) */}
          <div className="absolute top-0 left-0 w-20 h-[1px] bg-gradient-to-r from-transparent to-[#7C1039]/40"></div>
          <div className="absolute bottom-0 right-0 w-20 h-[1px] bg-gradient-to-l from-transparent to-[#7C1039]/40"></div>
        </div>
      </motion.div>
    </div>
  );
};

const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();

  const [selectedYear, setSelectedYear] = useState(Number(searchParams.get('year')) || new Date().getFullYear());
  const [selectedTag, setSelectedTag] = useState('');
  const [search, setSearch] = useState('');
  const [actionItem, setActionItem] = useState<MediaItem | null>(null);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<MediaItem | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const longPressTimer = useRef<any>(null);

  const { data: items = [], isLoading, refetch } = useQuery<MediaItem[]>({
    queryKey: ['media'],
    queryFn: () => apiService.fetchMedia(),
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    const hasPendingVideoThumbs = items.some((item) => item.type === 'video' && !item.thumbnail_path);
    if (!hasPendingVideoThumbs) return;

    const interval = window.setInterval(() => {
      refetch();
    }, 10000);

    return () => window.clearInterval(interval);
  }, [items, refetch]);

  const availableYears = useMemo(() => 
    Array.from(new Set(items.map(item => dayjs(item.taken_at).year()))).sort((a, b) => b - a),
  [items]);

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  useEffect(() => {
    setSearchParams({ year: selectedYear.toString() }, { replace: true });
  }, [selectedYear, setSearchParams]);

  const filteredItems = useMemo(() => {
    const s = search.toLowerCase();
    return items.filter(item => {
      // Usar solo la parte de la fecha para evitar desfases de zona horaria
      const dateStr = item.taken_at.split('T')[0];
      const date = dayjs(dateStr);
      return date.year() === selectedYear &&
             (!selectedTag || item.tag === selectedTag) &&
             (!search || (item.description?.toLowerCase().includes(s) || item.tag.toLowerCase().includes(s)));
    }).sort((a, b) => dayjs(b.taken_at).diff(dayjs(a.taken_at)));
  }, [items, selectedYear, selectedTag, search]);

  const groupedItems = useMemo(() => {
    const months: Record<string, GroupedMonth> = {};
    filteredItems.forEach(item => {
      const dateStr = item.taken_at.split('T')[0];
      const dObj = dayjs(dateStr);
      const mName = dObj.format('MMMM');
      const dKey = dObj.format('DD/MM/YYYY');
      if (!months[mName]) months[mName] = { name: mName, days: {}, total: 0 };
      if (!months[mName].days[dKey]) months[mName].days[dKey] = [];
      months[mName].days[dKey].push(item);
      months[mName].total++;
    });
    return Object.values(months);
  }, [filteredItems]);

  const handleMediaClick = useCallback((item: MediaItem) => {
    sessionStorage.setItem('gallery_scroll_pos', window.scrollY.toString());

    // Capturar posición exacta del elemento para el zoom
    const el = document.querySelector(`[data-id="${item.id}"]`);
    const rect = el?.getBoundingClientRect();

    navigate(`/reels?id=${item.id}&year=${selectedYear}`, {
      state: {
        items: filteredItems,
        returnYear: selectedYear,
        originRect: rect ? {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        } : null
      }
    });
  }, [navigate, selectedYear, filteredItems]);

  const handleActionStart = useCallback((item: MediaItem) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      setActionItem(item);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, 600);
  }, []);

  const handleActionEnd = useCallback(() => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const handleExecuteDelete = async () => {
    const itemToDelete = pendingDeleteItem || actionItem;
    if (!itemToDelete?.id) return;

    setLoadingAction(true);
    try {
      await apiService.deleteMedia(itemToDelete.id);
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setActionItem(null);
      setPendingDeleteItem(null);
      setIsConfirmingDelete(false);
    } catch (e) {
      alert('Error');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full overflow-visible relative text-white selection:bg-[#7C1039]/50" onMouseUp={handleActionEnd} onTouchEnd={handleActionEnd}>
      <div className="fixed inset-0 bg-[#050712] z-0" />
      <motion.img
        initial={{ opacity: 0, x: -100, rotate: -20 }}
        animate={{ opacity: 0.08, x: 0, rotate: 0 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        src="/assets/images/cereza.png"
        className="fixed top-10 -left-10 h-40 pointer-events-none blur-none z-0"
      />
      <motion.img
        initial={{ opacity: 0, x: 100, rotate: 20 }}
        animate={{ opacity: 0.05, x: 0, rotate: 0 }}
        transition={{ duration: 1.5, ease: 'easeOut', delay: 0.2 }}
        src="/assets/images/ghost.png"
        className="fixed bottom-20 -right-10 h-48 pointer-events-none blur-none z-0"
      />
      <div className="relative z-10 flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-50 bg-[#050712]/80 backdrop-blur-2xl px-4 py-4 sm:px-6 sm:py-5 min-h-[64px] sm:min-h-[72px] flex items-center justify-between gap-3 border-b border-white/[0.03]">
        <div className="w-10 flex justify-start">
           {user?.username?.trim().toUpperCase() === 'UNICOMICOPTERO' && (
             <Link to="/admin" className="p-2 text-white/20 hover:text-[#7C1039] transition-all"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></Link>
           )}
        </div>
        <h1 className="font-title text-2xl tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            Breese <span className="text-[#7C1039]">y</span> Diego
        </h1>
        <button onClick={() => logout()} className="w-10 flex justify-end text-white/20 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        </button>
      </header>

      <LoveCounter />

      <main className="relative max-w-5xl mx-auto px-4 sm:px-6 mt-4 sm:mt-8 w-full">
        {/* HERO SECTION - REDISEÑO TOTAL */}
        <section className="relative overflow-hidden bg-[#0a0b14] p-5 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] border border-white/[0.03] mb-8 sm:mb-12 shadow-[0_40px_90px_-20px_rgba(0,0,0,0.5)]">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-52 sm:w-72 h-52 sm:h-72 bg-[#7C1039]/10 rounded-full blur-[40px] sm:blur-[56px]" />

          <div className="relative z-10 text-center space-y-6 sm:space-y-8">
            <div className="space-y-2">
                <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-title text-3xl sm:text-7xl bg-gradient-to-b from-white to-white/40 bg-clip-text text-transparent tracking-tighter">Nuestros Momentos</motion.h2>
                <p className="text-[#7C1039] text-[9px] sm:text-[10px] font-black uppercase tracking-[0.4em] sm:tracking-[0.5em] opacity-80">CHERRY - GHOST</p>
            </div>

            <div className="flex justify-center items-center gap-6 sm:gap-12 py-2">
              <motion.img whileHover={{ scale: 1.15, rotate: 12 }} src="/assets/images/cereza.png" className="h-10 sm:h-16 drop-shadow-[0_10px_30px_rgba(124,16,57,0.5)]" alt="Cherry" />
              <div className="h-10 sm:h-16 w-[1px] bg-gradient-to-b from-transparent via-white/10 to-transparent" />
              <motion.img whileHover={{ scale: 1.15, rotate: -12 }} src="/assets/images/ghost.png" className="h-10 sm:h-16 drop-shadow-[0_10px_30px_rgba(255,255,255,0.2)]" alt="Ghost" />
            </div>

            <div className="max-w-md mx-auto space-y-4 sm:space-y-6 pt-2">
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 sm:left-5 flex items-center pointer-events-none text-white/20 group-focus-within:text-[#7C1039] transition-colors">
                    <svg className="w-3.5 h-3.5 sm:w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <input
                  type="text" placeholder="Buscar un recuerdo..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl py-3 sm:py-4 pl-10 sm:pl-12 pr-4 sm:pr-6 text-xs sm:text-sm text-white placeholder:text-white/20 outline-none focus:bg-white/[0.06] focus:border-[#7C1039]/40 transition-all shadow-inner"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="relative">
                    <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="w-full bg-white/[0.03] border border-white/10 rounded-xl sm:rounded-2xl py-2.5 sm:py-3.5 px-4 sm:px-5 text-[10px] sm:text-xs text-white/80 outline-none appearance-none cursor-pointer focus:border-[#7C1039]/40">
                        {availableYears.map(y => <option key={y} value={y} className="bg-[#0a0b14]">{y}</option>)}
                    </select>
                    <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                </div>
                <div className="relative">
                    <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-xl sm:rounded-2xl py-2.5 sm:py-3.5 px-4 sm:px-5 text-[10px] sm:text-xs text-white/80 outline-none appearance-none cursor-pointer focus:border-[#7C1039]/40">
                        <option value="" className="bg-[#0a0b14]">Todos</option>
                        <option value="B" className="bg-[#0a0b14]">B</option><option value="D" className="bg-[#0a0b14]">D</option><option value="BD" className="bg-[#0a0b14]">BD</option>
                    </select>
                    <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/20"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FEED DE GALERÍA */}
        <section className="space-y-12 sm:space-y-20 px-1 sm:px-0">
          {isLoading ? <GallerySkeleton /> : groupedItems.map(month => (
            <div key={month.name} className="relative">
              <div className="sticky top-[64px] sm:top-[72px] z-30 mb-6 sm:mb-8 flex items-center gap-3 sm:gap-4 rounded-full border border-white/10 bg-white/[0.03] px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#7C1039] shadow-[0_0_12px_rgba(124,16,57,0.55)]" />
                  <h3 className="text-[13px] sm:text-[16px] font-semibold uppercase tracking-[0.35em] text-white/90">{month.name}</h3>
                  <span className="text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.25em] text-[#7C1039]">{selectedYear}</span>
                  <div className="ml-auto h-[1px] flex-1 bg-gradient-to-r from-white/10 via-white/20 to-transparent" />
                  <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.3em] text-white/35">{month.total} items</span>
              </div>
              <div className="space-y-10 sm:space-y-16">
                {Object.entries(month.days).map(([date, dayItems]) => (
                  <DaySection key={date} date={date} items={dayItems} onAction={handleActionStart} onClick={handleMediaClick} />
                ))}
              </div>
            </div>
          ))}
          {!isLoading && filteredItems.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-32 text-center space-y-6">
               <div className="text-6xl grayscale opacity-30">📂</div>
               <p className="text-white/20 font-black uppercase tracking-[0.3em] text-[10px]">Silencio en la cámara... No hay recuerdos aquí.</p>
            </motion.div>
          )}
        </section>
      </main>

      {/* FAB - ACCIÓN PRINCIPAL (Botón de subida redimensionado) */}
      <Link
        to="/upload"
        className="fixed bottom-6 right-6 sm:bottom-10 sm:right-10 z-50 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-tr from-[#7C1039] to-[#9d1548] rounded-2xl sm:rounded-[2rem] flex items-center justify-center shadow-[0_15px_40px_rgba(124,16,57,0.5)] hover:scale-110 active:scale-90 transition-all border border-white/20 group overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        <img src="/assets/images/cereza.png" className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-2xl group-hover:rotate-12 transition-transform duration-300" alt="Upload" />
      </Link>

      {/* MENÚ DE ACCIONES CONTEXTUALES */}
      <AnimatePresence>
        {actionItem && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-12">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActionItem(null)} className="absolute inset-0 bg-black/90 backdrop-blur-sm" />
            <motion.div initial={{ y: 300, scale: 0.9 }} animate={{ y: 0, scale: 1 }} exit={{ y: 300, scale: 0.9 }} className="relative w-full max-w-sm bg-[#0d0e1a] border border-white/10 rounded-[3rem] p-8 shadow-[0_50px_100px_rgba(0,0,0,1)] text-center">
              <div className="w-24 h-32 mx-auto mb-6 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                 <img src={apiService.buildFileUrl(actionItem.thumbnail_url ?? actionItem.thumbnail_path ?? actionItem.file_url)} className="w-full h-full object-cover" alt="Preview" />
              </div>
              <p className="text-white/90 font-black uppercase tracking-widest text-xs mb-8">{actionItem.description || 'Recuerdo guardado'}</p>

              <div className="grid grid-cols-1 gap-3">
                <button onClick={() => { setActionItem(null); navigate(`/upload?edit=${actionItem.id}`); }} className="w-full py-5 bg-white/5 hover:bg-white/10 rounded-3xl text-white font-bold transition-all border border-white/5 uppercase tracking-widest text-[10px]">Editar</button>
                <button onClick={() => { setPendingDeleteItem(actionItem); setIsConfirmingDelete(true); setActionItem(null); }} className="w-full py-5 bg-red-950/30 hover:bg-red-950/50 rounded-3xl text-red-500 font-bold transition-all border border-red-900/20 uppercase tracking-widest text-[10px]">Eliminar</button>
                <button onClick={() => setActionItem(null)} className="w-full py-5 text-white/20 text-[10px] uppercase tracking-[0.3em] font-black">Cerrar</button>
              </div>
            </motion.div>
          </div>
        )}

        {isConfirmingDelete && (
           <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsConfirmingDelete(false); setPendingDeleteItem(null); }} className="absolute inset-0 bg-black/95 backdrop-blur-2xl" />
             <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="relative w-full max-w-sm bg-[#1a050d] border border-red-900/30 rounded-[4rem] p-12 text-center shadow-2xl">
               <div className="text-5xl mb-6">⚠️</div>
               <h3 className="text-2xl font-black text-white mb-3 uppercase tracking-tighter">¿Borrar para siempre?</h3>
               <p className="text-white/40 mb-10 text-[10px] font-medium leading-relaxed uppercase tracking-wider">Este recuerdo desaparecerá de nuestra historia personal.</p>

               {pendingDeleteItem && (
                 <div className="w-20 h-28 mx-auto mb-6 rounded-xl overflow-hidden border border-red-900/20">
                   <img src={apiService.buildFileUrl(pendingDeleteItem.thumbnail_url ?? pendingDeleteItem.thumbnail_path ?? pendingDeleteItem.file_url)} className="w-full h-full object-cover" alt="" />
                 </div>
               )}

               <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => { setIsConfirmingDelete(false); setPendingDeleteItem(null); }} className="py-5 rounded-3xl bg-white/5 text-white font-bold uppercase text-[10px] tracking-widest">No</button>
                 <button disabled={loadingAction} onClick={handleExecuteDelete} className="py-5 rounded-3xl bg-red-600 text-white font-black uppercase text-[10px] tracking-widest flex items-center justify-center shadow-xl shadow-red-600/20">
                   {loadingAction ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : 'Sí, borrar'}
                 </button>
               </div>
             </motion.div>
           </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
};

export default Gallery;
