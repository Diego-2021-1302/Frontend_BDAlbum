import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const InstallPWA: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Detectar si ya está instalada la PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches
                       || (window.navigator as any).standalone
                       || document.referrer.includes('android-app://');

    setIsStandalone(standalone);

    // Si ya es standalone, no mostramos nada
    if (standalone) return;

    // 2. Detectar si es iOS (iPhone/iPad/iPod)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);

    // Si es iOS, NO mostramos el banner (como solicitó el usuario)
    if (isIOS) return;

    // 3. Manejar evento de instalación en Android/Chrome (Solo para no-iOS)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowBanner(false);
    }
  };

  if (isStandalone || !showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-6 right-6 z-[100] bg-[#121212]/90 backdrop-blur-xl border border-white/10 p-4 rounded-3xl shadow-2xl flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 overflow-hidden">
            <img src="/assets/images/logo_android.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Instalar BRIEGO</h3>
            <p className="text-[10px] text-white/50 uppercase tracking-widest">Acceso rápido y privado</p>
          </div>
        </div>

        <button
          onClick={handleInstallClick}
          className="bg-[#7C1039] text-white text-[10px] font-bold uppercase px-6 py-3 rounded-xl active:scale-95 transition-all"
        >
          Instalar
        </button>

        <button
          onClick={() => setShowBanner(false)}
          className="absolute -top-2 -right-2 w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white/40 hover:text-white border border-white/10"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default InstallPWA;
