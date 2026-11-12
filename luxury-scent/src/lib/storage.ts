import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "./db";

/**
 * Stockage durable des médias.
 * - Production : Supabase Storage (bucket public « media » pour les images et vidéos du site,
 *   bucket privé « private » pour les justificatifs comptables).
 * - Développement sans Supabase : dossier local storage/uploads (servi par /uploads).
 *
 * Les fichiers ne transitent pas par les fonctions serveur (limite Netlify de 6 Mo) :
 * le navigateur les envoie directement au stockage avec une autorisation signée et à usage unique,
 * délivrée par le serveur après vérification des droits, du type et de la taille.
 */

export const MEDIA_BUCKET = "media";
export const PRIVATE_BUCKET = "private";
export type Bucket = typeof MEDIA_BUCKET | typeof PRIVATE_BUCKET;

export const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png", "image/avif", "image/gif"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/webm"] as const;
export const DOC_TYPES = ["application/pdf"] as const;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // limite par fichier du plan gratuit Supabase
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

export type MediaKind = "image" | "video" | "document";

const EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/avif": "avif",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
};

/** Accepte les deux conventions de nommage (SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL). */
export function supabaseUrl(): string | undefined {
  return (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "") || undefined;
}
function supabaseAnonKey(): string | undefined {
  return process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined;
}

