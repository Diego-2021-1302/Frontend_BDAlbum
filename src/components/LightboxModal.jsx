import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";

export default function LightboxModal({
  isOpen,
  item,
  onClose,
  onPrev,
  onNext,
}) {
  const videoRef = useRef(null);

  // guardamos la posición de scroll actual para restaurarla
  const scrollYRef = useRef(0);

  // dirección del movimiento:
  // -1 = prev (venimos de abajo → subimos)
  // +1 = next (venimos de arriba → bajamos)
  const [direction, setDirection] = useState(0);

  // item interno para animación
  const [internalItem, setInternalItem] = useState(item);

  // =========================================================
  // Bloquear scroll global (versión hardcore, sin deslizamiento)
  // =========================================================
  useEffect(() => {
    if (!isOpen) return;

    scrollYRef.current = window.scrollY || 0;

    const body = document.body;
    const html = document.documentElement;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollYRef.current}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      html.style.overflow = "";
      body.style.overflow = "";
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      window.scrollTo(0, scrollYRef.current);
    };
  }, [isOpen]);

  // =========================================================
  // Sincronizar item externo → interno
  // =========================================================
  useEffect(() => {
    setInternalItem(item);
  }, [item]);

  // =========================================================
  // Helper para pausar video antes de cambiar media
  // =========================================================
  const safePause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
  }, []);

  // =========================================================
  // Navegación prev/next memorizada (setDirection importa!)
  // =========================================================
  const goPrev = useCallback(() => {
    // retroceder (mostrar item anterior)
    safePause();
    setDirection(-1); // -1 = venimos desde "abajo", animamos subiendo
    if (onPrev) onPrev();
  }, [onPrev, safePause]);

  const goNext = useCallback(() => {
    // avanzar (mostrar item siguiente)
    safePause();
    setDirection(1); // +1 = venimos desde "arriba", animamos bajando
    if (onNext) onNext();
  }, [onNext, safePause]);

  // =========================================================
  // Controles de teclado globales
  // =========================================================
  useEffect(() => {
    if (!isOpen) return;

    function handleKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // invertido:
      // ArrowUp = siguiente (goNext)
      if (e.key === "ArrowUp") {
        e.preventDefault();
        goNext();
        return;
      }

      // ArrowDown = anterior (goPrev)
      if (e.key === "ArrowDown") {
        e.preventDefault();
        goPrev();
        return;
      }

      // Left = anterior
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
        return;
      }

      // Right = siguiente
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
        return;
      }

      // Space → toggle play/pause si es video
      if (e.key === " ") {
        if (videoRef.current && internalItem?.type === "video") {
          e.preventDefault();
          togglePlay();
        }
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, internalItem, goPrev, goNext, onClose]);

  // =========================================================
  // Autoplay / volumen cada vez que cambia internalItem
  // =========================================================
  useEffect(() => {
    if (internalItem?.type === "video" && videoRef.current) {
      const v = videoRef.current;
      v.pause();
      v.currentTime = 0;
      v.muted = false;
      v.volume = 0.6;

      const playPromise = v.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          v.muted = true;
          v.play().catch(() => {});
        });
      }
    }
  }, [internalItem]);

  if (!isOpen || !internalItem) return null;

  const isVideo = internalItem.type === "video";

  // =========================================================
  // Controles del video
  // =========================================================
  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }

  // =========================================================
  // Animaciones framer-motion VISIBLES
  // =========================================================
  // Vamos a animar en eje Y (vertical), con escala y blur leve
  // direction > 0 (goNext) → la nueva entra desde abajo (+120px)
  // direction < 0 (goPrev) → la nueva entra desde arriba (-120px)
  const mediaVariants = {
    enter: (dir) => ({
      opacity: 0,
      y: dir > 0 ? 120 : -120,
      scale: 0.9,
      filter: "blur(4px)",
    }),
    center: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        duration: 0.28,
        ease: "cubic-bezier(0.16, 1, 0.3, 1)", // easeOutQuint-ish
      },
    },
    exit: (dir) => ({
      opacity: 0,
      y: dir > 0 ? -120 : 120,
      scale: 0.9,
      filter: "blur(4px)",
      transition: {
        duration: 0.22,
        ease: "cubic-bezier(0.4, 0, 1, 1)", // easeIn-ish
      },
    }),
  };

  return (
    <div
      className="
        fixed inset-0 z-[9999]
        flex items-center justify-center
        bg-black/80 backdrop-blur-sm
        p-4
      "
    >
      {/* Glow radial sutil */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12)_0%,rgba(0,0,0,0)_70%)]" />

      {/* Botón cerrar */}
      <button
        className="
          absolute top-4 right-4
          text-white/80 hover:text-white
          text-sm md:text-base font-medium
          bg-white/10 hover:bg-white/20
          rounded-lg px-3 py-1.5 border border-white/20
          shadow-lg shadow-black/40
        "
        onClick={onClose}
      >
        ✕ Cerrar
      </button>

      {/* Prev / Next desktop a los lados */}
      <button
        onClick={goPrev}
        className="
          hidden md:flex
          absolute left-4 top-1/2 -translate-y-1/2
          bg-white/10 hover:bg-white/20
          text-white text-sm md:text-base font-medium
          rounded-lg px-3 py-2 border border-white/20
          shadow-lg shadow-black/40
          transition-colors
        "
      >
        ‹ Anterior
      </button>

      <button
        onClick={goNext}
        className="
          hidden md:flex
          absolute right-4 top-1/2 -translate-y-1/2
          bg-white/10 hover:bg-white/20
          text-white text-sm md:text-base font-medium
          rounded-lg px-3 py-2 border border-white/20
          shadow-lg shadow-black/40
          transition-colors
        "
      >
        Siguiente ›
      </button>

      {/* Contenido principal */}
      <div
        className="
          relative
          flex flex-col items-center justify-center gap-4
          max-w-full max-h-full
        "
      >
        {/* Viewport del media */}
        <div
          className="
            relative
            bg-black/70 rounded-xl
            border border-white/10
            shadow-2xl shadow-black/80
            max-w-[90vw] max-h-[70vh]
            flex items-center justify-center
            overflow-hidden
          "
        >
          <AnimatePresence
            // le decimos a framer que use la dirección para animar salida/entrada
            custom={direction}
            mode="popLayout"
          >
            <motion.div
              key={internalItem.id || internalItem.src}
              custom={direction}
              variants={mediaVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="relative flex items-center justify-center"
            >
              {isVideo ? (
                <>
                  <video
                    ref={videoRef}
                    src={internalItem.src}
                    className="
                      object-contain
                      max-h-[70vh] max-w-[90vw]
                      bg-black
                    "
                    controls
                    controlsList="nodownload"
                  />

                  {/* Controles rápidos overlay video */}
                  <div className="absolute bottom-3 left-3 flex gap-2">
                    <button
                      onClick={togglePlay}
                      className="
                        bg-black/60 hover:bg-black/80
                        text-white text-xs md:text-sm font-semibold
                        rounded-md px-2 py-1 border border-white/20
                        shadow-lg shadow-black/60
                      "
                    >
                      ▶ / ❚❚
                    </button>
                    <button
                      onClick={toggleMute}
                      className="
                        bg-black/60 hover:bg-black/80
                        text-white text-xs md:text-sm font-semibold
                        rounded-md px-2 py-1 border border-white/20
                        shadow-lg shadow-black/60
                      "
                    >
                      🔇 / 🔊
                    </button>
                  </div>
                </>
              ) : (
                <img
                  src={internalItem.src}
                  alt={internalItem.description || "imagen"}
                  className="
                    object-contain
                    max-h-[70vh] max-w-[90vw]
                    bg-black
                    select-none
                  "
                  draggable={false}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Panel info */}
        <div
          className="
            w-full max-w-[90vw]
            text-white
            text-sm leading-relaxed
            flex flex-col gap-3
            bg-black/30 rounded-lg
            border border-white/10
            shadow-xl shadow-black/70
            p-4
          "
        >
          {/* Metadatos */}
          <div className="flex flex-wrap items-center gap-2 text-white font-medium text-sm md:text-base">
            {internalItem.tag && (
              <span
                className="
                  px-2 py-[2px] rounded
                  bg-white/10 border border-white/20
                  text-[11px] md:text-xs uppercase tracking-wide
                  text-white/90
                "
              >
                {internalItem.tag}
              </span>
            )}

            {internalItem.taken_at && (
              <span className="text-white/60 text-xs md:text-sm font-normal">
                {internalItem.taken_at}
              </span>
            )}

            {internalItem.indexInfo && (
              <span className="text-white/40 text-[11px] md:text-xs font-normal">
                {internalItem.indexInfo}
              </span>
            )}
          </div>

          {/* Descripción */}
          {internalItem.description && (
            <div className="text-white/80 break-words text-sm md:text-base">
              {internalItem.description}
            </div>
          )}

          {/* Tips navegación */}
          <div className="text-white/40 text-[11px] md:text-xs select-none flex flex-wrap gap-2">
            <span className="block md:hidden">
              Desliza ↑ (siguiente) / ↓ (anterior)
            </span>
            <span className="hidden md:block">
              Usa ↑ ↓ ← →   ·   ESC para salir
            </span>
          </div>
        </div>

        {/* Controles mobile abajo */}
        <div className="flex w-full max-w-[90vw] gap-2 md:hidden">
          <button
            onClick={goPrev}
            className="
              flex-1
              bg-white/10 hover:bg-white/20
              text-white text-xs font-medium md:text-sm
              rounded-lg px-3 py-2 border border-white/20
              shadow-lg shadow-black/40
              transition-colors
              text-center
            "
          >
            ↓ Anterior
          </button>
          <button
            onClick={goNext}
            className="
              flex-1
              bg-white/10 hover:bg-white/20
              text-white text-xs font-medium md:text-sm
              rounded-lg px-3 py-2 border border-white/20
              shadow-lg shadow-black/40
              transition-colors
              text-center
            "
          >
            ↑ Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
