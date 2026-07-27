import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../api/api';
import { motion, AnimatePresence } from 'framer-motion';
import { MediaItem } from '../types';
import dayjs from 'dayjs';

// Singleton para HLS.js
let hlsJsPromise: Promise<any> | null = null;
const loadHlsJs = (): Promise<any> => {
  if (hlsJsPromise) return hlsJsPromise;
  hlsJsPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.7/dist/hls.min.js';
    script.onload = () => resolve((window as any).Hls);
    document.head.appendChild(script);
  });
  return hlsJsPromise;
};

const ReelsViewer: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  // Intentar obtener los items filtrados desde el estado de navegación
  const stateItems = location.state?.items as MediaItem[] | undefined;
  const yearFilter = searchParams.get('year');

  const { data: allItems = [] } = useQuery<MediaItem[]>({
    queryKey: ['media'],
    queryFn: () => apiService.fetchMedia(),
    staleTime: 1000 * 60 * 15,
    enabled: !stateItems, // Solo buscar si no vienen en el state
  });

  // Usar items del state (ya filtrados) o filtrar los descargados por el año de la URL
  const items = useMemo(() => {
    if (stateItems) return stateItems;
    if (yearFilter) {
      return allItems.filter(item => dayjs(item.taken_at).year() === Number(yearFilter))
                     .sort((a, b) => dayjs(b.taken_at).diff(dayjs(a.taken_at)));
    }
    return allItems;
  }, [stateItems, allItems, yearFilter]);

  const [visibleId, setVisibleId] = useState<number | null>(null);
  const hlsInstances = useRef<Record<number, any>>({});
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});

  const cleanUpHls = useCallback((id: number) => {
    if (hlsInstances.current[id]) {
      hlsInstances.current[id].destroy();
      delete hlsInstances.current[id];
    }
    if (videoRefs.current[id]) {
      videoRefs.current[id]!.src = '';
      videoRefs.current[id]!.load();
    }
  }, []);

  const initVideo = useCallback(async (item: MediaItem) => {
    const id = item.id!;
    const video = videoRefs.current[id];
    if (!video || hlsInstances.current[id]) return;

    const hlsUrl = item.hls_url || item.hls_path;
    const mp4Url = item.file_url || item.file_path;

    if (hlsUrl && item.hls_status === 'ready') {
      const Hls = await loadHlsJs();
      if (Hls.isSupported()) {
        const hls = new Hls({ capLevelToPlayerSize: true, autoStartLoad: true });
        hls.loadSource(apiService.buildFileUrl(hlsUrl));
        hls.attachMedia(video);
        hlsInstances.current[id] = hls;
        if (id === visibleId) video.play().catch(() => {});
        return;
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = apiService.buildFileUrl(hlsUrl);
        if (id === visibleId) video.play().catch(() => {});
        return;
      }
    }

    if (mp4Url) {
      video.src = apiService.buildFileUrl(mp4Url);
      if (id === visibleId) video.play().catch(() => {});
    }
  }, [visibleId]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = Number(entry.target.getAttribute('data-id'));
          if (entry.isIntersecting) {
            setVisibleId(id);
            const item = items.find(i => i.id === id);
            if (item && item.type === 'video') initVideo(item);
          } else {
            cleanUpHls(id);
          }
        });
      },
      { root: containerRef.current, threshold: 0.6 }
    );

    const currentContainer = containerRef.current;
    if (currentContainer) {
      Array.from(currentContainer.children).forEach(el => observer.observe(el));
    }

    return () => {
      observer.disconnect();
      Object.keys(hlsInstances.current).forEach(id => cleanUpHls(Number(id)));
    };
  }, [items, initVideo, cleanUpHls]);

  useEffect(() => {
    if (visibleId && videoRefs.current[visibleId]) {
        videoRefs.current[visibleId]?.play().catch(() => {});
    }
  }, [visibleId]);

  // Scroll inicial al item seleccionado
  useEffect(() => {
    const id = searchParams.get('id');
    if (id && items.length && containerRef.current) {
      const idx = items.findIndex(i => i.id?.toString() === id);
      if (idx !== -1) {
        containerRef.current.children[idx].scrollIntoView();
      }
    }
  }, [items, searchParams]);

  return (
    <div className="fixed inset-0 bg-black z-50 overflow-hidden">
      <div ref={containerRef} className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar">
        {items.map((item) => (
          <div key={item.id} data-id={item.id} className="h-full w-full snap-start relative flex items-center justify-center">
            {item.type === 'video' ? (
              <video
                ref={el => videoRefs.current[item.id!] = el}
                className="w-full h-full object-contain"
                loop playsInline muted={false}
                poster={apiService.buildFileUrl(item.thumbnail_url || item.thumbnail_path)}
              />
            ) : (
              <img src={apiService.buildFileUrl(item.file_url || item.file_path)} className="w-full h-full object-contain" alt="" />
            )}
            
            <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
              <span className="bg-[#7C1039] px-2 py-1 rounded text-[10px] font-bold text-white uppercase mb-2 inline-block">
                {item.tag}
              </span>
              <p className="text-white text-lg font-medium drop-shadow-md">{item.description}</p>
              <p className="text-white/60 text-xs">{dayjs(item.taken_at).format('DD [de] MMMM, YYYY')}</p>
            </div>

            <button 
              onClick={() => navigate(-1)} 
              className="absolute top-6 left-6 p-3 bg-black/20 backdrop-blur-md rounded-full text-white pointer-events-auto"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReelsViewer;