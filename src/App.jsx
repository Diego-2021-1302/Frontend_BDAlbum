import { Routes, Route, Link } from "react-router-dom";
import GalleryPage from "./pages/GalleryPage.jsx";
import UploadPage from "./pages/UploadPage.jsx";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">

      {/* contenido */}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<GalleryPage />} />
          <Route path="/upload" element={<UploadPage />} />
        </Routes>
      </main>

      <footer className="text-center text-neutral-600 text-xs py-6">
        BY UNICOMICOPTERO FOR BREESE · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
