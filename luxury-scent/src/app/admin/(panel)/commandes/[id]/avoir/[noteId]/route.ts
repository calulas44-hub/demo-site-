import { getAdminSession } from "@/lib/auth";
import { buildCreditNotePdf } from "@/lib/pdf";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; noteId: string }> }) {
  if (!(await getAdminSession())) return new Response("Non autorisé", { status: 401 });
  const { noteId } = await ctx.params;
  try {
    const { buffer, filename } = await buildCreditNotePdf(noteId);
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"` } });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Erreur", { status: 404 });
  }
}
