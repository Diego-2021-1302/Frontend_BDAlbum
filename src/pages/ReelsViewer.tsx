import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../api/api';
import { motion, AnimatePresence } from 'framer-motion';
import { MediaItem } from '../types';
import dayjs from 'dayjs';

const ReelsViewer: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  const originRect = location.state?.originRect;
  const [isZooming, setIsZooming] = useState(!!originRect);
  const [isReady, setIsReady] = useState(false);
  const [isContentReady, setIsContentReady] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);

  const stateItems = location.state?.items as MediaItem[] | undefined;
  const yearFilter = searchParams.get('year');
  const targetId = searchParams.get('id');

  const { data: allItems = [] } = useQuery<MediaItem[]>({
    queryKey: ['media'],
    queryFn: () => apiService.fetchMedia(),
    staleTime: 1000 * 60 * 15,
    enabled: !stateItems,
  });

  const items = useMemo(() => {
    if (stateItems?.length) return stateItems;
    if (yearFilter) {
      return allItems
        .filter((item) => dayjs(item.taken_at).year() === Number(yearFilter))
        .sort((a, b) => dayjs(b.taken_at).diff(dayjs(a.taken_at)));
    }
    return allItems;
  }, [stateItems, allItems, yearFilter]);

  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const lastActiveId = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) ?? null,
    [items, activeId]
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeout = useRef<number | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  const activeIndex = useMemo(
    () => (activeItem ? items.findIndex((item) => item.id === activeItem.id) : -1),
    [activeItem, items]
  );

  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  function PlayIcon() {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" className="text-white">
        <polygon points="5,3 15,9 5,15" />
      </svg>
    );
  }

  function PauseIcon() {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" className="text-white">
        <rect x="4" y="3" width="4" height="12" rx="1.5" />
        <rect x="10" y="3" width="4" height="12" rx="1.5" />
      </svg>
    );
  }

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) {
      window.clearTimeout(controlsTimeout.current);
    }
    controlsTimeout.current = window.setTimeout(() => setShowControls(false), 3200);
  }, []);

  const toggleControlsVisibility = useCallback(() => {
    setShowControls((current) => {
      if (current) {
        if (controlsTimeout.current) {
          window.clearTimeout(controlsTimeout.current);
          controlsTimeout.current = null;
        }
        return false;
      }

      if (controlsTimeout.current) {
        window.clearTimeout(controlsTimeout.current);
      }
      controlsTimeout.current = window.setTimeout(() => setShowControls(false), 3200);
      return true;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (controlsTimeout.current) {
        window.clearTimeout(controlsTimeout.current);
      }
    };
  }, []);

  const resolveMediaUrl = useCallback((item: MediaItem, kind: 'image' | 'video') => {
    const sourcePath = item.file_url || item.file_path;
    return sourcePath ? apiService.buildFileUrl(sourcePath, kind) : '';
  }, []);

  const updateBuffered = useCallback((video: HTMLVideoElement | null) => {
    if (!video) return;
    const bufferedRanges = video.buffered;
    const bufferedSeconds = bufferedRanges.length ? bufferedRanges.end(bufferedRanges.length - 1) : 0;
    setBuffered(bufferedSeconds);
  }, []);

  const initVideo = useCallback((item: MediaItem) => {
    const id = item.id;
    if (!id) return;

    const video = videoRefs.current[id];
    const sourcePath = item.file_url || item.file_path;
    if (!video || !sourcePath) return;

    const videoUrl = apiService.buildFileUrl(sourcePath, 'video');
    if (video.src !== videoUrl) {
      video.src = videoUrl;
      video.load();
    }
  }, []);

  const pauseVideo = useCallback((video: HTMLVideoElement | null) => {
    if (!video) return;
    video.pause();
    video.muted = true;
  }, []);

  const updateVideoPreload = useCallback((activeId: number | null) => {
    Object.entries(videoRefs.current).forEach(([idStr, video]) => {
      if (!video) return;
      const id = Number(idStr);
      const isActive = id === activeId;
      const isNeighbor = activeId !== null && Math.abs(id - activeId) <= 1;

      video.preload = isActive || isNeighbor ? 'auto' : 'metadata';
    });
  }, []);

  const playVideo = useCallback((video: HTMLVideoElement | null) => {
    if (!video) return;

    video.muted = false;
    const playPromise = video.play();

    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.catch(() => {
        video.muted = true;
        video.play().catch(() => undefined);
      });
    }
  }, []);

  const updateVideoControls = useCallback((video: HTMLVideoElement | null) => {
    if (!video) return;
    video.muted = false;
    video.volume = 1;
  }, []);

  const setVideoTime = useCallback(
    (time: number) => {
      const video = activeItem?.id ? videoRefs.current[activeItem.id] : null;
      if (!video) return;
      video.currentTime = time;
      setCurrentTime(time);
    },
    [activeItem]
  );

  const seekToPointer = useCallback(
    (clientX: number) => {
      const rect = progressRef.current?.getBoundingClientRect();
      if (!rect || !duration) return;
      const clickRatio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      setVideoTime(clickRatio * duration);
    },
    [duration, setVideoTime]
  );

  const handleProgressPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (duration <= 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsSeeking(true);
      seekToPointer(event.clientX);
    },
    [duration, seekToPointer]
  );

  useEffect(() => {
    if (!isSeeking) return;

    const handlePointerMove = (event: PointerEvent) => {
      seekToPointer(event.clientX);
    };

    const handlePointerUp = () => {
      setIsSeeking(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isSeeking, seekToPointer]);

  const togglePlay = useCallback(() => {
    const video = activeItem?.id ? videoRefs.current[activeItem.id] : null;
    if (!video) return;

    if (video.paused || video.ended) {
      playVideo(video);
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [activeItem, playVideo]);

  const handleInteraction = useCallback(() => {
    resetControlsTimer();
  }, [resetControlsTimer]);


  useEffect(() => {
    isMountedRef.current = true;

    if (!items.length) return;

    const initialIndex = targetId
      ? items.findIndex((item) => item.id?.toString() === targetId)
      : 0;

    const fallbackIndex = initialIndex >= 0 ? initialIndex : 0;
    const selectedItem = items[fallbackIndex];

    if (selectedItem?.id) {
      setActiveId(selectedItem.id);
    }

    const frame = window.requestAnimationFrame(() => {
      const element = containerRef.current?.children[fallbackIndex] as HTMLElement | undefined;
      element?.scrollIntoView({ block: 'start', behavior: 'auto' });
      if (isMountedRef.current) {
        setIsReady(true);
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      isMountedRef.current = false;
      lastActiveId.current = null;
      Object.values(videoRefs.current).forEach((video) => {
        if (video) {
          video.pause();
          video.currentTime = 0;
          video.src = '';
          video.load();
        }
      });
      videoRefs.current = {};
    };
  }, [items, targetId]);

  useEffect(() => {
    if (!activeId || !items.length) return;

    if (lastActiveId.current === activeId) return;
    lastActiveId.current = activeId;

    const activeItem = items.find((item) => item.id === activeId);
    if (activeItem?.type === 'video') {
      initVideo(activeItem);
    }

    updateVideoPreload(activeId);

    Object.entries(videoRefs.current).forEach(([idStr, video]) => {
      if (!video) return;
      const videoId = Number(idStr);

      updateVideoControls(video);

      if (videoId === activeId) {
        if (video.readyState >= 2) {
          playVideo(video);
          setIsPlaying(true);
          setDuration(video.duration || 0);
        }
      } else {
        pauseVideo(video);
      }
    });
  }, [activeId, items, initVideo, playVideo, pauseVideo, updateVideoPreload, updateVideoControls]);

  useEffect(() => {
    if (!containerRef.current || !items.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.intersectionRatio >= 0.65)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visibleEntry) return;

        const id = Number(visibleEntry.target.getAttribute('data-id'));
        if (!Number.isNaN(id) && isMountedRef.current) {
          const item = items.find((entryItem) => entryItem.id === id);
          if (item?.type === 'video') {
            initVideo(item);
          }
          setActiveId(id);
        }
      },
      {
        root: containerRef.current,
        threshold: [0.65, 0.85, 1.0],
        rootMargin: '0px 0px -20% 0px',
      }
    );

    const elements = Array.from(containerRef.current.children);
    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      elements.forEach((element) => observer.unobserve(element));
    };
  }, [items, initVideo]);

  useEffect(() => {
    if (!isZooming) return;

    const timeout = window.setTimeout(() => {
      setIsZooming(false);
    }, 700);

    if (isContentReady) {
      setIsZooming(false);
    }

    return () => window.clearTimeout(timeout);
  }, [isZooming, isContentReady]);

  useEffect(() => {
    if (!isZooming) {
      setIsContentReady(false);
    }
  }, [isZooming]);

  return (
    <div className="fixed inset-0 z-100 overflow-hidden bg-black text-white">
      <div
        ref={containerRef}
        className={`h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}
      >
        {items.map((item) => {
          const isSelected = item.id?.toString() === targetId;
          const isActive = item.id === activeId;
          const mediaUrl = resolveMediaUrl(item, item.type === 'video' ? 'video' : 'image');
          return (
            <div
              key={item.id}
              data-id={item.id}
              className="relative h-full w-full snap-start overflow-hidden bg-[#070710]"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-[#070710] via-[#070710]/90 to-[#070710]" />

              <div className="absolute inset-x-0 top-6 z-20 px-5 transition-opacity duration-300"
                style={{ opacity: showControls && isActive ? 1 : 0, pointerEvents: showControls && isActive ? 'auto' : 'none' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => navigate(-1)}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl text-white/70 transition-all duration-300 hover:text-white shadow-[0_20px_60px_-40px_rgba(0,0,0,0.8)]"
                    style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="2" y1="2" x2="12" y2="12" />
                      <line x1="12" y1="2" x2="2" y2="12" />
                    </svg>
                  </button>

                  <div className="ml-auto rounded-full bg-black/35 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                    style={{ backdropFilter: 'blur(18px)' }}>
                    {activeIndex >= 0 ? `${activeIndex + 1}/${items.length}` : `0/${items.length}`}
                  </div>
                </div>
              </div>

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative h-full w-full flex items-center justify-center overflow-hidden">
                  {item.type === 'video' ? (
                    <video
                      ref={(el) => {
                        if (el) {
                          videoRefs.current[item.id!] = el;
                        }
                      }}
                      src={mediaUrl}
                      className="max-h-full max-w-full object-contain"
                      loop
                      playsInline
                      controls={false}
                      crossOrigin="anonymous"
                      preload="metadata"
                      onLoadedData={() => {
                        if (isActive && videoRefs.current[item.id!]) {
                          updateVideoControls(videoRefs.current[item.id!]);
                          playVideo(videoRefs.current[item.id!]);
                          setDuration(videoRefs.current[item.id!]?.duration || 0);
                          setIsContentReady(true);
                        }
                      }}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onTimeUpdate={() => {
                        if (isActive && videoRefs.current[item.id!]) {
                          const video = videoRefs.current[item.id!];
                          setCurrentTime(video?.currentTime || 0);
                          updateBuffered(video);
                        }
                      }}
                      onProgress={() => {
                        if (isActive && videoRefs.current[item.id!]) {
                          updateBuffered(videoRefs.current[item.id!]);
                        }
                      }}
                      onEnded={() => {
                        setIsPlaying(false);
                      }}
                      onClick={() => toggleControlsVisibility()}
                      onError={() => {
                        /* Mostrar el poster si falla, pero no bloquear la navegación */
                      }}
                    />
                  ) : (
                    <img
                      src={mediaUrl}
                      className="relative max-h-full max-w-full object-contain transition-opacity duration-500 opacity-100"
                      alt=""
                      crossOrigin="anonymous"
                      loading={isActive ? 'eager' : 'lazy'}
                      onLoad={() => {
                        if (isSelected) {
                          setIsContentReady(true);
                        }
                      }}
                      onClick={() => toggleControlsVisibility()}
                      onError={() => {
                        /* Si la imagen falla, el usuario verá un fallback limpio */
                      }}
                    />
                  )}
                </div>
              </div>

              {showControls && isActive && item.type === 'video' && (
                <>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#070710]/95 via-[#070710]/40 to-transparent transition-opacity duration-300" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        togglePlay();
                        resetControlsTimer();
                      }}
                      className="pointer-events-auto flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300 hover:scale-105"
                      style={{ background: 'rgba(124,16,57,0.95)', border: '1px solid rgba(124,16,57,0.6)' }}
                    >
                      {isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>
                  </div>
                </>
              )}

              <div
                className="absolute inset-x-0 bottom-0 z-20 px-5 pb-8 pt-6 transition-all duration-500"
                style={{ opacity: showControls && isActive ? 1 : 0, transform: showControls && isActive ? 'translateY(0)' : 'translateY(12px)' }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <span
                    className="rounded-full px-3 py-[3px] text-[9px] font-black uppercase tracking-[0.22em] text-white/90"
                    style={{ background: 'rgba(124,16,57,0.85)', border: '1px solid rgba(124,16,57,0.4)' }}
                  >
                    {item.tag || 'Reel'}
                  </span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <h3 className="mb-1 text-[18px] font-semibold leading-snug tracking-tight text-white">
                  {item.description || 'Recuerdo guardado'}
                </h3>

                <p className="mb-5 text-[9px] uppercase tracking-[0.28em] text-white/35">
                  {dayjs(item.taken_at).format('DD MMMM YYYY')}
                </p>

                {item.type === 'video' && (
                  <div className="transition-all duration-300">
                    <div
                      ref={progressRef}
                      className="relative mb-4 h-4 w-full cursor-pointer rounded-full bg-white/10 touch-none"
                      onPointerDown={handleProgressPointerDown}
                    >
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-white/20"
                        style={{
                          width: `${duration ? Math.min(100, Math.max(0, (buffered / duration) * 100)) : 0}%`,
                        }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all"
                        style={{
                          width: `${duration && currentTime ? (currentTime / duration) * 100 : 0}%`,
                          background: 'linear-gradient(90deg, #7c1039, #c9185b)',
                        }}
                      />
                      <div
                        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.65)] bg-white transition-all ${isSeeking ? 'scale-110' : ''}`}
                        style={{ left: `calc(${duration && currentTime ? (currentTime / duration) * 100 : 0}% - 8px)` }}
                      />
                    </div>

                    <div className="flex flex-col gap-4">
                      <span className="text-[11px] font-mono text-white/50">
                        {`${formatTime(currentTime)} / ${formatTime(duration)}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <AnimatePresence>
                {isZooming && isSelected && (
                  <motion.div
                    initial={{
                      position: 'fixed',
                      top: originRect?.top || 0,
                      left: originRect?.left || 0,
                      width: originRect?.width || '100%',
                      height: originRect?.height || '100%',
                      borderRadius: '2rem',
                      zIndex: 500,
                    }}
                    animate={{
                      top: 0,
                      left: 0,
                      width: '100vw',
                      height: '100vh',
                      borderRadius: 0,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center justify-center overflow-hidden"
                    style={{ background: '#070710' }}
                  >
                    <div className="h-full w-full flex items-center justify-center">
                      <div className="h-20 w-20 rounded-full border border-white/10 bg-white/5 shadow-[0_0_40px_rgba(255,255,255,0.08)]" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ReelsViewer;
