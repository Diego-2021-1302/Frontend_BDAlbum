import { useState, useEffect, useRef } from "react";

export default function ReelsViewer({
  isOpen,
  items,          // [{id, src, type, description, tag, taken_at_formatted, taken_at}]
  startIndex = 0, // índice inicial
  onClose,
}) {
  const [index, setIndex] = useState(startIndex);

  // gesto táctil
  const touchStartRef = useRef({ x: 0, y: 0, active: false });
  const [dragY, setDragY] = useState(0); // arrastre vertical en vivo
  const [dragX, setDragX] = useState(0); // arrastre horizontal en vivo (para cerrar)

  // animación controlada cuando pasamos al siguiente/anterior con transición
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState(0); // -1 = subir (siguiente), 1 = bajar (anterior)

  // autoplay video ref del reel actual
  const videoRef = useRef(null);

  // referencia al contenedor para animación de cerrar horizontal
  const containerRef = useRef(null);

  const SWIPE_NEXT_THRESHOLD = 100;      // vertical px para cambiar reel
  const SWIPE_CLOSE_THRESHOLD = 100;     // horizontal px para cerrar
  const TRANSITION_MS = 180;             // duración de las animaciones en ms

  // sincroniza index cuando abres el viewer
  useEffect(() => {
    if (isOpen) {
      setIndex(startIndex);
      setDragY(0);
      setDragX(0);
      setDirection(0);
      setAnimating(false);
    }
  }, [isOpen, startIndex]);

  // cada vez que cambia el index (o termina una animación), intenta reproducir
  useEffect(() => {
    // reset drag al cambiar
    setDragY(0);
    setDragX(0);
    setDirection(0);
    setAnimating(false);

    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [index]);

  if (!isOpen) return null;

  // helpers para saber qué mostrar
  const current = items[index];
  const prev = index > 0 ? items[index - 1] : null;
  const next = index < items.length - 1 ? items[index + 1] : null;

  const isVideoCurrent =
    current?.type === "video" ||
    (current?.src || "").toLowerCase().match(/\.(mp4|mov|webm)$/);

  // Lógica de navegación con animación suave (pc buttons o swipe)
  function goNextAnimated() {
    if (!next) return;
    // vamos hacia arriba => siguiente reel
    setDirection(-1); // -1 = sube el actual, entra el de abajo
    setAnimating(true);

    // dejamos que la transición corra y luego cambiamos el index
    setTimeout(() => {
      setIndex((i) => i + 1);
    }, TRANSITION_MS);
  }

  function goPrevAnimated() {
    if (!prev) return;
    // vamos hacia abajo => reel anterior
    setDirection(1); // 1 = baja el actual, entra el de arriba
    setAnimating(true);

    setTimeout(() => {
      setIndex((i) => i - 1);
    }, TRANSITION_MS);
  }

  // TOUCH HANDLERS
  function handleTouchStart(e) {
    if (animating) return;
    const t = e.touches[0];
    touchStartRef.current = {
      x: t.clientX,
      y: t.clientY,
      active: true,
    };
  }

  function handleTouchMove(e) {
    if (!touchStartRef.current.active || animating) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // gesto cerrar (horizontal dominante hacia la derecha)
    if (dx > 0 && absDx > absDy) {
      setDragX(dx);
      // aplicamos transformación al contenedor completo
      if (containerRef.current) {
        containerRef.current.style.transform = `translate3d(${dx}px,0,0)`;
        containerRef.current.style.opacity = `${Math.max(
          0,
          1 - dx / 200
        )}`;
      }
      return;
    }

    // gesto vertical (cambiar reel tipo TikTok/Reels)
    if (absDy >= absDx) {
      setDragY(dy);
    }
  }

  function handleTouchEnd() {
    if (!touchStartRef.current.active || animating) return;
    touchStartRef.current.active = false;

    // 1. cerrar con swipe fuerte a la derecha
    if (dragX > SWIPE_CLOSE_THRESHOLD && Math.abs(dragX) > Math.abs(dragY)) {
      // animación de salida
      if (containerRef.current) {
        containerRef.current.style.transition = `all ${TRANSITION_MS}ms ease`;
        containerRef.current.style.transform = "translate3d(100%,0,0)";
        containerRef.current.style.opacity = "0";
        setTimeout(() => {
          // cleanup
          if (containerRef.current) {
            containerRef.current.style.transition = "";
            containerRef.current.style.transform = "";
            containerRef.current.style.opacity = "";
          }
          onClose();
        }, TRANSITION_MS);
      } else {
        onClose();
      }
      return;
    }

    // 2. swipe vertical suficiente => next / prev con animación
    if (dragY < -SWIPE_NEXT_THRESHOLD && next) {
      // arriba -> siguiente reel
      goNextAnimated();
      return;
    }
    if (dragY > SWIPE_NEXT_THRESHOLD && prev) {
      // abajo -> reel anterior
      goPrevAnimated();
      return;
    }

    // 3. si no hubo cambio => resetear posiciones con pequeña transición
    resetDragSmooth();
  }

  function resetDragSmooth() {
    // pequeña animación para volver a su sitio
    setAnimating(true);
    setDirection(0);

    // usamos un timeout corto para "volver" y luego apagar animating
    setTimeout(() => {
      setAnimating(false);
      setDragY(0);
      setDragX(0);

      // limpiar transform/opacity del contenedor
      if (containerRef.current) {
        containerRef.current.style.transition = "";
        containerRef.current.style.transform = "";
        containerRef.current.style.opacity = "";
      }
    }, TRANSITION_MS);
  }

  // === TRANSFORMACIONES VISUALES ===
  // Vamos a calcular translateY de prev / current / next basados en:
  //   - dragY (durante swipe)
  //   - direction y animating (cuando ya decidimos avanzar/retroceder)
  //
  // Estados:
  // - arrastrando: direction === 0 && !animating
  //   current => translateY(dragY)
  //   prev    => translateY(-100% + dragY) [aparece desde arriba cuando bajas]
  //   next    => translateY(100% + dragY) [aparece desde abajo cuando subes]
  //
  // - animando para ir next (direction === -1)
  //   current => se va hacia arriba (-100%)
  //   next    => entra desde abajo (0%)
  //
  // - animando para ir prev (direction === 1)
  //   current => se va hacia abajo (100%)
  //   prev    => entra desde arriba (0%)

  function getSlideStyle(which) {
    // which: "prev" | "current" | "next"
    let translateY = 0;

    if (animating) {
      if (direction === -1) {
        // vamos al siguiente (arriba)
        if (which === "current") {
          translateY = -100;
        } else if (which === "next") {
          translateY = 0;
        } else if (which === "prev") {
          translateY = -100; // fuera de vista
        }
      } else if (direction === 1) {
        // vamos al anterior (abajo)
        if (which === "current") {
          translateY = 100;
        } else if (which === "prev") {
          translateY = 0;
        } else if (which === "next") {
          translateY = 100; // fuera de vista
        }
      } else {
        // animating pero direction === 0 => reset drag a 0
        if (which === "current") {
          translateY = 0;
        } else if (which === "prev") {
          translateY = -100;
        } else if (which === "next") {
          translateY = 100;
        }
      }
    } else {
      // no animating: seguimos el dedo
      if (which === "current") {
        translateY = (dragY / window.innerHeight) * 100;
      } else if (which === "prev") {
        // prev está arriba. Cuando arrastras hacia abajo (dragY>0) baja.
        translateY = -100 + (dragY / window.innerHeight) * 100;
      } else if (which === "next") {
        // next está abajo. Cuando arrastras hacia arriba (dragY<0) sube.
        translateY = 100 + (dragY / window.innerHeight) * 100;
      }
    }

    // transición
    const transition = animating
      ? `transform ${TRANSITION_MS}ms ease`
      : "none";

    return {
      transform: `translate3d(0, ${translateY}%, 0)`,
      transition,
    };
  }

  // opacity del fondo para dar ese efecto "arrastro"
  const bgOpacity = animating
    ? 1
    : 1 - Math.min(Math.abs(dragY) / 300, 0.5); // se aclara un chin cuando jalas

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-black">
      {/* contenedor que se puede arrastrar horizontalmente para cerrar */}
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden touch-none text-white"
        style={{
          backgroundColor: `rgba(0,0,0,${bgOpacity})`,
transition: animating
  ? `background-color ${TRANSITION_MS}ms ease`
  : "none",

        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* SLIDES apilados (prev / current / next) */}
        {/* prev */}
        {prev && (
          <SlideContent
            data={prev}
            isVideo={
              prev.type === "video" ||
              (prev.src || "").toLowerCase().match(/\.(mp4|mov|webm)$/)
            }
            style={getSlideStyle("prev")}
            muted
          />
        )}

        {/* current */}
        <SlideContent
          data={current}
          isVideo={isVideoCurrent}
          style={getSlideStyle("current")}
          videoRef={videoRef}
          autoPlay
          loop
          muted
          highlightInfo
          index={index}
          total={items.length}
        />

        {/* next */}
        {next && (
          <SlideContent
            data={next}
            isVideo={
              next.type === "video" ||
              (next.src || "").toLowerCase().match(/\.(mp4|mov|webm)$/)
            }
            style={getSlideStyle("next")}
            muted
          />
        )}

        {/* BOTÓN CERRAR (siempre visible) */}
        <button
          className="absolute top-4 right-4 z-20 px-3 py-1 rounded-lg bg-black/60 border border-white/20 text-[13px] font-medium text-white active:scale-95"
          onClick={onClose}
        >
          ✕
        </button>

        {/* CONTROLES DESKTOP: previo / siguiente */}
        <div className="hidden md:flex flex-col items-center justify-center absolute left-4 top-1/2 -translate-y-1/2 z-20 gap-3">
          <button
            className="px-3 py-2 rounded-lg bg-black/60 border border-white/20 text-[13px] font-semibold text-white active:scale-95 disabled:opacity-30"
            onClick={goPrevAnimated}
            disabled={!prev || animating}
          >
            ↑ Anterior
          </button>
          <button
            className="px-3 py-2 rounded-lg bg-black/60 border border-white/20 text-[13px] font-semibold text-white active:scale-95 disabled:opacity-30"
            onClick={goNextAnimated}
            disabled={!next || animating}
          >
            ↓ Siguiente
          </button>
        </div>

        {/* también podemos poner un hint abajo en desktop */}
        <div className="hidden md:flex absolute bottom-4 left-1/2 -translate-x-1/2 z-20 text-[11px] text-neutral-300 bg-black/60 border border-white/20 rounded-full px-3 py-1">
          Usa ↑ ↓ o arrastra en móvil
        </div>
      </div>
    </div>
  );
}

// Componente interno para cada slide
function SlideContent({
  data,
  isVideo,
  style,
  videoRef,
  autoPlay = false,
  loop = false,
  muted = false,
  highlightInfo = false,
  index,
  total,
}) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={style}
    >
      {isVideo ? (
        <video
          ref={videoRef}
          src={data?.src}
          className="w-full h-full object-contain max-h-screen max-w-screen bg-black"
          autoPlay={autoPlay}
          muted={muted}
          loop={loop}
          playsInline
          controls={false}
        />
      ) : (
        <img
          src={data?.src}
          className="w-full h-full object-contain max-h-screen max-w-screen bg-black"
          alt={data?.description || ""}
        />
      )}

      {/* overlay info solo en el slide actual */}
      {highlightInfo && (
        <div className="absolute inset-x-0 bottom-0 p-4 pt-12 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-left">
          <div className="text-[13px] leading-relaxed text-neutral-100 font-medium break-words">
            {data?.description || "Sin descripción"}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-2 flex-wrap">
            <span className="bg-white/10 text-white px-2 py-[2px] rounded-md text-[10px] font-semibold border border-white/20">
              {data?.tag ?? "—"}
            </span>

            <span className="text-neutral-300/80">
              {data?.taken_at_formatted ?? data?.taken_at ?? ""}
            </span>

            {typeof index === "number" && typeof total === "number" && (
              <span className="text-neutral-500">
                {index + 1}/{total}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
