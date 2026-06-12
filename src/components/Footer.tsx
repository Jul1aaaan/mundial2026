"use client";
import { useState } from "react";

// Footer con una foto de los abuelos. Poné la imagen en public/abuelos.jpg o .png.
// Prueba ambas extensiones; si no encuentra ninguna, muestra un cartel guía.
const CANDIDATES = ["/abuelos.jpg", "/abuelos.png"];

export default function Footer() {
  const [idx, setIdx] = useState(0);
  const ok = idx < CANDIDATES.length;

  return (
    <footer className="mt-12 border-t border-line">
      <div className="max-w-6xl mx-auto px-4 py-8 text-center">
        {ok ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={CANDIDATES[idx]}
            alt="Los abuelos Gaznapios"
            onError={() => setIdx((i) => i + 1)}
            className="mx-auto rounded-2xl shadow-md max-h-80 w-auto object-cover"
          />
        ) : (
          <div className="mx-auto max-w-md rounded-2xl border-2 border-dashed border-line p-8 text-muted text-sm">
            📷 Acá va la foto de los abuelos.
            <br />
            Guardá la imagen como <code className="px-1 rounded bg-[#eef2f0]">public/abuelos.jpg</code> y aparece sola.
          </div>
        )}
        <p className="text-xs text-muted mt-3 font-semibold">Mundial 2026 · Gaznapios 💚</p>
      </div>
    </footer>
  );
}
