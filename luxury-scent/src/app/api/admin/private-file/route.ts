import { readFile } from "node:fs/promises";
import { getAdminSession, canManageFinance } from "@/lib/auth";
import { isSupabaseStorage, localUploadPath, PRIVATE_BUCKET, privateReadUrl } from "@/lib/storage";

/** Lecture d'un justificatif privé (administration finances uniquement). */
export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session || !canManageFinance(session.role)) return new Response("Non autorisé", { status: 401 });
  const objectPath = new URL(request.url).searchParams.get("path") ?? "";
  if (!objectPath || objectPath.includes("..")) return new Response("Chemin invalide", { status: 400 });
  if (isSupabaseStorage()) {
    const signed = await privateReadUrl(`private:${objectPath}`, 120);
    return signed ? Response.redirect(signed, 302) : new Response("Introuvable", { status: 404 });
  }
  const abs = localUploadPath(PRIVATE_BUCKET, objectPath);
  if (!abs) return new Response("Chemin invalide", { status: 400 });
  try {
    const buf = await readFile(abs);
    const type = objectPath.endsWith(".pdf") ? "application/pdf" : objectPath.endsWith(".png") ? "image/png" : objectPath.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
}
