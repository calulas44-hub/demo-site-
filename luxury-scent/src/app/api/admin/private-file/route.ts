import { canManageFinance, getAdminSession } from "@/lib/auth";
import { getObject, PRIVATE_BUCKET, validObjectPath } from "@/lib/storage";

/** Lecture d'un justificatif privé (administration finances uniquement). */
export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session || !canManageFinance(session.role)) return new Response("Non autorisé", { status: 401 });
  const objectPath = new URL(request.url).searchParams.get("path") ?? "";
  if (!validObjectPath(objectPath)) return new Response("Chemin invalide", { status: 400 });
  const obj = await getObject(PRIVATE_BUCKET, objectPath);
  if (!obj) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(obj.data), { headers: { "Content-Type": obj.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
}
