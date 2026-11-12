"use client";

import { useRef, useState } from "react";
import { confirmUploadAction, requestUploadAction } from "@/lib/admin-actions/media";

/**
 * Envoi de fichiers direct navigateur → stockage (Supabase Storage en production).
 * - Les images sont redimensionnées (2400 px max) et converties en WebP dans le navigateur.
 * - Le serveur délivre une autorisation signée, puis vérifie le fichier reçu.
 */

export type Accept = "image" | "video" | "media" | "document";

const ACCEPT_ATTR: Record<Accept, string> = {
  image: "image/jpeg,image/png,image/webp,image/avif,image/gif",
  video: "video/mp4,video/webm",
  media: "image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm",
  document: "application/pdf,image/jpeg,image/png,image/webp",
};

async function compressImage(file: File): Promise<{ blob: Blob; type: string; width: number; height: number }> {
  if (file.type === "image/gif") return { blob: file, type: file.type, width: 0, height: 0 };
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { blob: file, type: file.type, width: bitmap.width, height: bitmap.height };
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
  if (!blob || (blob.size >= file.size && file.type === "image/webp")) return { blob: file, type: file.type, width, height };
  return { blob, type: "image/webp", width, height };
}

export async function uploadFile(file: File, folder: string, opts: { privateFile?: boolean; onProgress?: (msg: string) => void } = {}): Promise<{ url: string; kind: string }> {
  let blob: Blob = file;
  let type = file.type;
  let width: number | undefined;
  let height: number | undefined;
  if (type.startsWith("image/") && !opts.privateFile) {
    opts.onProgress?.("Compression…");
    const c = await compressImage(file);
    blob = c.blob;
    type = c.type;
    width = c.width || undefined;
    height = c.height || undefined;
  }
  opts.onProgress?.("Envoi…");
  const ticket = await requestUploadAction({ folder, contentType: type, size: blob.size, privateFile: opts.privateFile });
  if (!ticket.ok) throw new Error(ticket.message);
  const t = ticket.target;
  if (t.driver === "supabase") {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(t.supabaseUrl!, t.supabaseAnonKey!, { auth: { persistSession: false } });
    const { error } = await sb.storage.from(t.bucket).uploadToSignedUrl(t.objectPath, t.token, blob, { contentType: type, cacheControl: "31536000" });
    if (error) throw new Error(`Envoi refusé par le stockage : ${error.message}`);
  } else {
    const res = await fetch(t.localUrl!, { method: "PUT", body: blob, headers: { "Content-Type": type } });
    if (!res.ok) throw new Error(`Envoi refusé (${res.status}).`);
  }
  opts.onProgress?.("Vérification…");
  const done = await confirmUploadAction({ bucket: t.bucket, objectPath: t.objectPath, filename: file.name, width, height });
  if (!done.ok) throw new Error(done.message);
  return { url: done.url, kind: done.kind };
}

/** Champ de formulaire « un fichier » : aperçu, remplacement, retrait ; la valeur envoyée est l'URL. */
export function MediaField({ name, label, accept = "image", folder, defaultUrl, hint, privateFile = false }: { name: string; label: string; accept?: Accept; folder: string; defaultUrl?: string | null; hint?: string; privateFile?: boolean }) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isVideo = /\.(mp4|webm)(\?|$)/i.test(url);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const r = await uploadFile(file, folder, { privateFile, onProgress: setStatus });
      setUrl(r.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setStatus(null);
    }
  };

  return (
    <div className="f">
      <label>{label}</label>
      <input type="hidden" name={name} value={url} />
      {url && !privateFile && (
        <div className="img-preview">
          {isVideo ? <video src={`${url}#t=0.1`} muted playsInline preload="metadata" style={{ maxWidth: 160, maxHeight: 110 }} /> : <img src={url} alt="" />}
          <button type="button" className="btn-a btn-a--ghost btn-a--sm" onClick={() => setUrl("")}>
            Retirer
          </button>
        </div>
      )}
      {url && privateFile && (
        <p className="small">
          Fichier joint.{" "}
          <button type="button" className="btn-a btn-a--link" onClick={() => setUrl("")}>
            Retirer
          </button>
        </p>
      )}
      <div className="f-inline">
        <button type="button" className="btn-a btn-a--ghost btn-a--sm" onClick={() => inputRef.current?.click()} disabled={Boolean(status)}>
          {status ?? (url ? "Remplacer" : "Choisir un fichier")}
        </button>
        <input ref={inputRef} type="file" accept={ACCEPT_ATTR[accept]} onChange={onChange} hidden data-testid={`upload-${name}`} />
      </div>
      {error && <p className="msg msg--err small">{error}</p>}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
