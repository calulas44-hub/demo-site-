"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addProductMediaAction, imageAction } from "@/lib/admin-actions/catalog";
import { uploadFile } from "./media-upload";

type Img = { id: string; url: string; alt: string | null; isPrimary: boolean; kind?: string };

export function ProductImages({ productId, images }: { productId: string; images: Img[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setMsg(null);
    const urls: string[] = [];
    try {
      for (const [i, file] of files.entries()) {
        const r = await uploadFile(file, "produits", { onProgress: (s) => setStatus(`${s} (${i + 1}/${files.length})`) });
        urls.push(r.url);
      }
      setStatus("Enregistrement…");
      const res = await addProductMediaAction({ productId, urls });
      setMsg({ ok: res.ok, text: res.message });
      router.refresh();
    } catch (err) {
      if (urls.length) await addProductMediaAction({ productId, urls });
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Envoi impossible." });
      router.refresh();
    } finally {
      setStatus(null);
    }
  };

  return (
    <div className="panel">
      <h2>Photos et vidéos</h2>
      {msg && <p className={`msg ${msg.ok ? "msg--ok" : "msg--err"}`}>{msg.text}</p>}
      {images.length > 0 && (
        <div className="thumbs" style={{ marginBottom: "1rem" }}>
          {images.map((img, i) => (
            <div key={img.id} className={`thumb-card${img.isPrimary ? " is-primary" : ""}`}>
              {img.kind === "VIDEO" ? <video src={`${img.url}#t=0.1`} muted playsInline preload="metadata" /> : <img src={img.url} alt={img.alt ?? ""} />}
              {img.kind === "VIDEO" && <span className="thumb-card__tag">Vidéo</span>}
              <form action={imageAction} className="thumb-card__bar">
                <input type="hidden" name="imageId" value={img.id} />
                {!img.isPrimary && img.kind !== "VIDEO" && (
                  <button type="submit" name="op" value="primary" title="Définir comme image principale">
                    ★ Principale
                  </button>
                )}
                {i > 0 && (
                  <button type="submit" name="op" value="left" title="Déplacer avant">
                    ←
                  </button>
                )}
                {i < images.length - 1 && (
                  <button type="submit" name="op" value="right" title="Déplacer après">
                    →
                  </button>
                )}
                <button
                  type="submit"
                  name="op"
                  value="delete"
                  title="Supprimer"
                  onClick={(e) => {
                    if (!window.confirm("Supprimer ce média ? Le fichier sera aussi retiré du stockage.")) e.preventDefault();
                  }}
                >
                  Supprimer
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
      <div className="f">
        <button type="button" className="btn-a btn-a--ghost" onClick={() => inputRef.current?.click()} disabled={Boolean(status)}>
          {status ?? "Ajouter des photos ou vidéos"}
        </button>
        <input ref={inputRef} type="file" multiple hidden accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm" onChange={onFiles} data-testid="upload-product-media" />
        <span className="hint">Photos converties en WebP (2400 px max) dans votre navigateur. Vidéos MP4/WebM, 50 Mo max. La première photo est l&apos;image principale ; la deuxième apparaît au survol dans le catalogue.</span>
      </div>
    </div>
  );
}
