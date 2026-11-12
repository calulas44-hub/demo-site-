import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { CartDetails } from "./cart";
import { getSettings } from "./settings";
import { orderTaxBreakdown, postCreditNote, postInvoice, postPayment } from "./accounting";
import { sendOrderConfirmation, sendOrderStatusUpdate } from "./email";
import { getActiveBankDetails } from "./bank";
import type { OrderStatus } from "./constants";

type Tx = Prisma.TransactionClient;

// ------------------------------------------------------------------ Numérotation

export async function nextNumber(tx: Tx, kind: "ORDER" | "INVOICE" | "CREDIT", date = new Date()): Promise<string> {
  const year = date.getFullYear();
  const key = `${kind}_${year}`;
  const counter = await tx.counter.upsert({ where: { key }, create: { key, value: 1 }, update: { value: { increment: 1 } } });
  const prefix = kind === "ORDER" ? "LS" : kind === "INVOICE" ? "F" : "AV";
  const width = kind === "ORDER" ? 5 : 4;
  return `${prefix}-${year}-${String(counter.value).padStart(width, "0")}`;
}

// ------------------------------------------------------------------ Livraison

export function computeShippingPrice(method: { price: number; freeAbove: number | null }, subtotal: number): number {
  if (method.freeAbove !== null && subtotal >= method.freeAbove) return 0;
  return method.price;
}

export async function getShippingOptions(country: string, subtotal: number) {
  const methods = await prisma.shippingMethod.findMany({ where: { active: true }, orderBy: { position: "asc" } });
  return methods
    .filter((m) => {
      const list = m.countries.split(",").map((c) => c.trim().toUpperCase());
      return list.includes("*") || list.includes(country.toUpperCase());
    })
    .map((m) => ({ ...m, computedPrice: computeShippingPrice(m, subtotal) }));
}

// ------------------------------------------------------------------ Création

export interface AddressInput {
  firstName: string;
  lastName: string;
  company: string | null;
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  country: string;
  phone: string | null;
}

export interface CreateOrderInput {
  email: string;
  customerId: string | null;
  shipping: AddressInput;
  billing: AddressInput;
  shippingMethodId: string;
  paymentMethod: "BANK_TRANSFER" | "CARD";
  customerNote: string | null;
}

export class OrderError extends Error {}

export async function createOrder(cart: CartDetails, input: CreateOrderInput) {
  if (cart.lines.length === 0) throw new OrderError("Votre panier est vide.");
  const settings = await getSettings();
  const method = await prisma.shippingMethod.findFirst({ where: { id: input.shippingMethodId, active: true } });
  if (!method) throw new OrderError("Mode de livraison indisponible.");
  // Remise recalculée ici, côté serveur, à partir des prix en base (jamais transmise par le navigateur).
  const discount = cart.discount;
  if (discount && !cart.lines.some((l) => l.variantId === discount.variantId)) throw new OrderError("Remise invalide.");
  const discountAmount = discount?.amount ?? 0;
  const shippingPrice = computeShippingPrice(method, cart.subtotal - discountAmount);

  return prisma.$transaction(async (tx) => {
    // Vérifie et réserve le stock.
    for (const line of cart.lines) {
      const updated = await tx.productVariant.updateMany({
        where: { id: line.variantId, active: true, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      });
      if (updated.count !== 1) throw new OrderError(`Stock insuffisant pour ${line.name} (${line.variantLabel}).`);
    }
    const number = await nextNumber(tx, "ORDER");
    const subtotal = cart.subtotal;
    const total = subtotal - discountAmount + shippingPrice;
    const breakdown = orderTaxBreakdown({ shippingPrice, vatRate: settings.vatRate, discount: discountAmount, items: cart.lines.map((l) => ({ total: l.total, vatRate: l.vatRate })) });

    const order = await tx.order.create({
      data: {
        number,
        customerId: input.customerId,
        email: input.email,
        status: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
        paymentMethod: input.paymentMethod,
        shipFirstName: input.shipping.firstName,
        shipLastName: input.shipping.lastName,
        shipCompany: input.shipping.company,
        shipLine1: input.shipping.line1,
        shipLine2: input.shipping.line2,
        shipPostalCode: input.shipping.postalCode,
        shipCity: input.shipping.city,
        shipCountry: input.shipping.country,
        shipPhone: input.shipping.phone,
        billFirstName: input.billing.firstName,
        billLastName: input.billing.lastName,
        billCompany: input.billing.company,
        billLine1: input.billing.line1,
        billLine2: input.billing.line2,
        billPostalCode: input.billing.postalCode,
        billCity: input.billing.city,
        billCountry: input.billing.country,
        shippingMethodName: method.name,
        shippingPrice,
        subtotal,
        discount: discountAmount,
        discountLabel: discount ? discount.label : null,
        taxTotal: breakdown.totalTva,
        total,
        vatRate: settings.vatRate,
        currency: settings.currency,
        customerNote: input.customerNote,
        items: {
          create: cart.lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            name: l.name,
            variantLabel: l.variantLabel,
            sku: l.sku,
            imageUrl: l.imageUrl,
            unitPrice: l.unitPrice,
            costPrice: l.costPrice,
            quantity: l.quantity,
            total: l.total,
            vatRate: l.vatRate,
          })),
        },
        statusHistory: { create: { status: "PENDING_PAYMENT", note: "Commande créée" } },
      },
      include: { items: true },
    });
    return order;
  });
}

