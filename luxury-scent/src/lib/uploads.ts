import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { prisma } from "./db";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
const DOC_TYPES = new Set(["application/pdf"]);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_DOC_BYTES = 10 * 1024 * 1024;

export function uploadRoot(): string {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR || "./storage/uploads");
}

function safeFolder(folder: string): string {
  const f = folder.replace(/[^a-z0-9-]/gi, "").toLowerCase();
  return f || "general";
}

export interface SavedUpload {
  url: string;
  width: number | null;
  height: number | null;
  mimeType: string;
  size: number;
}

/**
 * Enregistre une image téléversée : vérification du type, ré-encodage en WebP
 * (supprime les métadonnées et neutralise les fichiers malformés), limite à 2400 px.
 */
export async function saveImage(file: File, folder = "produits", alt?: string): Promise<SavedUpload> {
  if (!IMAGE_TYPES.has(file.type)) throw new Error("Format d'image non pris en charge (JPEG, PNG, WebP, AVIF ou GIF).");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image trop volumineuse (20 Mo maximum).");
  const input = Buffer.from(await file.arrayBuffer());
  let pipeline = sharp(input, { failOn: "error", animated: false }).rotate();
  const meta = await pipeline.metadata();
  if (!meta.width || !meta.height) throw new Error("Image illisible.");
  pipeline = pipeline.resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true });
  const output = await pipeline.webp({ quality: 86 }).toBuffer();
  const outMeta = await sharp(output).metadata();

  const dir = safeFolder(folder);
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.webp`;
  const absDir = path.join(uploadRoot(), dir);
  await mkdir(absDir, { recursive: true });
  await writeFile(path.join(absDir, name), output);

  const url = `/uploads/${dir}/${name}`;
  await prisma.media.create({
    data: {
      url,
      filename: file.name.slice(0, 200),
      mimeType: "image/webp",
      size: output.length,
      width: outMeta.width ?? null,
      height: outMeta.height ?? null,
      alt: alt ?? null,
      folder: dir,
    },
  });
  return { url, width: outMeta.width ?? null, height: outMeta.height ?? null, mimeType: "image/webp", size: output.length };
}

/** Enregistre un document (reçu, facture fournisseur) sans transformation. */
export async function saveDocument(file: File, folder = "documents"): Promise<SavedUpload> {
  if (!DOC_TYPES.has(file.type) && !IMAGE_TYPES.has(file.type)) throw new Error("Format non pris en charge (PDF ou image).");
  if (file.size > MAX_DOC_BYTES) throw new Error("Fichier trop volumineux (10 Mo maximum).");
  if (IMAGE_TYPES.has(file.type)) return saveImage(file, folder);
  const buf = Buffer.from(await file.arrayBuffer());
  if (!buf.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Le fichier n'est pas un PDF valide.");
  const dir = safeFolder(folder);
  const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.pdf`;
  const absDir = path.join(uploadRoot(), dir);
  await mkdir(absDir, { recursive: true });
  await writeFile(path.join(absDir, name), buf);
  const url = `/uploads/${dir}/${name}`;
  await prisma.media.create({
    data: { url, filename: file.name.slice(0, 200), mimeType: "application/pdf", size: buf.length, folder: dir },
  });
  return { url, width: null, height: null, mimeType: "application/pdf", size: buf.length };
}

export async function deleteUpload(url: string): Promise<void> {
  if (!url.startsWith("/uploads/")) return;
  const rel = url.slice("/uploads/".length);
  if (rel.includes("..")) return;
  const abs = path.join(uploadRoot(), rel);
  try {
    await unlink(abs);
  } catch {
    // Fichier déjà absent : on nettoie quand même la base.
  }
  await prisma.media.deleteMany({ where: { url } });
}

/** Résout une URL /uploads/... en chemin absolu sûr, ou null. */
export function resolveUploadPath(segments: string[]): string | null {
  const rel = segments.join("/");
  if (!rel || rel.includes("..") || rel.includes("\0")) return null;
  const abs = path.join(uploadRoot(), rel);
  if (!abs.startsWith(uploadRoot())) return null;
  return abs;
}
