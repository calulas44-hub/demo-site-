import "server-only";
import Stripe from "stripe";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe n'est pas configuré (STRIPE_SECRET_KEY).");
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

interface CheckoutOrder {
  id: string;
  number: string;
  email: string;
  shippingPrice: number;
  shippingMethodName: string;
  items: { name: string; variantLabel: string; quantity: number; unitPrice: number }[];
}

/** Crée une session Stripe Checkout (page de paiement hébergée par Stripe). */
export async function createCheckoutSession(order: CheckoutOrder): Promise<string> {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((i) => ({
    quantity: i.quantity,
    price_data: {
      currency: "eur",
      unit_amount: i.unitPrice,
      product_data: { name: `${i.name} — ${i.variantLabel}` },
    },
  }));
  if (order.shippingPrice > 0) {
    line_items.push({
      quantity: 1,
      price_data: { currency: "eur", unit_amount: order.shippingPrice, product_data: { name: `Livraison — ${order.shippingMethodName}` } },
    });
  }
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: order.email,
    client_reference_id: order.id,
    metadata: { orderId: order.id, orderNumber: order.number },
    line_items,
    success_url: `${appUrl}/commande/confirmation/${encodeURIComponent(order.number)}?paiement=ok`,
    cancel_url: `${appUrl}/commande/confirmation/${encodeURIComponent(order.number)}?paiement=annule`,
    locale: "fr",
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement.");
  return session.url;
}

export function constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET manquant.");
  return stripe().webhooks.constructEvent(payload, signature, secret);
}
