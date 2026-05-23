import { useEffect, useState, useMemo, useRef } from "react";
import ReelsViewer from "../components/ReelsViewer.jsx";
import {
  fetchMedia,
  buildFileURL,
  uploadMediaWithProgress,
  updateMedia,
  deleteMedia,
} from "../api";

import MediaFormModal from "../components/MediaFormModal.jsx";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal.jsx";

export default function GalleryPage() {
  // data que viene del backend
  const [rawItems, setRawItems] = useState([]);

  // filtros
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [tag, setTag] = useState("");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(false);

  // ----- estado modales CRUD -----
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState("create"); // "create" | "edit"
  const [editingItem, setEditingItem] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // ----- estado reels viewer (tipo Instagram Reels / TikTok) -----
  const [showReels, setShowReels] = useState(false);
  const [reelsIndex, setReelsIndex] = useState(0);

  // formatear fecha a DD-MM-YYYY desde string tipo "2025-10-30T00:00:00.000000Z"
  function formatDateDMY(value) {
    if (!value) return "";
    const d = new Date(value);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const yearFull = d.getFullYear();
    return `${day}-${month}-${yearFull}`;
  }

  // cargar data desde API
  async function load() {
    setLoading(true);
    try {
      // fetchMedia debe aceptar { year, tag, q }
      const data = await fetchMedia({ year, tag, q });

      const normalized = data.map((m) => ({
        ...m,
        src: buildFileURL(m.file_path),
        taken_at_formatted: formatDateDMY(m.taken_at),
      }));

      setRawItems(normalized);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // se carga 1 vez al entrar

  // Agrupar por mes SOLO si pertenece al año filtrado.
  // Resultado: array [{ monthNum, monthName, items:[...] }, ...] SIN meses vacíos
  const itemsByMonth = useMemo(() => {
    const monthNames = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];

    const map = {};

    for (const item of rawItems) {
      if (!item.taken_at) continue;
      const d = new Date(item.taken_at);
      const y = d.getFullYear();
      const m = d.getMonth(); // 0..11

      if (String(y) !== String(year)) continue;

      if (!map[m]) {
        map[m] = {
          monthNum: m,
          monthName: monthNames[m],
          items: [],
        };
      }

      map[m].items.push(item);
    }

    // ordenar cada bucket por id desc (recientes primero dentro del mes)
    Object.values(map).forEach((bucket) => {
      bucket.items.sort((a, b) => b.id - a.id);
    });

    // devolver ordenado por mes asc (enero -> dic)
    return Object.values(map).sort((a, b) => a.monthNum - b.monthNum);
  }, [rawItems, year]);

  // 🔥 allVisibleItems:
  // Esta lista lineal es la que vamos a pasarle al ReelsViewer.
  // Básicamente concatenamos todos los monthBlock.items en orden de itemsByMonth.
  // Importante: mantenemos cada objeto con lo necesario para ver en pantalla completa.
  const allVisibleItems = useMemo(() => {
    const flat = [];
    for (const block of itemsByMonth) {
      for (const it of block.items) {
        flat.push(it);
      }
    }
    return flat;
  }, [itemsByMonth]);

  // abrir modal crear
  function openCreateModal() {
    setFormMode("create");
    setEditingItem(null);
    setShowFormModal(true);
  }

  // abrir modal editar
  function openEditModal(item) {
    setFormMode("edit");
    setEditingItem(item);
    setShowFormModal(true);
  }

  // cerrar modal form
  function closeFormModal() {
    setShowFormModal(false);
  }

  // submit crear/editar
  async function handleSubmitForm(payload, onProgressCb) {
    const { file, taken_at, description, tag } = payload;

    if (formMode === "create") {
      // creación con progreso
      await uploadMediaWithProgress({
        file,
        taken_at,
        description,
        tag,
        onProgress: (pct) => {
          if (onProgressCb) onProgressCb(pct);
        },
      });
    } else {
      // edición existente
      await updateMedia({
        id: editingItem.id,
        file,
        taken_at,
        description,
        tag,
      });
    }

    await load();
  }

  // eliminar flow
  function askDelete(item) {
    setDeletingItem(item);
    setShowDeleteModal(true);
  }

  function cancelDelete() {
    setShowDeleteModal(false);
  }

  async function confirmDelete() {
    if (!deletingItem) return;
    setDeletingLoading(true);
    try {
      await deleteMedia(deletingItem.id);
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingLoading(false);
      setShowDeleteModal(false);
    }
  }

  // ---- Reels handlers ----
  // Cuando el usuario toca un card específico, queremos abrir el viewer
  // posicionado justo en ese item dentro de allVisibleItems.
  function openReelsAt(item) {
    // buscamos el índice global del item cliqueado
    const idx = allVisibleItems.findIndex((it) => it.id === item.id);
    if (idx >= 0) {
      setReelsIndex(idx);
      setShowReels(true);
    }
  }

  return (
    <div className="relative min-h-screen bg-stone-950 text-neutral-100 p-6 flex flex-col gap-8 max-w-7xl mx-auto pb-24">
      {/* HEADER / PORTADA */}
      <section className="space-y-4">
        <div className="relative bg-gradient-to-b from-pink-900/70 via-neutral-900/80 to-black text-center rounded-3xl shadow-2xl overflow-hidden p-10 border border-white/10 font-sans">
          <div className="relative z-10 flex flex-col items-center gap-6">
            <h1 className="text-5xl md:text-6xl font-script text-white drop-shadow-lg tracking-wide">
              Lili y Diego
            </h1>
            <p className="text-neutral-300 text-lg font-light">
              Una colección de momentos juntos
            </p>

            <div className="flex items-center justify-center gap-6 mt-4">
              <img
                src="/images/Loto.png"
                alt="Logo 1"
                className="w-20 h-20 object-contain drop-shadow-md"
              />
              <img
                src="/images/ghost.png"
                alt="Logo 2"
                className="w-20 h-20 object-contain drop-shadow-md"
              />
            </div>

            <p className="mt-6 text-pink-200 italic text-sm md:text-base font-light tracking-wide">
              “La historia de una flor y su jardinero”
            </p>
          </div>
        </div>
      </section>

      {/* GALERÍA POR MES */}
      <section className="space-y-10">
        {loading ? (
          <div className="text-neutral-400 text-sm">Cargando...</div>
        ) : itemsByMonth.length === 0 ? (
          <div className="text-neutral-500 text-sm">
            No hay resultados con esos filtros.
          </div>
        ) : (
          itemsByMonth.map((monthBlock) => (
            <div key={monthBlock.monthNum} className="space-y-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-medium text-neutral-100">
                  {monthBlock.monthName} {year}
                </h2>
                <div className="text-[11px] text-neutral-500 uppercase tracking-wide font-semibold">
                  {monthBlock.items.length}{" "}
                  {monthBlock.items.length === 1 ? "archivo" : "archivos"}
                </div>
              </div>

              {/* grid de cards */}
              <div
                className="
                  grid
                  grid-cols-2
                  sm:grid-cols-3
                  md:grid-cols-4
                  lg:grid-cols-5
                  xl:grid-cols-6
                  gap-4
                "
              >
                {monthBlock.items.map((m) => (
                  <GalleryCard
                    key={m.id}
                    item={m}
                    onEdit={() => openEditModal(m)}
                    onDelete={() => askDelete(m)}
                    onOpenFull={() => openReelsAt(m)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* CONTROLES DE FILTRO */}
      <div className="bg-emerald-900/70 border border-neutral-800 rounded-xl p-4 flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
        {/* filtro texto */}
        <div className="flex flex-col w-full md:w-[200px]">
          <label className="text-xs text-neutral-400 mb-1">Buscar texto</label>
          <input
            type="text"
            placeholder="Ej: playa, cumple..."
            className="bg-neutral-900 text-neutral-100 rounded-lg px-3 py-2 w-full border border-neutral-700 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* filtro etiqueta */}
        <div className="flex flex-col w-full md:w-[120px]">
          <label className="text-xs text-neutral-400 mb-1">Etiqueta</label>
          <select
            className="bg-neutral-900 text-neutral-100 rounded-lg px-3 py-2 w-full border border-neutral-700 text-sm"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="">Todas</option>
            <option value="L">L</option>
            <option value="D">D</option>
            <option value="LD">LD</option>
          </select>
        </div>

        {/* filtro año */}
        <div className="flex flex-col w-full md:w-[120px]">
          <label className="text-xs text-neutral-400 mb-1">Año</label>
          <input
            type="number"
            className="bg-neutral-900 text-neutral-100 rounded-lg px-3 py-2 w-full border border-neutral-700 text-sm"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min="1900"
            max="2100"
          />
        </div>

        {/* aplicar */}
        <div className="flex flex-col w-full md:w-auto md:flex-1 md:justify-end">
          <button
            onClick={load}
            className="bg-pink-900/70 hover:bg-pink-700/70 transition rounded-lg px-4 py-2 font-medium text-sm text-center w-full md:w-auto"
          >
            Aplicar filtros
          </button>
        </div>
      </div>

      {/* FAB flotante subir */}
      <button
        onClick={openCreateModal}
        className="
          fixed
          bottom-6 right-6
          bg-pink-900/70 hover:bg-pink-700/70
          text-rose-500 text-2xl leading-none
          w-14 h-14 rounded-full
          flex items-center justify-center
          shadow-xl shadow-bg-pink-900
          border border-black/20
        "
      >
        +
      </button>

      {/* MODAL crear/editar */}
      <MediaFormModal
        isOpen={showFormModal}
        mode={formMode}
        initialData={editingItem}
        onClose={closeFormModal}
        onSubmit={handleSubmitForm}
      />

      {/* MODAL confirmar eliminar */}
      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        loading={deletingLoading}
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
      />

      {/* VIEWER tipo reels */}
      {showReels && (
        <ReelsViewer
          isOpen={showReels}
          items={allVisibleItems}
          startIndex={reelsIndex}
          onClose={() => setShowReels(false)}
        />
      )}
    </div>
  );
}

// Card individual con dropdown y fecha formateada
function GalleryCard({ item, onEdit, onDelete, onOpenFull }) {
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(false);
      }
    }
    if (openMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenu]);

  return (
    <div
      className="
        relative
        bg-neutral-800 border border-neutral-700 rounded-lg overflow-hidden
        shadow-md flex flex-col
        hover:brightness-110 transition
      "
    >
      {/* menú ⋮ */}
      <div className="absolute top-2 right-2 z-10" ref={menuRef}>
        <button
          className="bg-black/60 hover:bg-black/80 text-neutral-200 text-xs font-semibold rounded-md px-2 py-1"
          onClick={(e) => {
            e.stopPropagation();
            setOpenMenu((v) => !v);
          }}
        >
          ⋮
        </button>

        {openMenu && (
          <div className="absolute right-0 mt-1 min-w-[120px] bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl text-[12px] text-neutral-200 z-20">
            <button
              className="w-full text-left px-3 py-2 hover:bg-neutral-800"
              onClick={() => {
                setOpenMenu(false);
                onEdit();
              }}
            >
              Editar
            </button>
            <button
              className="w-full text-left px-3 py-2 hover:bg-neutral-800 text-red-400"
              onClick={() => {
                setOpenMenu(false);
                onDelete();
              }}
            >
              Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Preview clickable para abrir Reels */}
      <button
        type="button"
        className="bg-black aspect-square w-full flex items-center justify-center overflow-hidden"
        onClick={onOpenFull}
      >
        {item.type === "image" ? (
          <img
            src={item.src}
            alt={item.description || "imagen"}
            className="object-cover w-full h-full"
          />
        ) : (
          <video
            src={item.src}
            className="object-cover w-full h-full"
            muted
            playsInline
          />
        )}
      </button>

      {/* Info */}
      <div className="p-2 text-[11px] leading-relaxed text-neutral-300 space-y-1">
        <div className="flex items-center justify-between text-neutral-400">
          <span className="font-semibold text-neutral-200">{item.tag}</span>
          <span className="text-neutral-500 text-[10px]">
            {item.taken_at_formatted}
          </span>
        </div>

        {item.description && (
          <div className="text-neutral-400 line-clamp-2 min-h-[2.5em]">
            {item.description}
          </div>
        )}
      </div>
    </div>
  );
}
