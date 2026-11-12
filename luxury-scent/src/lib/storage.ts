import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db";
import { appSecrets } from "./app-secrets";

/**
 * Stockage durable des médias.
 * - Production (Netlify) : Netlify Blobs — store « media » (photos, vidéos du site) et store « private »
 *   (justificatifs comptables, jamais servis publiquement).
 * - Développement local : dossier storage/uploads.
 *
 * Les fonctions Netlify acceptent au plus 6 Mo par requête : le navigateur envoie donc les fichiers
 * en morceaux de 3,5 Mo, avec une autorisation signée délivrée après vérification des droits admin.
 * Le serveur réassemble, vérifie le type et la taille, puis enregistre le fichier.
 * Les médias sont servis par /media/… (mise en cache longue durée par le CDN Netlify).
 * Les images de départ (couverture, démonstration) sont des fichiers statiques sous /seed/.
 */

export const MEDIA_BUCKET = "media";
export const PRIVATE_BUCKET = "private";
export type Bucket = typeof MEDIA_BUCKET | typeof PRIVATE_BUCKET;

export const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png", "image/avif", "image/gif"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/webm"] as const;
export const DOC_TYPES = ["application/pdf"] as const;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
// Les réponses des fonctions Netlify sont limitées à 20 Mo : les vidéos restent en dessous.
export const MAX_VIDEO_BYTES = 18 * 1024 * 1024;
export const MAX_DOC_BYTES = 10 * 1024 * 1024;
export const CHUNK_BYTES = 3.5 * 1024 * 1024;
const MAX_PARTS = Math.ceil(MAX_IMAGE_BYTES / CHUNK_BYTES) + 1;

export type MediaKind = "image" | "video" | "document";

export const EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/avif": "avif",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
};

export function contentTypeOf(objectPath: string): string {
  const ext = objectPath.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpeg") return "image/jpeg";
  return Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
}

/** « netlify » est fixé au build par next.config.ts sur Netlify ; « local » sinon. */
export function storageDriver(): "netlify" | "local" {
  return process.env.MEDIA_DRIVER === "netlify" ? "netlify" : "local";
}

async function blobStore(bucket: Bucket) {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: bucket, region: "eu-central-1", consistency: "strong" });
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

export function validObjectPath(p: string): boolean {
  return /^[a-z0-9-]+\/[a-z0-9-]+\.(webp|jpg|png|avif|gif|mp4|webm|pdf)$/.test(p);
}

export function publicUrlFor(bucket: Bucket, objectPath: string): string {
  return bucket === PRIVATE_BUCKET ? `private:${objectPath}` : `/media/${objectPath}`;
}

/** Retrouve le bucket et le chemin d'un fichier à partir de son URL publique (ou « private:… »). */
export function parseStoredUrl(url: string): { bucket: Bucket; objectPath: string } | null {
  if (url.startsWith("private:")) return { bucket: PRIVATE_BUCKET, objectPath: url.slice("private:".length) };
  if (url.startsWith("/media/")) return { bucket: MEDIA_BUCKET, objectPath: url.slice("/media/".length) };
  if (url.startsWith("/uploads/")) return { bucket: MEDIA_BUCKET, objectPath: url.slice("/uploads/".length) };
  return null;
}

/** Une URL fournie par un formulaire d'administration doit désigner un fichier de notre stockage ou une image de départ. */
export function isOwnMediaUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  if (/^\/seed\/[a-z0-9-]+\.(webp|jpg|png|mp4)$/.test(url)) return true;
  const parsed = parseStoredUrl(url);
  return Boolean(parsed && parsed.bucket === MEDIA_BUCKET && validObjectPath(parsed.objectPath));
}

/**
 * Lit un champ « URL de média » envoyé par un formulaire d'administration.
 * undefined = champ absent (ne rien changer), null = retiré, string = URL vérifiée.
 */
export function mediaUrlFromForm(formData: FormData, name: string): string | null | undefined {
  if (!formData.has(name)) return undefined;
  const v = String(formData.get(name) ?? "").trim();
  if (!v) return null;
  if (!isOwnMediaUrl(v)) throw new Error("Fichier refusé : il doit être envoyé depuis l'administration.");
  return v;
}

// ------------------------------------------------------------------ Accès bas niveau

function localFile(bucket: Bucket, objectPath: string): string {
  return path.join(localRoot(), bucket === PRIVATE_BUCKET ? "_private" : "", objectPath);
}

export async function putObject(bucket: Bucket, objectPath: string, body: Buffer, contentType: string): Promise<string> {
  if (storageDriver() === "netlify") {
    const store = await blobStore(bucket);
    const ab = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
    await store.set(objectPath, ab, { metadata: { contentType, size: body.length } });
  } else {
    const file = localFile(bucket, objectPath);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }
  return publicUrlFor(bucket, objectPath);
}

export async function getObject(bucket: Bucket, objectPath: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (storageDriver() === "netlify") {
    const store = await blobStore(bucket);
    // Vérification préalable (requête HEAD) : sous Next.js, une réponse 404 avec corps non lu
    // peut bloquer la requête ; on ne lit le contenu que si le fichier existe.
    if (!(await store.getMetadata(objectPath))) return null;
    const r = await store.getWithMetadata(objectPath, { type: "arrayBuffer" });
    if (!r) return null;
    const meta = (r.metadata ?? {}) as { contentType?: string };
    return { data: Buffer.from(r.data), contentType: meta.contentType || contentTypeOf(objectPath) };
  }
  try {
    return { data: await readFile(localFile(bucket, objectPath)), contentType: contentTypeOf(objectPath) };
  } catch {
    return null;
  }
}

