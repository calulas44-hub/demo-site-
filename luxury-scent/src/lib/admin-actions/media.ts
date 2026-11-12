"use server";

import { logAdminAction, requireAdmin } from "@/lib/auth";
import { confirmUpload, createUploadTarget, MEDIA_BUCKET, PRIVATE_BUCKET, type Bucket, type UploadTarget } from "@/lib/storage";

export type UploadTicket = { ok: true; target: UploadTarget } | { ok: false; message: string };
export type UploadResult = { ok: true; url: string; kind: string } | { ok: false; message: string };

/** Étape 1 : le navigateur demande l'autorisation d'envoyer un fichier. */
export async function requestUploadAction(input: { folder: string; contentType: string; size: number; privateFile?: boolean }): Promise<UploadTicket> {
  await requireAdmin();
  try {
    const target = createUploadTarget({ folder: String(input.folder), contentType: String(input.contentType), size: Number(input.size), bucket: input.privateFile ? PRIVATE_BUCKET : undefined });
    return { ok: true, target };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Envoi refusé." };
  }
}

/** Étape 2 : une fois tous les morceaux envoyés, le serveur réassemble et vérifie le fichier. */
export async function confirmUploadAction(input: { bucket: string; objectPath: string; parts: number; filename: string; alt?: string; width?: number; height?: number }): Promise<UploadResult> {
  const admin = await requireAdmin();
  const bucket: Bucket = input.bucket === PRIVATE_BUCKET ? PRIVATE_BUCKET : MEDIA_BUCKET;
  try {
    const r = await confirmUpload(bucket, String(input.objectPath), Number(input.parts), { filename: String(input.filename), alt: input.alt, width: input.width, height: input.height });
    await logAdminAction(admin.id, "media", null, "UPLOAD", { url: r.url, size: r.size, type: r.contentType });
    return { ok: true, url: r.url, kind: r.kind };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Fichier refusé." };
  }
}
