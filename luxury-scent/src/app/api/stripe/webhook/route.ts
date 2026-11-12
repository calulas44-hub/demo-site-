import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { constructWebhookEvent, isStripeConfigured } from "@/lib/stripe";
import { markOrderPaid, updateOrderStatus } from "@/lib/orders";
import { prisma } from "@/lib/db";

/**
 * Webhook Stripe : seule source de vérité pour confirmer un paiement.
 * La signature est vérifiée avec STRIPE_WEBHOOK_SECRET ; le montant payé doit correspondre à la commande.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(payload, signature);
  } catch {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  if (!event.type.startsWith("checkout.session.")) return NextResponse.json({ received: true });
  const session = event.data.object as Stripe.Checkout.Session;
  const orderId = session.metadata?.orderId ?? session.client_reference_id;
  if (!orderId) return NextResponse.json({ received: true });
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ received: true });
  if (order.stripeSessionId && order.stripeSessionId !== session.id) return NextResponse.json({ received: true, ignored: "session remplacée" });

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (session.payment_status !== "paid") break; // paiement différé : attendre async_payment_succeeded
      if (session.amount_total !== order.total || (session.currency ?? "eur").toLowerCase() !== order.currency.toLowerCase()) {
        await prisma.orderStatusHistory.create({ data: { orderId, status: order.status, note: `Alerte : montant Stripe (${session.amount_total}) différent du total de la commande (${order.total}). Vérification manuelle requise.` } });
        break;
      }
      const ref = typeof session.payment_intent === "string" ? session.payment_intent : session.id;
      await markOrderPaid(orderId, { paymentRef: ref, note: "Paiement confirmé par Stripe" });
      break;
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      // Paiement abandonné ou refusé : la commande est annulée et le stock libéré.
      if (order.paymentStatus === "PENDING" && order.status === "PENDING_PAYMENT") {
        await updateOrderStatus(orderId, "CANCELLED", { note: event.type === "checkout.session.expired" ? "Session de paiement expirée (non payée)" : "Paiement refusé", notify: false });
      }
      break;
    }
  }
  return NextResponse.json({ received: true });
}