export async function removeObject(bucket: Bucket, objectPath: string): Promise<void> {
  if (storageDriver() === "netlify") {
    await (await blobStore(bucket)).delete(objectPath);
  } else {
    await unlink(localFile(bucket, objectPath)).catch(() => undefined);
  }
}

// ------------------------------------------------------------------ Envoi depuis l'administration

export interface UploadTarget {
  bucket: Bucket;
  objectPath: string;
  contentType: string;
  chunkSize: number;
  parts: number;
  /** URL d'envoi signée (ajouter &part=N) */
  url: string;
}

async function signature(bucket: string, objectPath: string, contentType: string, expires: number): Promise<string> {
  const secret = (await appSecrets()).session;
  return createHmac("sha256", secret).update(`upload|${bucket}|${objectPath}|${contentType}|${expires}`).digest("hex");
}

export async function verifyUploadSignature(bucket: string, objectPath: string, contentType: string, expires: number, sig: string): Promise<boolean> {
  if (Date.now() > expires) return false;
  const expected = Buffer.from(await signature(bucket, objectPath, contentType, expires));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function partKey(objectPath: string, part: number): string {
  return `${objectPath}.part${part}`;
}

/** Prépare l'envoi d'un fichier (après vérification des droits d'administration). */
export async function createUploadTarget(opts: { folder: string; contentType: string; size: number; bucket?: Bucket }): Promise<UploadTarget> {
  const kind = kindOf(opts.contentType);
  if (!kind) throw new Error("Format non pris en charge (images JPEG/PNG/WebP/AVIF/GIF, vidéos MP4/WebM, PDF).");
  if (opts.size <= 0 || opts.size > maxBytes(kind)) throw new Error(`Fichier trop volumineux (maximum ${Math.round(maxBytes(kind) / 1024 / 1024)} Mo).`);
  const bucket = opts.bucket ?? (kind === "document" ? PRIVATE_BUCKET : MEDIA_BUCKET);
  if (bucket === MEDIA_BUCKET && kind === "document") throw new Error("Format non pris en charge.");
  const objectPath = `${safeFolder(opts.folder)}/${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${EXT[opts.contentType]}`;
  const expires = Date.now() + 30 * 60 * 1000;
  const sig = await signature(bucket, objectPath, opts.contentType, expires);
  const qs = new URLSearchParams({ bucket, path: objectPath, type: opts.contentType, expires: String(expires), sig });
  return { bucket, objectPath, contentType: opts.contentType, chunkSize: CHUNK_BYTES, parts: Math.ceil(opts.size / CHUNK_BYTES), url: `/api/admin/upload?${qs}` };
}

/** Réassemble les morceaux reçus, vérifie le fichier et l'enregistre dans la médiathèque. */
export async function confirmUpload(bucket: Bucket, objectPath: string, parts: number, meta: { filename: string; alt?: string | null; width?: number | null; height?: number | null }) {
  if (!validObjectPath(objectPath)) throw new Error("Chemin invalide.");
  if (!Number.isInteger(parts) || parts < 1 || parts > MAX_PARTS) throw new Error("Envoi incomplet.");
  const contentType = contentTypeOf(objectPath);
  const kind = kindOf(contentType);
  if (!kind) throw new Error("Format non pris en charge.");
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (let i = 0; i < parts; i++) {
      const c = await getObject(bucket, partKey(objectPath, i));
      if (!c) throw new Error("Le fichier n'a pas été entièrement reçu. Réessayez.");
      total += c.data.length;
      if (total > maxBytes(kind)) throw new Error("Fichier refusé : taille non conforme.");
      chunks.push(c.data);
    }
  } finally {
    for (let i = 0; i < parts; i++) await removeObject(bucket, partKey(objectPath, i)).catch(() => undefined);
  }
  const body = Buffer.concat(chunks);
  if (!looksLike(contentType, body)) throw new Error("Fichier refusé : le contenu ne correspond pas au format annoncé.");
  const url = await putObject(bucket, objectPath, body, contentType);
  await prisma.media.upsert({
    where: { url },
    create: { url, filename: meta.filename.slice(0, 200), mimeType: contentType, size: body.length, width: meta.width ?? null, height: meta.height ?? null, alt: meta.alt ?? null, folder: objectPath.split("/")[0] },
    update: {},
  });
  return { url, kind, size: body.length, contentType };
}

/** Vérifie la signature binaire du fichier (empêche d'envoyer autre chose qu'une image/vidéo/PDF). */
function looksLike(contentType: string, b: Buffer): boolean {
  const hex = b.subarray(0, 12).toString("hex");
  const ascii = b.subarray(0, 12).toString("latin1");
  switch (contentType) {
    case "image/jpeg":
      return hex.startsWith("ffd8ff");
    case "image/png":
      return hex.startsWith("89504e47");
    case "image/gif":
      return ascii.startsWith("GIF8");
    case "image/webp":
      return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
    case "image/avif":
    case "video/mp4":
      return ascii.slice(4, 8) === "ftyp";
    case "video/webm":
      return hex.startsWith("1a45dfa3");
    case "application/pdf":
      return ascii.startsWith("%PDF");
    default:
      return false;
  }
}

/** Supprime un fichier à partir de son URL (s'il n'est plus utilisé) et son entrée de médiathèque. */
export async function deleteStoredUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const parsed = parseStoredUrl(url);
  if (!parsed || !validObjectPath(parsed.objectPath)) return;
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
