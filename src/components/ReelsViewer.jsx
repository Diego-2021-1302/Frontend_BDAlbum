import { useEffect, useRef, useState, useCallback } from "react";

export default function ReelsViewer({
  isOpen,
  items,
  startIndex = 0,
  onClose,
}) {
  const [current, setCurrent] = useState(startIndex);

  // +1 = siguiente, -1 = anterior
  const [direction, setDirection] = useState(0);

  // media anterior para la animación saliente
  const [prevMedia, setPrevMedia] = useState(null);

  // phase:
  // "idle" (normal, sin anim)
  // "prep" (acabamos de cambiar current, colocamos estados iniciales offscreen)
  // "run"  (disparamos la transición hacia posición final)
  const [phase, setPhase] = useState("idle");

  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const scrollYRef = useRef(0);

  // ======= Congelar scroll fondo =======
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

  // ======= Reset índice cuando abre =======
  useEffect(() => {
    if (!isOpen) return;
    setCurrent(startIndex);
    setPrevMedia(null);
    setDirection(0);
    setPhase("idle");
  }, [isOpen, startIndex]);

  const item = items[current];
  const isVideo = item?.type === "video";

  // ======= Autoplay cada vez que cambia current =======
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !item) return;

    if (item.type === "video") {
      vid.pause();
      vid.currentTime = 0;
      vid.muted = false;
      vid.volume = 0.6;
      setIsMuted(false);
      setIsPaused(false);

      const p = vid.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          vid.muted = true;
          setIsMuted(true);
          vid.play().catch(() => {
            setIsPaused(true);
          });
        });
      }
    } else {
      setIsPaused(false);
    }
  }, [current, item]);

  // ======= Disparar transición con 2 fases =======
  function doTransition(nextIndex, dir) {
    if (nextIndex === current) return;

    const old = items[current];
    if (old) {
      setPrevMedia({
        ...old,
        _tmpKey: `${old.id || old.src}-${Date.now()}`,
      });
    } else {
      setPrevMedia(null);
    }

    setDirection(dir);
    setCurrent(nextIndex);

    // colocamos fase prep (posiciones iniciales offscreen / blur)
    setPhase("prep");
  }

  // fase "prep" -> "run" en el próximo frame de render real
  useEffect(() => {
    if (phase !== "prep") return;

    // forzamos doble rAF para asegurar layout antes de cambiar a "run"
    const f1 = requestAnimationFrame(() => {
      const f2 = requestAnimationFrame(() => {
        setPhase("run");

        // cuando termine la animación, limpiamos
        // usando ~360ms para cubrir la duración CSS
        setTimeout(() => {
          setPrevMedia(null);
          setPhase("idle");
        }, 360);
      });
      return () => cancelAnimationFrame(f2);
    });

    return () => cancelAnimationFrame(f1);
  }, [phase]);

  // ======= Navegación =======
  const goNext = useCallback(() => {
    const nextIndex =
      current < items.length - 1 ? current + 1 : current;
    doTransition(nextIndex, 1);
  }, [current, items]);

  const goPrev = useCallback(() => {
    const nextIndex = current > 0 ? current - 1 : current;
    doTransition(nextIndex, -1);
  }, [current, items]);

  // ======= Controles de video =======
  function togglePlayPause() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPaused(false);
    } else {
      v.pause();
      setIsPaused(true);
    }
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  }

  // ======= Teclado global =======
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        videoRef.current?.pause();
        onClose();
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
        return;
      }

      if (e.key === " " || e.key === "Spacebar") {
        if (item && item.type === "video") {
          e.preventDefault();
          togglePlayPause();
        }
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, item, goNext, goPrev, onClose]);

  // ======= Gestos táctiles (swipe ↑ ↓) =======
  const touchStartY = useRef(null);

  function handleTouchStart(e) {
    touchStartY.current = e.touches?.[0]?.clientY ?? null;
  }

  function handleTouchEnd(e) {
    if (touchStartY.current == null) return;
    const diff = e.changedTouches[0].clientY - touchStartY.current;

    if (diff < -50) {
      goNext(); // swipe ↑ dedo sube -> siguiente
    } else if (diff > 50) {
      goPrev(); // swipe ↓ dedo baja -> anterior
    }

    touchStartY.current = null;
  }

  // ======= Clases animación =======
  // Media saliente (prevMedia)
  // - si vas al "siguiente" (direction=1), la anterior se va hacia arriba con blur/scale
  // - si vas al "anterior" (direction=-1), la anterior se va hacia abajo
  const prevLayerBase =
    "absolute inset-0 flex items-center justify-center " +
    "will-change-transform will-change-filter will-change-opacity " +
    "pointer-events-none select-none " +
    "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";

  const prevLayerMotion =
    phase === "run"
      ? direction === 1
        ? "opacity-0 -translate-y-24 scale-[0.96] blur-sm"
        : "opacity-0 translate-y-24 scale-[0.96] blur-sm"
      : // durante prep (1 solo frame) y idle (no se ve)
        "opacity-100 translate-y-0 scale-100 blur-0";

  const prevLayerClasses = `${prevLayerBase} ${prevLayerMotion}`;

  // Media actual (item actual)
  // Fase prep: entra levemente desde la dirección contraria:
  //   si direction===1 (fuiste a siguiente), esta nueva sube desde abajo (+16px)
  //   si direction===-1 (fuiste a anterior), baja desde arriba (-16px)
  // Fase run: ya en posición final
  const currLayerBase =
    "absolute inset-0 flex items-center justify-center " +
    "will-change-transform will-change-filter will-change-opacity " +
    "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]";

  const currLayerMotion =
    phase === "prep"
      ? direction === 1
        ? "opacity-0 translate-y-16 scale-[0.96] blur-[2px]"
        : direction === -1
        ? "opacity-0 -translate-y-16 scale-[0.96] blur-[2px]"
        : "opacity-0 scale-[0.98] blur-[2px]"
      : "opacity-100 translate-y-0 scale-100 blur-0";

  const currLayerClasses = `${currLayerBase} ${currLayerMotion}`;

  // Guard por si no hay item
  if (!isOpen) return null;
  if (!item) return null;

  return (
    <div
      className="
        fixed inset-0 z-[9999]
        bg-black/90 backdrop-blur-sm
        text-white flex flex-col items-center justify-between
        overflow-hidden
      "
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* === Botón Cerrar fijo arriba === */}
      <div className="absolute top-3 right-3 z-50">
        <button
          className="
            text-white/80 hover:text-white
            text-sm md:text-base font-medium
            bg-white/10 hover:bg-white/20
            rounded-lg px-3 py-1.5 border border-white/20
            shadow-md
          "
          onClick={() => {
            videoRef.current?.pause();
            onClose();
          }}
        >
          ✕ Cerrar
        </button>
      </div>

      {/* === Contenido principal === */}
      <div className="flex flex-col items-center justify-center flex-1 px-3 pb-28 pt-12 w-full">
        {/* Viewport del media */}
        <div
          className="
            relative
            bg-black rounded-xl border border-white/10
            max-w-[90vw] w-full
            h-[60vh]
            overflow-hidden
          "
          style={{ marginTop: "3px", marginBottom: "12px" }}
        >
          {/* capa anterior saliendo */}
          {prevMedia && phase !== "idle" && (
            <div className={prevLayerClasses}>
              {prevMedia.type === "video" ? (
                <video
                  src={prevMedia.src}
                  className="object-contain max-h-full max-w-full bg-black"
                  muted
                />
              ) : (
                <img
                  src={prevMedia.src}
                  alt={prevMedia.description || "imagen anterior"}
                  className="object-contain max-h-full max-w-full bg-black select-none"
                  draggable={false}
                />
              )}
            </div>
          )}

          {/* capa actual entrando */}
          <div className={currLayerClasses}>
            {isVideo ? (
              <>
                <video
                  ref={videoRef}
                  src={item.src}
                  className="object-contain max-h-full max-w-full bg-black"
                  controls
                  controlsList="nodownload"
                />
                <div className="absolute bottom-4 left-4 flex gap-2">
                  <button
                    onClick={togglePlayPause}
                    className="
                      bg-black/60 hover:bg-black/80
                      text-white text-xs md:text-sm
                      rounded-md px-2 py-1 border border-white/20
                      shadow-lg shadow-black/60
                    "
                  >
                    {isPaused ? "▶ Reproducir" : "❚❚ Pausa"}
                  </button>
                  <button
                    onClick={toggleMute}
                    className="
                      bg-black/60 hover:bg-black/80
                      text-white text-xs md:text-sm
                      rounded-md px-2 py-1 border border-white/20
                      shadow-lg shadow-black/60
                    "
                  >
                    {isMuted ? "🔇 Silencio" : "🔊 Sonido"}
                  </button>
                </div>
              </>
            ) : (
              <img
                src={item.src}
                alt={item.description || "imagen"}
                className="object-contain max-h-full max-w-full bg-black select-none"
                draggable={false}
              />
            )}
          </div>
        </div>

        {/* Caja descripción / metadatos */}
        <div
          className="
            text-left text-white
            max-w-[90vw] w-full
            bg-black/40 rounded-lg border border-white/10 shadow-md
            p-3
            flex flex-col gap-2
            text-sm leading-relaxed
            max-h-[20vh]
            overflow-hidden
          "
        >
          {/* fila de metadatos */}
          <div className="flex flex-wrap items-center gap-2 text-white/90 font-medium text-xs md:text-sm flex-none">
            {item.tag && (
              <span className="px-2 py-[2px] rounded bg-white/10 border border-white/20 text-[11px] uppercase tracking-wide">
                {item.tag}
              </span>
            )}

            {item.taken_at_formatted && (
              <span className="text-white/60 text-xs">
                {item.taken_at_formatted}
              </span>
            )}

            <span className="text-white/40 text-[11px] select-none">
              ↑ siguiente · ↓ anterior · ESC salir
            </span>
          </div>

          {/* descripción scrolleable */}
          {item.description && (
            <div
              className="
                text-white/80 text-sm md:text-base break-words
                overflow-y-auto
                pr-2
              "
              style={{
                maxHeight: "14vh",
              }}
            >
              {item.description}
            </div>
          )}
        </div>
      </div>

      {/* === Botones navegación fijo abajo === */}
      <div
        className="
          fixed bottom-3 left-0 right-0
          flex justify-center gap-3 px-4 z-[99999]
          pb-[calc(env(safe-area-inset-bottom,0px)+0px)]
        "
      >
        <button
          onClick={goPrev}
          className="
            flex-1 max-w-[160px]
            bg-white/10 hover:bg-white/20
            text-white text-sm font-medium
            rounded-lg px-3 py-2 border border-white/20
            shadow-lg shadow-black/60
          "
        >
          ↓ Anterior
        </button>

        <button
          onClick={goNext}
          className="
            flex-1 max-w-[160px]
            bg-white/10 hover:bg-white/20
            text-white text-sm font-medium
            rounded-lg px-3 py-2 border border-white/20
            shadow-lg shadow-black/60
          "
        >
          ↑ Siguiente
        </button>
      </div>
    </div>
  );
}
