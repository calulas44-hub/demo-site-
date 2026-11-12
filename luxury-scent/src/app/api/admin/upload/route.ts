import { getAdminSession } from "@/lib/auth";
import { CHUNK_BYTES, kindOf, MEDIA_BUCKET, partKey, PRIVATE_BUCKET, putObject, validObjectPath, verifyUploadSignature, type Bucket } from "@/lib/storage";

/**
 * Réception d'un morceau de fichier (≤ 3,5 Mo) envoyé par l'administration.
 * Exige une session admin ET une autorisation signée délivrée pour ce fichier précis.
 */
export async function PUT(request: Request) {
  if (!(await getAdminSession())) return new Response("Non autorisé", { status: 401 });
  const u = new URL(request.url);
  const bucketParam = u.searchParams.get("bucket");
  const objectPath = u.searchParams.get("path") ?? "";
  const type = u.searchParams.get("type") ?? "";
  const expires = Number(u.searchParams.get("expires") ?? 0);
  const sig = u.searchParams.get("sig") ?? "";
  const part = Number(u.searchParams.get("part") ?? -1);
  if (bucketParam !== MEDIA_BUCKET && bucketParam !== PRIVATE_BUCKET) return new Response("Stockage inconnu", { status: 400 });
  const bucket: Bucket = bucketParam;
  if (!verifyUploadSignature(bucket, objectPath, type, expires, sig)) return new Response("Autorisation invalide ou expirée", { status: 403 });
  if (!validObjectPath(objectPath) || !Number.isInteger(part) || part < 0 || part > 10) return new Response("Requête invalide", { status: 400 });
  if (!kindOf(type)) return new Response("Type refusé", { status: 415 });
  const body = Buffer.from(await request.arrayBuffer());
  if (body.length === 0 || body.length > CHUNK_BYTES) return new Response("Morceau de taille invalide", { status: 413 });
  await putObject(bucket, partKey(objectPath, part), body, "application/octet-stream");
  return new Response(null, { status: 204 });
}
