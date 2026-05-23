export default function MediaCarousel({ items, onOpen }) {
  // items: array de media de esa fecha
  // onOpen(index) → abre modal en ese index

  return (
    <div className="w-full">
      <div className="flex gap-4 overflow-x-auto scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-neutral-900 snap-x snap-mandatory pb-4">
        {items.map((m, idx) => (
          <button
            key={m.id}
            className="flex-shrink-0 w-[250px] md:w-[320px] snap-start bg-neutral-800 rounded-xl overflow-hidden border border-neutral-700 text-left focus:outline-none hover:brightness-110 transition"
            onClick={() => onOpen(idx)}
          >
            <div className="bg-black aspect-video flex items-center justify-center">
              {m.type === "image" ? (
                <img
                  src={m.src}
                  alt={m.description || "media"}
                  className="object-cover w-full h-full"
                />
              ) : (
                <video
                  src={m.src}
                  className="object-cover w-full h-full"
                  muted
                />
              )}
            </div>

            <div className="p-3 text-xs text-neutral-300 space-y-2">
              <div className="flex items-center justify-between text-neutral-400 text-[11px]">
                <span className="font-semibold text-neutral-200">
                  {m.tag}
                </span>
                <span className="text-neutral-500">{m.taken_at}</span>
              </div>

              {m.description && (
                <p className="text-neutral-400 line-clamp-2 leading-relaxed text-[12px] min-h-[2.5rem]">
                  {m.description}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
