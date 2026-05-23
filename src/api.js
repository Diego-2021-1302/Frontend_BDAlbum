const HOST = window.location.hostname;
const API_PORT = 8001;
const API_BASE = `http://${HOST}:${API_PORT}`;
const API_URL = `${API_BASE}/api`;
const FILES_BASE = API_BASE;




// GET /media con filtros
export async function fetchMedia({ year = "", tag = "", q = "" } = {}) {
  const params = new URLSearchParams();
  if (year) params.set("year", year);
  if (tag) params.set("tag", tag);
  if (q) params.set("q", q);

const res = await fetch(`${API_URL}/media?${params.toString()}`);
  if (!res.ok) throw new Error("Error obteniendo media");
  return res.json();
}

// SUBIR (sin progreso) - opcional, podrías borrarla si ya no la usas
export async function uploadMedia({ file, taken_at, description, tag }) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("taken_at", taken_at);
  formData.append("description", description ?? "");
  formData.append("tag", tag);

  const res = await fetch(`${API_URL}/media`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let errMsg = "No se pudo subir el archivo";
    try {
      const err = await res.json();
      if (err.error) errMsg = err.error;
    } catch {
      // ignoramos parse error
    }
    throw new Error(errMsg);
  }

  return res.json();
}

// SUBIR con barra de progreso
export function uploadMediaWithProgress({
  file,
  taken_at,
  description,
  tag,
  onProgress,
}) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("taken_at", taken_at);
    formData.append("description", description ?? "");
    formData.append("tag", tag);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/media`, true);

    // progreso de subida
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && typeof onProgress === "function") {
        const percent = (evt.loaded / evt.total) * 100;
        onProgress(percent); // 0..100
      }
    };

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        // DONE
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            resolve(json);
          } catch {
            reject(new Error("Respuesta inválida del servidor"));
          }
        } else {
          try {
            const errJson = JSON.parse(xhr.responseText);
            reject(
              new Error(
                errJson.error || "No se pudo subir el archivo"
              )
            );
          } catch {
            reject(new Error("No se pudo subir el archivo"));
          }
        }
      }
    };

    xhr.onerror = function () {
      reject(new Error("Error de red al subir (failed to fetch)"));
    };

    xhr.send(formData);
  });
}

// PUT /media/{id} (edición)
export async function updateMedia({ id, file, taken_at, description, tag }) {
  const formData = new FormData();
  if (file) formData.append("file", file);
  formData.append("taken_at", taken_at);
  formData.append("description", description ?? "");
  formData.append("tag", tag);

  const res = await fetch(`${API_URL}/media/${id}`, {
    method: "POST",
    headers: {
      "X-HTTP-Method-Override": "PUT",
    },
    body: formData,
  });

  if (!res.ok) {
    let errMsg = "No se pudo actualizar";
    try {
      const err = await res.json();
      if (err.error) errMsg = err.error;
    } catch {
      // ignoramos parse error
    }
    throw new Error(errMsg);
  }

  return res.json();
}

// DELETE /media/{id}
export async function deleteMedia(id) {
  const res = await fetch(`${API_URL}/media/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error("No se pudo eliminar");
  }

  return res.json();
}

// construir URL accesible pública para <img> / <video>
export function buildFileURL(pathFromAPI) {
  return `${FILES_BASE}/${pathFromAPI}`;
}
