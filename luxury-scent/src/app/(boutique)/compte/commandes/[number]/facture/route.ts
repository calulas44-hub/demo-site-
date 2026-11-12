import { getCustomerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildInvoicePdf } from "@/lib/pdf";

export async function GET(_req: Request, ctx: { params: Promise<{ number: string }> }) {
  const session = await getCustomerSession();
  if (!session) return new Response("Non autorisé", { status: 401 });
  const { number } = await ctx.params;
  const order = await prisma.order.findFirst({ where: { number, customerId: session.id }, select: { id: true, invoice: { select: { id: true } } } });
  if (!order?.invoice) return new Response("Facture indisponible", { status: 404 });
  const { buffer, filename } = await buildInvoicePdf(order.id);
  return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"` } });
}
