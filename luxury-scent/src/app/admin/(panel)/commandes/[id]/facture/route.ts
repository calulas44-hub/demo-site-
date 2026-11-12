import { getAdminSession } from "@/lib/auth";
import { buildInvoicePdf } from "@/lib/pdf";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return new Response("Non autorisé", { status: 401 });
  const { id } = await ctx.params;
  try {
    const { buffer, filename } = await buildInvoicePdf(id);
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"` } });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Erreur", { status: 404 });
  }
}
