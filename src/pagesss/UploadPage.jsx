import { useState } from "react";
import { uploadMedia } from "../api";

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [takenAt, setTakenAt] = useState("");
  const [description, setDescription] = useState("");
  const [tag, setTag] = useState("L");
  const [status, setStatus] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("Subiendo...");

    try {
      await uploadMedia({
        file,
        taken_at: takenAt,
        description,
        tag,
      });
      setStatus("✅ Subido correctamente");
      // limpiar form
      setFile(null);
      setTakenAt("");
      setDescription("");
      setTag("L");
    } catch (err) {
      console.error(err);
      setStatus("❌ Error al subir");
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Agregar foto / video</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-neutral-800 p-4 rounded-xl space-y-4"
      >
        <div>
          <label className="block text-sm text-neutral-400 mb-1">
            Archivo (imagen o video)
          </label>
          <input
            type="file"
            accept="image/*,video/*"
            className="block w-full text-sm text-neutral-300"
            onChange={(e) => setFile(e.target.files[0] || null)}
            required
          />
        </div>

        <div>
          <label className="block text-sm text-neutral-400 mb-1">
            Fecha del recuerdo
          </label>
          <input
            type="date"
            className="bg-neutral-900 rounded-lg px-3 py-2 w-full"
            value={takenAt}
            onChange={(e) => setTakenAt(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm text-neutral-400 mb-1">
            Descripción (opcional)
          </label>
          <textarea
            className="bg-neutral-900 rounded-lg px-3 py-2 w-full text-sm min-h-[80px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="¿Qué pasó en este momento?"
          />
        </div>

        <div>
          <label className="block text-sm text-neutral-400 mb-1">
            Etiqueta
          </label>
          <select
            className="bg-neutral-900 rounded-lg px-3 py-2 w-full"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            required
          >
            <option value="B">B</option>
            <option value="D">D</option>
            <option value="BD">BD</option>
          </select>
          <p className="text-xs text-neutral-500 mt-1">
            Estas etiquetas luego sirven para filtrar en la galería.
          </p>
        </div>

        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 transition rounded-lg px-4 py-2 font-medium w-full"
        >
          Subir
        </button>

        {status && (
          <div className="text-sm text-neutral-300 text-center">{status}</div>
        )}
      </form>
    </div>
  );
}
