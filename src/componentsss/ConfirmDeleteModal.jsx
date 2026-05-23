export default function ConfirmDeleteModal({
  isOpen,
  onCancel,
  onConfirm,
  loading,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-neutral-800 border border-neutral-700 rounded-xl w-full max-w-sm p-5 text-neutral-100 shadow-2xl">
        <h2 className="text-lg font-semibold mb-3 text-red-400">
          ¿Eliminar este recuerdo?
        </h2>
        <p className="text-sm text-neutral-300 leading-relaxed mb-5">
          Esto borrará el archivo físico y la información asociada. No se puede deshacer.
        </p>

        <div className="flex flex-col gap-3 text-sm">
          <button
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg px-4 py-2 font-medium text-white"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Eliminando..." : "Sí, eliminar"}
          </button>
          <button
            className="w-full bg-neutral-700 hover:bg-neutral-600 rounded-lg px-4 py-2 font-medium text-neutral-100"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
