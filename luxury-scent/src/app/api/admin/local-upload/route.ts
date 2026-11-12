import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAdminSession } from "@/lib/auth";
import { isSupabaseStorage, kindOf, localUploadPath, maxBytes, verifyLocalSignature } from "@/lib/storage";

/** Réception des fichiers en développement local (sans Supabase). Désactivé quand Supabase est configuré. */
export async function PUT(request: Request) {
  if (isSupabaseStorage()) return new Response("Indisponible", { status: 404 });
  if (!(await getAdminSession())) return new Response("Non autorisé", { status: 401 });
  const u = new URL(request.url);
  const objectPath = u.searchParams.get("path") ?? "";
  const type = u.searchParams.get("type") ?? "";
  const expires = Number(u.searchParams.get("expires") ?? 0);
  const sig = u.searchParams.get("sig") ?? "";
  const bucket = u.searchParams.get("bucket") ?? "media";
  if (!verifyLocalSignature(objectPath, type, expires, sig)) return new Response("Signature invalide", { status: 403 });
  if (request.headers.get("content-type") !== type) return new Response("Type inattendu", { status: 400 });
  const kind = kindOf(type);
  if (!kind) return new Response("Type refusé", { status: 415 });
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length > maxBytes(kind)) return new Response("Trop volumineux", { status: 413 });
  const abs = localUploadPath(bucket, objectPath);
  if (!abs) return new Response("Chemin invalide", { status: 400 });
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, body);
  return new Response(null, { status: 204 });
}
