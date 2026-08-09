import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { apiService } from '../api/api';
import { DEFAULT_API_BASE_URL } from '../config/apiConfig';
import { motion, AnimatePresence } from 'framer-motion';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const {
    baseUrl, setBaseUrl,
    mediaUrl, uploadUrl, videoUrl,
    saveGlobalConfig, login: storeLogin, fetchGlobalConfig,
    fetchLocalConfig
  } = useAuthStore();
  
  const [identity, setIdentity] = useState(localStorage.getItem('app_user_id') || '');
  const [showConfig, setShowConfig] = useState(false);
  const [tempConfig, setTempConfig] = useState({
    api: baseUrl,
    media: mediaUrl,
    upload: uploadUrl,
    video: videoUrl
  });

  // Intentar autocompletar desde archivo local al montar
  React.useEffect(() => {
    fetchLocalConfig();
  }, [fetchLocalConfig]);

  // Sincronización con la nube (opcional, si ya existe un backend configurado)
  React.useEffect(() => {
    if (baseUrl) fetchGlobalConfig();
  }, [baseUrl, fetchGlobalConfig]);

  React.useEffect(() => {
    setTempConfig({ api: baseUrl, media: mediaUrl, upload: uploadUrl, video: videoUrl });
  }, [baseUrl, mediaUrl, uploadUrl, videoUrl]);

  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'user' | 'pin'>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    if (!identity) return setError('Ingresa tu usuario');
    setError(null);
    setStep('pin');
  };

  const handleNumberClick = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError(null);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleLogin = async () => {
    if (pin.length < 4) return setError('PIN incompleto');
    
    setLoading(true);
    setError(null);

    try {
      const api = baseUrl || DEFAULT_API_BASE_URL;
      const res = await apiService.login(identity, pin, api);
      
      if (res && res.token) {
        localStorage.setItem('app_user_id', identity);
        
        setTimeout(async () => {
          await storeLogin(res.user || { id: 0, username: identity }, res.token, api);
          navigate('/');
        }, 500);
      } else {
        setError('PIN Incorrecto');
        setPin('');
        setLoading(false);
      }
    } catch (err) {
      setError('Error de conexión');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark text-white flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      
      <motion.img
        initial={{ opacity: 0, x: -100, rotate: -20 }}
        animate={{ opacity: 0.15, x: 0, rotate: 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        src="/assets/images/cereza.png" 
        className="absolute top-10 -left-10 h-40 pointer-events-none blur-sm"
      />
      <motion.img 
        initial={{ opacity: 0, x: 100, rotate: 20 }}
        animate={{ opacity: 0.1, x: 0, rotate: 0 }}
        transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
        src="/assets/images/ghost.png" 
        className="absolute bottom-20 -right-10 h-48 pointer-events-none blur-sm"
      />

      <div className="w-full max-w-sm relative z-10">
        <header className="text-center mb-10">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="inline-block p-4 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 mb-4"
          >
            <img src="/assets/images/cereza.png" className="h-12 mx-auto" alt="Logo" />
          </motion.div>
          <h1 className="text-4xl font-title tracking-tight text-white/90">Privado</h1>
          <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] mt-2">Acceso Exclusivo</p>
        </header>

        <AnimatePresence mode="wait">
          {step === 'user' ? (
            <motion.div key="user" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="space-y-6">
              <div className="bg-[#121212]/50 backdrop-blur-md p-8 rounded-[40px] border border-pink-500/50 shadow-2xl pt-2">
                <p className="text-center text-white/40 text-[10px] uppercase tracking-[0.2em] mb-6 font-bold">USUARIO</p>
                <input
                  type="text"
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  placeholder="Tu usuario"
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 px-6 text-center text-lg outline-none focus:bg-white/10 focus:border-white/20 transition-all placeholder:text-white/10"
                />
              </div>
              <button onClick={handleNext} className="w-full bg-pink-950 text-black font-bold py-4 rounded-2xl active:scale-95 transition-all shadow-xl shadow-pink-500/5">Continuar</button>
            </motion.div>
          ) : (
            <motion.div key="pin" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center">
              <div className="text-center mb-8">
                <p className="text-primary text-xs font-bold uppercase tracking-widest mb-1">{identity}</p>
                <button onClick={() => setStep('user')} className="text-white/30 text-[10px] hover:text-white/60 transition-colors">Cambiar usuario</button>
              </div>

              <div className="flex gap-4 mb-10">
                {[...Array(4)].map((_, i) => (
                  <motion.div 
                    key={i}
                    animate={pin.length > i ? { scale: [1, 1.2, 1] } : {}}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${pin.length > i ? 'bg-primary border-primary' : 'border-white/10'}`}
                  />
                ))}
              </div>

              {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-[10px] font-bold uppercase mb-6 tracking-widest">{error}</motion.p>}

              <div className="grid grid-cols-3 gap-5 w-full max-w-70">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button key={num} onClick={() => handleNumberClick(num)} className="aspect-square rounded-full bg-white/5 border border-white/5 text-2xl font-light hover:bg-white/10 active:scale-90 transition-all flex items-center justify-center">{num}</button>
                ))}
                <div />
                <button onClick={() => handleNumberClick('0')} className="aspect-square rounded-full bg-white/5 border border-white/5 text-2xl font-light hover:bg-white/10 active:scale-90 transition-all flex items-center justify-center">0</button>
                <button onClick={handleDelete} className="aspect-square rounded-full flex items-center justify-center hover:bg-white/5 active:scale-90 transition-all text-white/30"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" /></svg></button>
              </div>

              <button
                onClick={handleLogin}
                disabled={loading || pin.length < 4}
                className="w-full bg-primary text-white font-bold py-4 rounded-2xl mt-12 active:scale-95 disabled:opacity-30 transition-all flex justify-center items-center shadow-lg shadow-primary/20"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Acceder'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-12 w-full max-w-sm px-4">
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="w-full text-[10px] text-white/10 hover:text-white/30 uppercase tracking-[0.3em] transition-colors py-4 flex items-center justify-center gap-2"
        >
          <svg className={`w-3 h-3 transition-transform ${showConfig ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Configuración de Nodos
        </button>

        <AnimatePresence>
          {showConfig && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="bg-white/5 backdrop-blur-md rounded-3xl border border-white/5 p-6 mt-2 space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] text-primary font-black uppercase ml-1">API Backend (8001)</label>
                  <input type="text" value={tempConfig.api} onChange={e => setTempConfig({...tempConfig, api: e.target.value})} className="w-full bg-black/20 border border-white/5 rounded-xl py-3 px-4 text-xs text-white outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-primary font-black uppercase ml-1">Media Server - Fotos (8002)</label>
                  <input type="text" value={tempConfig.media} onChange={e => setTempConfig({...tempConfig, media: e.target.value})} className="w-full bg-black/20 border border-white/5 rounded-xl py-3 px-4 text-xs text-white outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-primary font-black uppercase ml-1">Upload Server (8003)</label>
                  <input type="text" value={tempConfig.upload} onChange={e => setTempConfig({...tempConfig, upload: e.target.value})} className="w-full bg-black/20 border border-white/5 rounded-xl py-3 px-4 text-xs text-white outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-primary font-black uppercase ml-1">Video Streaming (8004)</label>
                  <input type="text" value={tempConfig.video} onChange={e => setTempConfig({...tempConfig, video: e.target.value})} className="w-full bg-black/20 border border-white/5 rounded-xl py-3 px-4 text-xs text-white outline-none" />
                </div>
                <button onClick={() => saveGlobalConfig(tempConfig).then(() => setShowConfig(false))} className="w-full bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase py-3 rounded-xl transition-all">Guardar Configuración</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Login;
