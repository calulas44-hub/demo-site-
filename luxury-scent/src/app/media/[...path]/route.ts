import { getObject, MEDIA_BUCKET, validObjectPath } from "@/lib/storage";

/**
 * Sert les photos et vidéos du site depuis le stockage (Netlify Blobs en production).
 * Les noms de fichiers sont uniques et jamais réécrits : mise en cache longue durée par le CDN.
 * Les requêtes partielles (Range) sont prises en charge pour la lecture des vidéos (Safari/iOS).
 */
export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const objectPath = (await ctx.params).path.join("/");
  if (!validObjectPath(objectPath) || objectPath.endsWith(".pdf")) return new Response("Introuvable", { status: 404 });
  const obj = await getObject(MEDIA_BUCKET, objectPath);
  if (!obj) return new Response("Introuvable", { status: 404, headers: { "Cache-Control": "no-store" } });
  const size = obj.data.length;
  const headers: Record<string, string> = {
    "Content-Type": obj.contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Netlify-CDN-Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };
  const range = request.headers.get("range");
  const m = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    return new Response(new Uint8Array(obj.data.subarray(start, end + 1)), { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } });
  }
  return new Response(new Uint8Array(obj.data), { headers: { ...headers, "Content-Length": String(size) } });
}
