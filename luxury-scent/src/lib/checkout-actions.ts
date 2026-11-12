"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { clearCart, getCartDetails } from "./cart";
import { createCustomerSession, getCustomerSession, hashPassword } from "./auth";
import { checkoutSchema, firstError } from "./validators";
import { createOrder, OrderError, sendCreatedOrderEmail, updateOrderStatus } from "./orders";
import { createCheckoutSession, isStripeConfigured } from "./stripe";
import type { FormState } from "./shop-actions";
import { LAST_ORDER_COOKIE } from "./constants";
import { getSettings } from "./settings";

function nested(formData: FormData, prefix: string) {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith(prefix + ".") && typeof v === "string") out[k.slice(prefix.length + 1)] = v;
  }
  return out;
}

export async function placeOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const billingRaw = nested(formData, "billing");
  const raw = {
    email: formData.get("email") ?? "",
    shipping: nested(formData, "shipping"),
    billingSame: formData.get("billingSame") ?? "",
    billing: Object.keys(billingRaw).length > 0 ? billingRaw : undefined,
    shippingMethodId: formData.get("shippingMethodId") ?? "",
    paymentMethod: formData.get("paymentMethod") ?? "",
    customerNote: formData.get("customerNote") ?? "",
    acceptTerms: formData.get("acceptTerms") ?? "",
    createAccount: formData.get("createAccount") ?? "",
    password: formData.get("password") ?? undefined,
  };
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const d = parsed.data;
  const settings = await getSettings();
  if (d.paymentMethod === "BANK_TRANSFER" && !settings.bankTransferEnabled) return { ok: false, message: "Le virement bancaire sera bientôt disponible." };
  if (d.paymentMethod === "CARD" && !isStripeConfigured()) return { ok: false, message: "Le paiement en ligne n'est pas encore activé sur la boutique." };

  const cart = await getCartDetails();
  if (cart.lines.length === 0) return { ok: false, message: "Votre panier est vide." };

  const session = await getCustomerSession();
  let customerId = session?.id ?? null;
  if (!customerId) {
    const existing = await prisma.customer.findUnique({ where: { email: d.email } });
    if (existing) {
      customerId = existing.id;
    } else if (d.createAccount) {
      if (!d.password || d.password.length < 10) return { ok: false, message: "Le mot de passe du compte doit contenir au moins 10 caractères." };
      const c = await prisma.customer.create({
        data: { email: d.email, passwordHash: await hashPassword(d.password), firstName: d.shipping.firstName, lastName: d.shipping.lastName, phone: d.shipping.phone },
      });
      customerId = c.id;
      await createCustomerSession(c.id, c.tokenVersion);
    } else {
      const c = await prisma.customer.create({ data: { email: d.email, firstName: d.shipping.firstName, lastName: d.shipping.lastName, phone: d.shipping.phone } });
      customerId = c.id;
    }
  }

  const billing = d.billingSame || !d.billing ? d.shipping : d.billing;
  let order;
  try {
    order = await createOrder(cart, {
      email: d.email,
      customerId,
      shipping: d.shipping,
      billing,
      shippingMethodId: d.shippingMethodId,
      paymentMethod: d.paymentMethod,
      customerNote: d.customerNote,
    });
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, message: e.message };
    throw e;
  }

  // Enregistre l'adresse pour les clients connectés qui n'en ont pas encore.
  if (session) {
    const count = await prisma.address.count({ where: { customerId: session.id } });
    if (count === 0) await prisma.address.create({ data: { customerId: session.id, ...d.shipping, isDefault: true } });
  }

  if (d.paymentMethod === "CARD") {
    let url: string;
    try {
      const s = await createCheckoutSession(order);
      await prisma.order.update({ where: { id: order.id }, data: { stripeSessionId: s.id } });
      url = s.url;
    } catch (e) {
      // Échec avant tout paiement : on annule la commande pour libérer le stock, le panier est conservé.
      await updateOrderStatus(order.id, "CANCELLED", { note: "Création de la session de paiement impossible", notify: false });
      console.error("[stripe]", e);
      return { ok: false, message: "Le paiement en ligne est momentanément indisponible. Votre panier est conservé, merci de réessayer dans quelques minutes." };
    }
    await clearCart();
    (await cookies()).set(LAST_ORDER_COOKIE, order.number, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 });
    // L'e-mail de confirmation de paiement est envoyé par le webhook Stripe (markOrderPaid).
    redirect(url);
  }

  await clearCart();
  (await cookies()).set(LAST_ORDER_COOKIE, order.number, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 });
  await sendCreatedOrderEmail(order.id);
  redirect(`/commande/confirmation/${encodeURIComponent(order.number)}`);
}
