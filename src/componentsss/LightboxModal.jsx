import { useState, useEffect, useRef } from "react";

export default function LightboxModal({
  isOpen,
  items,          // array [{ id, src, type, taken_at, description, ... }, ...]
  startIndex = 0, // índice inicial
  onClose,
}) {
  const [index, setIndex] = useState(startIndex);
  const [offsetX, setOffsetX] = useState(0);   // swipe horizontal (px)
  const [offsetY, setOffsetY] = useState(0);   // swipe vertical para cerrar
  const [closing, setClosing] = useState(false);

  const touchStartRef = useRef({ x: 0, y: 0, active: false });

  // cuando abres de nuevo, asegúrate de posicionar correctamente
  useEffect(() => {
    if (isOpen) {
      setIndex(startIndex);
      setOffsetX(0);
      setOffsetY(0);
      setClosing(false);
    }
  }, [isOpen, startIndex]);

  if (!isOpen) return null;

  const current = items[index];

  // helpers
  function goPrev() {
    if (index > 0) {
      setIndex((i) => i - 1);
    }
  }

  function goNext() {
    if (index < items.length - 1) {
      setIndex((i) => i + 1);
    }
  }

  // TOUCH HANDLERS
  function handleTouchStart(e) {
    const t = e.touches[0];
    touchStartRef.current = {
      x: t.clientX,
      y: t.clientY,
      active: true,
    };
    setOffsetX(0);
    setOffsetY(0);
  }

  function handleTouchMove(e) {
    if (!touchStartRef.current.active) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;

    // si la intención es cerrar (vertical dominante), damos prioridad al Y
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDy > absDx && absDy > 10) {
      // gesto vertical
      setOffsetY(dy);
      setOffsetX(0); // bloquea horizontal si ya decidiste bajar
    } else {
      // gesto horizontal
      setOffsetX(dx);
      setOffsetY(0);
    }
  }

  function handleTouchEnd() {
    touchStartRef.current.active = false;

    // --- swipe vertical para cerrar ---
    if (Math.abs(offsetY) > 100) {
      // animación de desvanecer y luego cerrar
      setClosing(true);
      // pequeño timeout solo para que se vea fade
      setTimeout(() => {
        onClose();
        setClosing(false);
        setOffsetY(0);
      }, 150);
      return;
    }

    // --- swipe horizontal para cambiar de item ---
    if (offsetX > 80) {
      // swipe derecha => ir al anterior
      goPrev();
    } else if (offsetX < -80) {
      // swipe izquierda => ir al siguiente
      goNext();
    }

    // reset del desplazamiento visual
    setOffsetX(0);
    setOffsetY(0);
  }

  // estilos dinámicos para la animación / posición
  const translateStyle = {
    transform: `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${closing ? 0.9 : 1})`,
    transition: touchStartRef.current.active ? "none" : "transform 0.15s ease",
  };

  const bgOpacity =
    touchStartRef.current.active && Math.abs(offsetY) > 0
      ? Math.max(0, 1 - Math.abs(offsetY) / 200)
      : 1;

  const isVideo =
    current?.type === "video" ||
    (current?.src || "")
      .toLowerCase()
      .match(/\.(mp4|mov|webm)$/);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/90 md:bg-black/80"
      style={{
        backgroundColor: `rgba(0,0,0,${0.9 * bgOpacity})`,
        transition: touchStartRef.current.active ? "none" : "background-color 0.15s ease",
      }}
    >
      {/* top bar / cerrar manual */}
      <div className="flex items-center justify-between px-4 py-3 text-neutral-200 text-sm select-none">
        <button
          className="px-3 py-1 rounded-lg bg-neutral-800/60 border border-neutral-700 text-[13px] font-medium active:scale-95"
          onClick={onClose}
        >
          Cerrar
        </button>

        <div className="text-[12px] text-neutral-400">
          {index + 1} / {items.length}
        </div>
      </div>

      {/* contenido central con swipe */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-4 pb-6 select-none touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="max-h-[70vh] max-w-[90vw] w-full flex flex-col items-center justify-center rounded-xl overflow-hidden border border-neutral-700 bg-black/30 shadow-xl"
          style={translateStyle}
        >
          {isVideo ? (
            <video
              src={current?.src}
              className="w-full max-h-[70vh] object-contain bg-black"
              controls
              autoPlay={false}
            />
          ) : (
            <img
              src={current?.src}
              alt={current?.description || ""}
              className="w-full max-h-[70vh] object-contain bg-black"
            />
          )}
        </div>

        {/* descripción / fecha / tag debajo */}
        <div className="mt-4 w-full max-w-[90vw] text-center text-neutral-100 text-xs leading-relaxed">
          <div className="font-medium text-neutral-50 text-sm">
            {current?.description || "Sin descripción"}
          </div>

          <div className="text-[11px] text-neutral-400 mt-1 flex items-center justify-center gap-2 flex-wrap">
            <span className="px-2 py-[2px] rounded-lg bg-neutral-800/70 border border-neutral-700 text-[10px] font-medium tracking-wide">
              {current?.tag ?? "—"}
            </span>

            <span>
              {current?.taken_at_formatted ??
                current?.taken_at ??
                ""}
            </span>
          </div>
        </div>
      </div>

      {/* botones prev/next visibles en desktop/tablet pero opcionales en touch */}
      <div className="hidden md:flex items-center justify-between px-4 pb-6 text-neutral-200 text-sm">
        <button
          disabled={index === 0}
          onClick={goPrev}
          className="px-3 py-1 rounded-lg bg-neutral-800/60 border border-neutral-700 text-[13px] font-medium disabled:opacity-30 active:scale-95"
        >
          ← Anterior
        </button>
        <button
          disabled={index === items.length - 1}
          onClick={goNext}
          className="px-3 py-1 rounded-lg bg-neutral-800/60 border border-neutral-700 text-[13px] font-medium disabled:opacity-30 active:scale-95"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
