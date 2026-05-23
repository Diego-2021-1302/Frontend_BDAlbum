import { useState, useEffect } from "react";

export default function MediaFormModal({
  isOpen,
  mode, // "create" | "edit"
  initialData, // item cuando editas
  onClose,
  onSubmit, // async (payload, onProgressCb?) => void
}) {
  const [file, setFile] = useState(null);

  // ⭐ previewURL = lo que mostramos arriba (imagen/video)
  const [previewURL, setPreviewURL] = useState("");

  const [takenAt, setTakenAt] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("L");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // progreso visual de subida
  const [progress, setProgress] = useState(0);

  // ⭐ helper: convertir cualquier fecha del backend al formato YYYY-MM-DD
  function toDateInputString(raw) {
  if (!raw) return "";
  // acepta "2025-10-30" o "2025-10-30T03:29:46.000000Z"
  return String(raw).slice(0,10);
}

  // ⭐ detectar si el preview actual parece video
  function looksLikeVideo(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
      lower.endsWith(".mp4") ||
      lower.endsWith(".mov") ||
      lower.endsWith(".webm") ||
      lower.includes("video")
    );
  }

  // cargar valores cuando abres
  useEffect(() => {
    if (isOpen) {
      setError("");
      setSaving(false);
      setProgress(0);

      if (mode === "edit" && initialData) {
        // no hay archivo nuevo aún
        setFile(null);

        // ⭐ usamos la fecha formateada
        setTakenAt(toDateInputString(initialData.taken_at) || "");

        setDescription(initialData.description || "");
        setTag(initialData.tag || "B");

        // ⭐ usamos el media actual que ya tienes calculado en GalleryPage (ej: m.src)
        setPreviewURL(initialData.src || "");
      } else {
        // modo create -> limpio todo
        setFile(null);
        setTakenAt("");
        setDescription("");
        setTag("B");
        setPreviewURL("");
      }
    }
  }, [isOpen, mode, initialData]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setProgress(0);

    try {
      await onSubmit(
        {
          file,
          taken_at: takenAt,
          description,
          tag,
        },
        // callback progreso (lo usas en create para % real de subida)
        (pct) => {
          setProgress(pct);
        }
      );

      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  // ⭐ cuando el user selecciona un archivo nuevo, actualizamos file y preview
  function handleFileChange(ev) {
    const f = ev.target.files?.[0] || null;
    setFile(f);

    if (f) {
      // preview local temporal
      const url = URL.createObjectURL(f);
      setPreviewURL(url);
    } else {
      // si borró la selección volvemos al original si estamos editando
      if (mode === "edit" && initialData?.src) {
        setPreviewURL(initialData.src);
      } else {
        setPreviewURL("");
      }
    }
  }

  const isVideo = looksLikeVideo(previewURL);

  return (
    <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-neutral-800 border border-neutral-700 rounded-xl w-full max-w-md p-5 text-neutral-100 shadow-2xl relative">
        <button
          className="absolute top-3 right-3 text-neutral-400 hover:text-white text-sm font-medium"
          onClick={onClose}
          disabled={saving}
        >
          ✕
        </button>

        <h2 className="text-lg font-semibold mb-4">
          {mode === "edit" ? "Editar elemento" : "Agregar foto / video"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {/* PREVIEW ACTUAL ⭐ */}
          {previewURL && (
            <div className="w-full flex justify-center">
              {isVideo ? (
                <video
                  src={previewURL}
                  className="max-h-48 rounded-lg border border-neutral-700"
                  controls
                />
              ) : (
                <img
                  src={previewURL}
                  alt="preview"
                  className="max-h-48 rounded-lg border border-neutral-700 object-contain"
                />
              )}
            </div>
          )}

          {/* ARCHIVO */}
          <div className="space-y-2">
            <label className="block text-neutral-300 font-medium">
              Archivo {mode === "edit" ? "(opcional)" : "(requerido)"}
            </label>
            <input
              type="file"
              accept="image/*,video/*"
              className="block w-full text-neutral-200
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-lg file:border-0
                       file:text-sm file:font-medium
                       file:bg-pink-900/70 file:text-white
                       hover:file:bg-pink-700/70
                       bg-neutral-900 rounded-lg px-3 py-2 border border-neutral-700"
              onChange={handleFileChange}
              required={mode !== "edit"}
            />

            {mode === "edit" && initialData?.src && (
              <p className="text-[11px] text-neutral-500">
                Actualmente: {initialData.type === "image" ? "Imagen" : "Video"}
              </p>
            )}
          </div>

          {/* FECHA */}
          <div className="space-y-2">
            <label className="block text-neutral-300 font-medium">
              Fecha del recuerdo
            </label>
            <input
              type="date"
              className="bg-neutral-900 text-neutral-100 rounded-lg px-3 py-2 w-full border border-neutral-700"
              value={takenAt}
              onChange={(ev) => setTakenAt(ev.target.value)}
              required
            />
          </div>

          {/* DESCRIPCIÓN */}
          <div className="space-y-2">
            <label className="block text-neutral-300 font-medium">
              Descripción
            </label>
            <textarea
              className="bg-neutral-900 text-neutral-100 rounded-lg px-3 py-2 w-full min-h-[70px] border border-neutral-700"
              value={description}
              onChange={(ev) => setDescription(ev.target.value)}
              placeholder="¿Qué pasó en este momento?"
            />
          </div>

          {/* ETIQUETA */}
          <div className="space-y-2">
            <label className="block text-neutral-300 font-medium">
              Etiqueta
            </label>
            <select
              className="bg-neutral-900 text-neutral-100 rounded-lg px-3 py-2 w-full border border-neutral-700"
              value={tag}
              onChange={(ev) => setTag(ev.target.value)}
              required
            >
              <option value="B">B</option>
              <option value="D">D</option>
              <option value="BD">BD</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-pink-900/70 hover:bg-pink-700/70 disabled:opacity-50 rounded-lg px-4 py-2 font-medium text-white text-sm"
          >
            {saving
              ? mode === "edit"
                ? "Guardando..."
                : "Subiendo..."
              : mode === "edit"
              ? "Guardar cambios"
              : "Subir"}
          </button>

          {/* barra de progreso */}
          {saving && (
            <div className="w-full">
              <div className="text-[11px] text-neutral-400 text-center mb-1">
                {mode === "edit"
                  ? "Procesando..."
                  : `Subiendo... ${progress.toFixed(0)}%`}
              </div>
              <div className="w-full h-2 bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-pink-700/70 transition-all duration-100"
                  style={{ width: `${mode === "edit" ? 100 : progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="text-center text-red-400 text-xs">{error}</div>
          )}
        </form>
      </div>
    </div>
  );
}
  