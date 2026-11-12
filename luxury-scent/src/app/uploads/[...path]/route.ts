import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { isSupabaseStorage, localUploadPath, MEDIA_BUCKET } from "@/lib/storage";

const TYPES: Record<string, string> = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", avif: "image/avif", mp4: "video/mp4", webm: "video/webm" };

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  // Développement local uniquement : en production les médias sont servis par Supabase Storage.
  if (isSupabaseStorage() || path[0] === "_private") return new Response("Introuvable", { status: 404 });
  const abs = localUploadPath(MEDIA_BUCKET, path.join("/"));
  if (!abs) return new Response("Introuvable", { status: 404 });
  try {
    const s = await stat(abs);
    if (!s.isFile()) return new Response("Introuvable", { status: 404 });
    const ext = abs.split(".").pop()?.toLowerCase() ?? "";
    const type = TYPES[ext] ?? "application/octet-stream";
    const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(s.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
}