export function isSupabaseStorage(): boolean {
  return Boolean(supabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

let adminClient: SupabaseClient | null = null;
function supabaseAdmin(): SupabaseClient {
  if (!isSupabaseStorage()) throw new Error("Supabase n'est pas configuré (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).");
  if (!adminClient) {
    adminClient = createClient(supabaseUrl()!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

function localRoot(): string {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR || "./storage/uploads");
}

export function kindOf(contentType: string): MediaKind | null {
  if ((IMAGE_TYPES as readonly string[]).includes(contentType)) return "image";
  if ((VIDEO_TYPES as readonly string[]).includes(contentType)) return "video";
  if ((DOC_TYPES as readonly string[]).includes(contentType)) return "document";
  return null;
}

export function maxBytes(kind: MediaKind): number {
  return kind === "image" ? MAX_IMAGE_BYTES : kind === "video" ? MAX_VIDEO_BYTES : MAX_DOC_BYTES;
}

function safeFolder(folder: string): string {
  return folder.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "general";
}

export function publicUrlFor(bucket: Bucket, objectPath: string): string {
  if (bucket === PRIVATE_BUCKET) return `private:${objectPath}`;
  if (isSupabaseStorage()) return `${supabaseUrl()}/storage/v1/object/public/${MEDIA_BUCKET}/${objectPath}`;
  return `/uploads/${objectPath}`;
}

/** Retrouve le bucket et le chemin d'un fichier à partir de son URL publique (ou « private:… »). */
export function parseStoredUrl(url: string): { bucket: Bucket; objectPath: string } | null {
  if (url.startsWith("private:")) return { bucket: PRIVATE_BUCKET, objectPath: url.slice("private:".length) };
  if (url.startsWith("/uploads/")) return { bucket: MEDIA_BUCKET, objectPath: url.slice("/uploads/".length) };
  if (supabaseUrl()) {
    const prefix = `${supabaseUrl()}/storage/v1/object/public/${MEDIA_BUCKET}/`;
    if (url.startsWith(prefix)) return { bucket: MEDIA_BUCKET, objectPath: url.slice(prefix.length) };
  }
  return null;
}

/**
 * Lit un champ « URL de média » envoyé par un formulaire d'administration.
 * undefined = champ absent (ne rien changer), null = retiré, string = URL vérifiée de notre stockage.
 */
export function mediaUrlFromForm(formData: FormData, name: string): string | null | undefined {
  if (!formData.has(name)) return undefined;
  const v = String(formData.get(name) ?? "").trim();
  if (!v) return null;
  if (!isOwnMediaUrl(v)) throw new Error("Fichier refusé : il doit être envoyé depuis l'administration.");
  return v;
}

/** Une URL fournie par un formulaire d'administration doit désigner un fichier de notre stockage. */
export function isOwnMediaUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  const parsed = parseStoredUrl(url);
  return Boolean(parsed && !parsed.objectPath.includes("..") && parsed.bucket === MEDIA_BUCKET);
}

// ------------------------------------------------------------------ Envoi direct depuis le navigateur

export interface UploadTarget {
  driver: "supabase" | "local";
  bucket: Bucket;
  objectPath: string;
  token: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  localUrl?: string;
}

function localSignature(objectPath: string, contentType: string, expires: number): string {
  const secret = process.env.SESSION_SECRET ?? "";
  return createHmac("sha256", secret).update(`${objectPath}|${contentType}|${expires}`).digest("hex");
}

export function verifyLocalSignature(objectPath: string, contentType: string, expires: number, sig: string): boolean {
  if (Date.now() > expires) return false;
  const expected = Buffer.from(localSignature(objectPath, contentType, expires));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Prépare l'envoi d'un fichier (appelé côté serveur après vérification des droits d'administration). */
export async function createUploadTarget(opts: { folder: string; contentType: string; size: number; bucket?: Bucket }): Promise<UploadTarget> {
  const kind = kindOf(opts.contentType);
  if (!kind) throw new Error("Format non pris en charge (images JPEG/PNG/WebP/AVIF/GIF, vidéos MP4/WebM, PDF).");
  if (opts.size <= 0 || opts.size > maxBytes(kind)) throw new Error(`Fichier trop volumineux (maximum ${Math.round(maxBytes(kind) / 1024 / 1024)} Mo).`);
  const bucket = opts.bucket ?? (kind === "document" ? PRIVATE_BUCKET : MEDIA_BUCKET);
  const objectPath = `${safeFolder(opts.folder)}/${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${EXT[opts.contentType]}`;

  if (isSupabaseStorage()) {
    const { data, error } = await supabaseAdmin().storage.from(bucket).createSignedUploadUrl(objectPath);
    if (error || !data) throw new Error(`Stockage indisponible : ${error?.message ?? "erreur inconnue"}`);
    return { driver: "supabase", bucket, objectPath, token: data.token, supabaseUrl: supabaseUrl(), supabaseAnonKey: supabaseAnonKey() };
  }
  const expires = Date.now() + 15 * 60 * 1000;
  const sig = localSignature(objectPath, opts.contentType, expires);
  const qs = new URLSearchParams({ path: objectPath, type: opts.contentType, expires: String(expires), sig, bucket });
  return { driver: "local", bucket, objectPath, token: sig, localUrl: `/api/admin/local-upload?${qs}` };
}

/** Vérifie un fichier envoyé (taille et type réels) et l'enregistre dans la médiathèque. */
export async function confirmUpload(bucket: Bucket, objectPath: string, meta: { filename: string; alt?: string | null; width?: number | null; height?: number | null }) {
  if (objectPath.includes("..")) throw new Error("Chemin invalide.");
  const info = await statObject(bucket, objectPath);
  if (!info) throw new Error("Le fichier n'a pas été reçu par le stockage.");
  const kind = kindOf(info.contentType);
  if (!kind || info.size > maxBytes(kind)) {
    await removeObject(bucket, objectPath);
    throw new Error("Fichier refusé après vérification (type ou taille non conforme).");
  }
  const url = publicUrlFor(bucket, objectPath);
  await prisma.media.upsert({
    where: { url },
    create: { url, filename: meta.filename.slice(0, 200), mimeType: info.contentType, size: info.size, width: meta.width ?? null, height: meta.height ?? null, alt: meta.alt ?? null, folder: objectPath.split("/")[0] },
    update: {},
  });
  return { url, kind, size: info.size, contentType: info.contentType };
}

async function statObject(bucket: Bucket, objectPath: string): Promise<{ size: number; contentType: string } | null> {
  if (isSupabaseStorage()) {
    const folder = path.posix.dirname(objectPath);
    const name = path.posix.basename(objectPath);
    const { data, error } = await supabaseAdmin().storage.from(bucket).list(folder, { search: name, limit: 5 });
    if (error) throw new Error(`Stockage indisponible : ${error.message}`);
    const file = data?.find((f) => f.name === name);
    if (!file) return null;
    const metadata = (file.metadata ?? {}) as { size?: number; mimetype?: string };
    return { size: Number(metadata.size ?? 0), contentType: String(metadata.mimetype ?? "") };
  }
  try {
    const s = await stat(path.join(localRoot(), bucket === PRIVATE_BUCKET ? "_private" : "", objectPath));
    const ext = objectPath.split(".").pop() ?? "";
    const contentType = Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? "";
    return { size: s.size, contentType };
  } catch {
    return null;
  }
}

/** Écriture côté serveur (amorçage, scripts) — les envois de l'administration passent par createUploadTarget. */
export async function putObject(bucket: Bucket, objectPath: string, body: Buffer, contentType: string): Promise<string> {
  if (isSupabaseStorage()) {
    const { error } = await supabaseAdmin().storage.from(bucket).upload(objectPath, body, { contentType, upsert: true, cacheControl: "31536000" });
    if (error) throw new Error(`Envoi impossible vers le stockage : ${error.message}`);
  } else {
    const file = path.join(localRoot(), bucket === PRIVATE_BUCKET ? "_private" : "", objectPath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }
  return publicUrlFor(bucket, objectPath);
}

export async function removeObject(bucket: Bucket, objectPath: string): Promise<void> {
  if (isSupabaseStorage()) {
    await supabaseAdmin().storage.from(bucket).remove([objectPath]);
  } else {
    try {
      await unlink(path.join(localRoot(), bucket === PRIVATE_BUCKET ? "_private" : "", objectPath));
    } catch {
      /* déjà absent */
    }
  }
}

/** Supprime un fichier à partir de son URL (si elle désigne notre stockage) et l'entrée de médiathèque. */
export async function deleteStoredUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const parsed = parseStoredUrl(url);
  if (!parsed || parsed.objectPath.includes("..")) return;
  // Ne supprime pas un fichier encore utilisé ailleurs (image partagée entre produits, etc.).
  const [images, sections, categories, collections] = await Promise.all([
    prisma.productImage.count({ where: { OR: [{ url }, { posterUrl: url }] } }),
    prisma.homeSection.count({ where: { OR: [{ imageUrl: url }, { imageMobileUrl: url }] } }),
    prisma.category.count({ where: { imageUrl: url } }),
    prisma.collection.count({ where: { OR: [{ imageUrl: url }, { heroImageUrl: url }] } }),
  ]);
  if (images + sections + categories + collections > 0) return;
  await removeObject(parsed.bucket, parsed.objectPath);
  await prisma.media.deleteMany({ where: { url } });
}

/** URL de lecture temporaire pour un fichier privé (justificatifs). */
export async function privateReadUrl(storedUrl: string, expiresInSeconds = 300): Promise<string | null> {
  const parsed = parseStoredUrl(storedUrl);
  if (!parsed || parsed.bucket !== PRIVATE_BUCKET) return null;
  if (isSupabaseStorage()) {
    const { data } = await supabaseAdmin().storage.from(PRIVATE_BUCKET).createSignedUrl(parsed.objectPath, expiresInSeconds);
    return data?.signedUrl ?? null;
  }
  return `/api/admin/private-file?path=${encodeURIComponent(parsed.objectPath)}`;
}

/** Crée les buckets s'ils n'existent pas (appelé à l'amorçage). */
export async function ensureBuckets(): Promise<string[]> {
  if (!isSupabaseStorage()) return [];
  const sb = supabaseAdmin();
  const { data: existing, error } = await sb.storage.listBuckets();
  if (error) throw new Error(`Stockage Supabase inaccessible : ${error.message}`);
  const names = new Set((existing ?? []).map((b) => b.name));
  const created: string[] = [];
  if (!names.has(MEDIA_BUCKET)) {
    const { error: e } = await sb.storage.createBucket(MEDIA_BUCKET, { public: true, fileSizeLimit: MAX_VIDEO_BYTES, allowedMimeTypes: [...IMAGE_TYPES, ...VIDEO_TYPES] });
    if (e) throw new Error(`Création du bucket ${MEDIA_BUCKET} impossible : ${e.message}`);
    created.push(MEDIA_BUCKET);
  }
  if (!names.has(PRIVATE_BUCKET)) {
    const { error: e } = await sb.storage.createBucket(PRIVATE_BUCKET, { public: false, fileSizeLimit: MAX_DOC_BYTES, allowedMimeTypes: [...DOC_TYPES, ...IMAGE_TYPES] });
    if (e) throw new Error(`Création du bucket ${PRIVATE_BUCKET} impossible : ${e.message}`);
    created.push(PRIVATE_BUCKET);
  }
  return created;
}

export function localUploadPath(bucket: string, objectPath: string): string | null {
  if (objectPath.includes("..") || objectPath.includes("\0")) return null;
  const base = path.join(localRoot(), bucket === PRIVATE_BUCKET ? "_private" : "");
  const abs = path.join(base, objectPath);
  return abs.startsWith(base) ? abs : null;
}
