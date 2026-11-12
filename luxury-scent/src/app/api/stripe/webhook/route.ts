import { NextResponse } from "next/server";
import { constructWebhookEvent, isStripeConfigured } from "@/lib/stripe";
import { markOrderPaid } from "@/lib/orders";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  if (!isStripeConfigured()) return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  const payload = await request.text();
  let event;
  try {
    event = constructWebhookEvent(payload, signature);
  } catch (e) {
    return NextResponse.json({ error: `Signature invalide : ${e instanceof Error ? e.message : ""}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId ?? session.client_reference_id;
    if (orderId && session.payment_status === "paid") {
      await markOrderPaid(orderId, { paymentRef: typeof session.payment_intent === "string" ? session.payment_intent : session.id, note: "Paiement par carte confirmé (Stripe)" });
    }
  }
  if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId ?? session.client_reference_id;
    if (orderId) {
      await prisma.order.updateMany({ where: { id: orderId, paymentStatus: "PENDING" }, data: { paymentStatus: "FAILED" } });
    }
  }
  return NextResponse.json({ received: true });
}
