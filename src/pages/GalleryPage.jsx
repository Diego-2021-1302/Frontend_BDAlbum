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

  // delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // visor tipo reels fullscreen
  const [showReels, setShowReels] = useState(false);
  const [reelsIndex, setReelsIndex] = useState(0);

  // ⭐ trackeamos el scrollY actual para restaurarlo
  const scrollYRef = useRef(0);

  // ⭐ hay algo bloqueando la UI?
  const uiBlocked = showFormModal || showDeleteModal || showReels;

  // ⭐ EFECTO: cuando uiBlocked = true, congelar scroll global del body/html
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    if (uiBlocked) {
      // guardamos dónde estaba el scroll
      scrollYRef.current = window.scrollY || 0;

      // bloque duro: fijar body en esa posición
      html.style.overflow = "hidden"; // iOS/Safari a veces usa html
      body.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.top = `-${scrollYRef.current}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";

      return () => {
        // al soltar, revertimos
        html.style.overflow = "";
        body.style.overflow = "";
        body.style.position = "";
        body.style.top = "";
        body.style.left = "";
        body.style.right = "";
        body.style.width = "";

        // y volvemos exactamente al mismo sitio
        window.scrollTo(0, scrollYRef.current);
      };
    }

    // si uiBlocked = false no hacemos nada especial
    return undefined;
  }, [uiBlocked]);

  // ================== helpers de fecha SIN Date() ==================

  // recibe "2025-06-16"
  // devuelve { y: 2025, m: 6, d: 16 } o null si está mal
  function parseYMD(ymdStr) {
    if (!ymdStr || typeof ymdStr !== "string") return null;
    const parts = ymdStr.split("-");
    if (parts.length !== 3) return null;
    const [yyyy, mm, dd] = parts;
    const y = parseInt(yyyy, 10);
    const m = parseInt(mm, 10); // 1..12
    const d = parseInt(dd, 10); // 1..31
    if (
      Number.isNaN(y) ||
      Number.isNaN(m) ||
      Number.isNaN(d) ||
      m < 1 ||
      m > 12 ||
      d < 1 ||
      d > 31
    ) {
      return null;
    }
    return { y, m, d };
  }

  // para pintar debajo de cada card y en el viewer (si no viene formateado)
  // salida "16/06/2025"
  function formatDMYFromYMD(ymdStr) {
    const parsed = parseYMD(ymdStr);
    if (!parsed) return "";
    const day = String(parsed.d).padStart(2, "0");
    const month = String(parsed.m).padStart(2, "0");
    const yearFull = String(parsed.y);
    return `${day}/${month}/${yearFull}`;
  }

  // ================== cargar data ==================

  async function load() {
    setLoading(true);
    try {
      const data = await fetchMedia({ year, tag, q });

      // enriquecemos cada media con:
      // - src (URL completa del archivo)
      // - taken_at_formatted (sin usar new Date)
      // OJO: el backend ya nos da taken_at "YYYY-MM-DD"
      const mapped = data.map((m) => ({
        ...m,
        src: buildFileURL(m.file_path),
        taken_at_formatted: m.taken_at_formatted && m.taken_at_formatted.trim() !== ""
          ? m.taken_at_formatted
          : formatDMYFromYMD(m.taken_at),
      }));

      setRawItems(mapped);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ================== agrupar por mes SIN new Date() ==================

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

    // map[m] = { monthNum, monthName, items: [...] }
    const map = {};

    for (const item of rawItems) {
      if (!item.taken_at) continue;

      const parsed = parseYMD(item.taken_at);
      if (!parsed) continue;

      // filtramos por el año seleccionado
      if (String(parsed.y) !== String(year)) continue;

      const monthIndex0 = parsed.m - 1; // 0..11
      if (!map[monthIndex0]) {
        map[monthIndex0] = {
          monthNum: monthIndex0,
          monthName: monthNames[monthIndex0],
          items: [],
        };
      }
      map[monthIndex0].items.push(item);
    }

    // orden interno de cada mes: más reciente primero (asumimos id mayor = más nuevo)
    Object.values(map).forEach((bucket) => {
      bucket.items.sort((a, b) => b.id - a.id);
    });

    // retornamos meses existentes (sin crear meses vacíos) ordenados por número de mes asc
    return Object.values(map).sort((a, b) => a.monthNum - b.monthNum);
  }, [rawItems, year]);

  // lista lineal de todos los visibles (para el ReelsViewer)
  const allVisibleItems = useMemo(() => {
    const flat = [];
    for (const block of itemsByMonth) {
      for (const it of block.items) {
        flat.push(it);
      }
    }
    return flat;
  }, [itemsByMonth]);

  // ================== acciones CRUD / visor ==================

  function openCreateModal() {
    setFormMode("create");
    setEditingItem(null);
    setShowFormModal(true);
  }

  function openEditModal(item) {
    setFormMode("edit");
    setEditingItem(item);
    setShowFormModal(true);
  }

  function closeFormModal() {
    setShowFormModal(false);
  }

  async function handleSubmitForm(payload, onProgressCb) {
    const { file, taken_at, description, tag } = payload;

    if (formMode === "create") {
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

  function openReelsAt(item) {
    const idx = allVisibleItems.findIndex((it) => it.id === item.id);
    if (idx >= 0) {
      setReelsIndex(idx);
      setShowReels(true);
    }
  }

  return (
    <>
      {/* CONTENIDO PRINCIPAL */}
      <div
        className={
          `
          relative min-h-screen bg-stone-950 text-neutral-100
          p-6 flex flex-col gap-8 max-w-7xl mx-auto pb-24
          transition-[filter,opacity] duration-150
        ` +
          (uiBlocked
            ? " pointer-events-none select-none opacity-50 blur-sm"
            : "")
        }
        aria-hidden={uiBlocked ? "true" : "false"}
      >
        {/* HEADER / PORTADA */}
        <section className="space-y-4">
          <div className="relative bg-gradient-to-b from-pink-900/70 via-neutral-900/80 to-black text-center rounded-3xl shadow-2xl overflow-hidden p-10 border border-white/10 font-sans">
            <div className="relative z-10 flex flex-col items-center gap-6">
              <h1 className="text-5xl md:text-6xl font-script text-white drop-shadow-lg tracking-wide">
                Breese y Diego
              </h1>
              <p className="text-neutral-300 text-lg font-light">
                Una colección de momentos juntos
              </p>

              <div className="flex items-center justify-center gap-6 mt-4">
                <img
                  src="/images/cereza.png"
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
                “La historia de una dulce cherry y su jardinero, dedicado a mantenerla fresca y saludable”
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
                    {monthBlock.items.length === 1
                      ? "archivo"
                      : "archivos"}
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
        <div className="bg-transparent-900/70 border border-pink-800 rounded-xl p-4 flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
          {/* filtro texto */}
          <div className="flex flex-col w-full md:w-[200px]">
            <label className="text-xs text-neutral-400 mb-1">
              Buscar texto
            </label>
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
            <label className="text-xs text-neutral-400 mb-1">
              Etiqueta
            </label>
            <select
              className="bg-neutral-900 text-neutral-100 rounded-lg px-3 py-2 w-full border border-neutral-700 text-sm"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
            >
              <option value="">Todas</option>
              <option value="B">B</option>
              <option value="D">D</option>
              <option value="BD">BD</option>
            </select>
          </div>

          {/* filtro año */}
          <div className="flex flex-col w-full md:w-[120px]">
            <label className="text-xs text-neutral-400 mb-1">
              Año
            </label>
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
            bg-pink-300/70 hover:bg-pink-700/70
            w-14 h-14 rounded-full
            flex items-center justify-center
            shadow-xl shadow-bg-pink-900
            border border-black/20
            p-3.5
          "
        >
          <img
            src="/images/cereza.png"
            alt="Añadir"
            className="img-fluid"
          />
        </button>
      </div>

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
    </>
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
        className="bg-black aspect-square w-full flex items-center justify-center overflow-hidden relative group"
        onClick={onOpenFull}
      >
        {item.type === "image" ? (
          <img
            src={item.src}
            alt={item.description || "imagen"}
            className="object-cover w-full h-full"
          />
        ) : (
          <>
            <video
              src={item.src}
              className="object-cover w-full h-full"
              muted
              playsInline
            />
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-white/90 text-neutral-900 flex items-center justify-center text-sm font-semibold shadow-lg">
                ▶
              </div>
            </div>
          </>
        )}
      </button>

      {/* Info */}
      <div className="p-2 text-[11px] leading-relaxed text-neutral-300 space-y-1">
        <div className="flex items-center justify-between text-neutral-400">
          <span className="font-semibold text-neutral-200">
            {item.tag}
          </span>
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