// ------------------------------------------------------------------ Paiement et facture

const orderEmailInclude = { items: true } satisfies Prisma.OrderInclude;

/** Marque une commande comme payée : facture, écritures, e-mail. Idempotent. */
export async function markOrderPaid(orderId: string, opts: { paymentRef?: string | null; adminUserId?: string | null; note?: string } = {}) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true, invoice: true } });
    if (!order) throw new OrderError("Commande introuvable.");
    if (order.paymentStatus === "PAID" && order.invoice) return { order, created: false };
    const now = new Date();
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: order.status === "PENDING_PAYMENT" ? "PAID" : order.status,
        paymentStatus: "PAID",
        paidAt: order.paidAt ?? now,
        paymentRef: opts.paymentRef ?? order.paymentRef,
        statusHistory: { create: { status: "PAID", note: opts.note ?? "Paiement reçu", adminUserId: opts.adminUserId ?? null } },
      },
      include: orderEmailInclude,
    });
    if (!order.invoice) {
      const number = await nextNumber(tx, "INVOICE", now);
      const b = orderTaxBreakdown(order);
      const invoice = await tx.invoice.create({
        data: { number, orderId, issuedAt: now, totalHt: b.totalHt, totalTva: b.totalTva, totalTtc: b.totalTtc },
      });
      await postInvoice(tx, invoice, order);
      await postPayment(tx, order, now);
    }
    return { order: updated, created: true };
  });
  if (result.created) await sendOrderStatusUpdate(result.order, "PAID");
  return result.order;
}

// ------------------------------------------------------------------ Statuts

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  opts: { note?: string | null; adminUserId?: string | null; carrier?: string | null; trackingNumber?: string | null; notify?: boolean } = {},
) {
  if (status === "PAID") return markOrderPaid(orderId, { adminUserId: opts.adminUserId, note: opts.note ?? undefined });
  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!current) throw new OrderError("Commande introuvable.");
    if (status === "CANCELLED" && current.status !== "CANCELLED") {
      // Remise en stock
      for (const it of current.items) {
        if (it.variantId) await tx.productVariant.update({ where: { id: it.variantId }, data: { stock: { increment: it.quantity } } });
      }
    }
    const data: Prisma.OrderUpdateInput = {
      status,
      statusHistory: { create: { status, note: opts.note ?? null, adminUserId: opts.adminUserId ?? null } },
    };
    if (status === "SHIPPED") {
      data.shippedAt = current.shippedAt ?? new Date();
      if (opts.carrier !== undefined) data.carrier = opts.carrier;
      if (opts.trackingNumber !== undefined) data.trackingNumber = opts.trackingNumber;
    }
    if (status === "CANCELLED" && current.paymentStatus === "PENDING") data.paymentStatus = "FAILED";
    return tx.order.update({ where: { id: orderId }, data, include: orderEmailInclude });
  });
  if (opts.notify !== false && ["SHIPPED", "DELIVERED", "CANCELLED"].includes(status)) {
    await sendOrderStatusUpdate(order, status);
  }
  return order;
}

// ------------------------------------------------------------------ Remboursements et avoirs

export async function refundOrder(orderId: string, amount: number, reason: string | null, adminUserId: string, method: "BANK_TRANSFER" | "CARD" = "BANK_TRANSFER") {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { refunds: true } });
    if (!order) throw new OrderError("Commande introuvable.");
    if (order.paymentStatus !== "PAID" && order.paymentStatus !== "PARTIALLY_REFUNDED") throw new OrderError("Seule une commande payée peut être remboursée.");
    const already = order.refunds.reduce((s, r) => s + r.amount, 0);
    if (amount <= 0 || amount + already > order.total) throw new OrderError("Montant de remboursement invalide.");
    const now = new Date();
    const number = await nextNumber(tx, "CREDIT", now);
    const note = await tx.creditNote.create({ data: { number, orderId, amount, reason, issuedAt: now } });
    await tx.refund.create({ data: { orderId, amount, reason, method, creditNoteId: note.id } });
    await postCreditNote(tx, note, order, true);
    const full = amount + already >= order.total;
    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: full ? "REFUNDED" : "PARTIALLY_REFUNDED",
        status: full ? "REFUNDED" : order.status,
        statusHistory: { create: { status: full ? "REFUNDED" : order.status, note: `Avoir ${number} : remboursement de ${(amount / 100).toFixed(2)} €${reason ? " — " + reason : ""}`, adminUserId } },
      },
    });
    return note;
  });
}

// ------------------------------------------------------------------ Confirmation e-mail après création

export async function sendCreatedOrderEmail(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderEmailInclude });
  if (!order) return;
  let bankText: string | null = null;
  if (order.paymentMethod === "BANK_TRANSFER") {
    const bank = await getActiveBankDetails();
    if (bank) {
      bankText = `Titulaire : ${escape(bank.holderName)}<br>IBAN : ${escape(bank.iban)}${bank.bic ? `<br>BIC : ${escape(bank.bic)}` : ""}${bank.bankName ? `<br>Banque : ${escape(bank.bankName)}` : ""}`;
    }
  }
  await sendOrderConfirmation(order, bankText);
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

export async function findOrderForCustomerView(number: string, email: string) {
  return prisma.order.findFirst({
    where: { number, email: email.toLowerCase().trim() },
    include: { items: true, statusHistory: { orderBy: { createdAt: "asc" } }, invoice: true },
  });
}
