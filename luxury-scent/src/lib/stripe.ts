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

export interface CheckoutOrder {
  id: string;
  number: string;
  email: string;
  total: number;
  discount: number;
  discountLabel: string | null;
  shippingPrice: number;
  shippingMethodName: string;
  items: { name: string; variantLabel: string; quantity: number; unitPrice: number }[];
}

export const CHECKOUT_TTL_MINUTES = 30;

/** Paramètres de la session Stripe Checkout (exportés pour les tests : les montants viennent de la commande en base). */
export function buildCheckoutParams(order: CheckoutOrder, appUrl: string, couponId?: string): Stripe.Checkout.SessionCreateParams {
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((i) => ({
    quantity: i.quantity,
    price_data: { currency: "eur", unit_amount: i.unitPrice, product_data: { name: `${i.name} — ${i.variantLabel}` } },
  }));
  if (order.shippingPrice > 0) {
    line_items.push({ quantity: 1, price_data: { currency: "eur", unit_amount: order.shippingPrice, product_data: { name: `Livraison — ${order.shippingMethodName}` } } });
  }
  return {
    mode: "payment",
    customer_email: order.email,
    client_reference_id: order.id,
    metadata: { orderId: order.id, orderNumber: order.number },
    payment_intent_data: { metadata: { orderId: order.id, orderNumber: order.number } },
    line_items,
    ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
    // Moyens de paiement gérés depuis le tableau de bord Stripe (carte, Apple Pay, Google Pay…).
    expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_TTL_MINUTES * 60,
    success_url: `${appUrl}/commande/confirmation/${encodeURIComponent(order.number)}?paiement=ok`,
    cancel_url: `${appUrl}/commande/confirmation/${encodeURIComponent(order.number)}?paiement=annule`,
    locale: "fr",
  };
}

/** Crée une session Stripe Checkout (page de paiement hébergée par Stripe : aucune donnée de carte ne transite par le site). */
export async function createCheckoutSession(order: CheckoutOrder): Promise<{ url: string; id: string }> {
  const appUrl = (process.env.APP_URL ?? process.env.URL ?? "http://localhost:3000").replace(/\/$/, "");
  let couponId: string | undefined;
  if (order.discount > 0) {
    // Remise ponctuelle propre à cette commande (montant fixe, utilisable une seule fois).
    const coupon = await stripe().coupons.create({ amount_off: order.discount, currency: "eur", duration: "once", max_redemptions: 1, name: (order.discountLabel ?? "Remise").slice(0, 40), metadata: { orderId: order.id } });
    couponId = coupon.id;
  }
  const session = await stripe().checkout.sessions.create(buildCheckoutParams(order, appUrl, couponId), { idempotencyKey: `checkout-${order.id}` });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement.");
  return { url: session.url, id: session.id };
}

export function constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET manquant.");
  return Stripe.webhooks.constructEvent(payload, signature, secret);
}
