import "server-only";
import nodemailer from "nodemailer";
import { prisma } from "./db";
import { getSettings } from "./settings";
import { formatPrice } from "./money";
import { ORDER_STATUS_LABELS, type OrderStatus } from "./constants";

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

interface SendOptions {
  to: string;
  subject: string;
  html: string;
  template: string;
  orderId?: string | null;
}

/**
 * Envoie un e-mail via SMTP. Sans configuration SMTP, l'e-mail est journalisé
 * avec le statut SKIPPED (visible dans l'administration) et n'est pas envoyé.
 */
export async function sendEmail(opts: SendOptions): Promise<"SENT" | "FAILED" | "SKIPPED"> {
  if (!isSmtpConfigured()) {
    await prisma.emailLog.create({
      data: { to: opts.to, subject: opts.subject, template: opts.template, status: "SKIPPED", error: "SMTP non configuré", orderId: opts.orderId ?? null },
    });
    return "SKIPPED";
  }
  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transport.sendMail({ from: process.env.SMTP_FROM, to: opts.to, subject: opts.subject, html: opts.html });
    await prisma.emailLog.create({
      data: { to: opts.to, subject: opts.subject, template: opts.template, status: "SENT", orderId: opts.orderId ?? null },
    });
    return "SENT";
  } catch (error) {
    await prisma.emailLog.create({
      data: {
        to: opts.to,
        subject: opts.subject,
        template: opts.template,
        status: "FAILED",
        error: error instanceof Error ? error.message.slice(0, 500) : "Erreur inconnue",
        orderId: opts.orderId ?? null,
      },
    });
    return "FAILED";
  }
}

// ------------------------------------------------------------------ Gabarits

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

async function layout(title: string, body: string): Promise<string> {
  const s = await getSettings();
  const appUrl = process.env.APP_URL ?? "";
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f6f3ee;font-family:Georgia,'Times New Roman',serif;color:#1c1a17">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e8e2d8">
<tr><td style="padding:32px 40px 16px;text-align:center;letter-spacing:.35em;font-size:18px;text-transform:uppercase">
<a href="${appUrl}" style="color:#1c1a17;text-decoration:none">${escapeHtml(s.brandName)}</a></td></tr>
<tr><td style="padding:0 40px 8px;text-align:center;font-size:22px">${escapeHtml(title)}</td></tr>
<tr><td style="padding:16px 40px 32px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#3a3631">${body}</td></tr>
<tr><td style="padding:20px 40px;border-top:1px solid #e8e2d8;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#8a837a;text-align:center">
${escapeHtml(s.brandName)} · ${escapeHtml(s.contactEmail)} · ${escapeHtml(s.contactPhone)}</td></tr>
</table></td></tr></table></body></html>`;
}

type OrderForEmail = {
  id: string;
  number: string;
  email: string;
  total: number;
  shippingPrice: number;
  subtotal: number;
  discount: number;
  discountLabel: string | null;
  shippingMethodName: string;
  paymentMethod: string;
  shipFirstName: string;
  shipLastName: string;
  shipLine1: string;
  shipLine2: string | null;
  shipPostalCode: string;
  shipCity: string;
  shipCountry: string;
  carrier: string | null;
  trackingNumber: string | null;
  items: { name: string; variantLabel: string; quantity: number; total: number }[];
};

function itemsTable(order: OrderForEmail): string {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(i.name)} <span style="color:#8a837a">· ${escapeHtml(i.variantLabel)} × ${i.quantity}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #eee">${formatPrice(i.total)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0">${rows}
${order.discount > 0 ? `<tr><td style="padding:8px 0">${escapeHtml(order.discountLabel ?? "Remise")}</td><td align="right">− ${formatPrice(order.discount)}</td></tr>` : ""}
<tr><td style="padding:8px 0">Livraison (${escapeHtml(order.shippingMethodName)})</td><td align="right">${formatPrice(order.shippingPrice)}</td></tr>
<tr><td style="padding:8px 0;font-weight:bold">Total TTC</td><td align="right" style="font-weight:bold">${formatPrice(order.total)}</td></tr></table>`;
}

export async function sendOrderConfirmation(order: OrderForEmail, bankInstructions?: string | null) {
  const s = await getSettings();
  const appUrl = process.env.APP_URL ?? "";
  const bank =
    order.paymentMethod === "BANK_TRANSFER"
      ? `<div style="margin:16px 0;padding:16px;background:#f6f3ee;border:1px solid #e8e2d8"><strong>Règlement par virement</strong><br>Votre commande sera préparée dès réception du virement.<br>${bankInstructions ? bankInstructions : "Les coordonnées bancaires vous seront communiquées par notre service client."}<br>Merci d'indiquer la référence <strong>${escapeHtml(order.number)}</strong> dans le libellé du virement.</div>`
      : "";
  const body = `<p>Bonjour ${escapeHtml(order.shipFirstName)},</p>
<p>Nous avons bien reçu votre commande <strong>${escapeHtml(order.number)}</strong>. Merci de votre confiance.</p>
${itemsTable(order)}${bank}
<p><strong>Adresse de livraison</strong><br>${escapeHtml(order.shipFirstName)} ${escapeHtml(order.shipLastName)}<br>${escapeHtml(order.shipLine1)}${order.shipLine2 ? "<br>" + escapeHtml(order.shipLine2) : ""}<br>${escapeHtml(order.shipPostalCode)} ${escapeHtml(order.shipCity)}, ${escapeHtml(order.shipCountry)}</p>
<p><a href="${appUrl}/suivi?n=${encodeURIComponent(order.number)}&e=${encodeURIComponent(order.email)}" style="display:inline-block;padding:12px 24px;background:#1c1a17;color:#fff;text-decoration:none;letter-spacing:.15em;font-size:12px;text-transform:uppercase">Suivre ma commande</a></p>
<p>${escapeHtml(s.shippingInfo)}</p>`;
  return sendEmail({
    to: order.email,
    subject: `${s.brandName} — Confirmation de votre commande ${order.number}`,
    html: await layout("Merci pour votre commande", body),
    template: "order_confirmation",
    orderId: order.id,
  });
}

export async function sendOrderStatusUpdate(order: OrderForEmail, status: OrderStatus) {
  const s = await getSettings();
  const appUrl = process.env.APP_URL ?? "";
  let intro = `Votre commande <strong>${escapeHtml(order.number)}</strong> est maintenant : <strong>${ORDER_STATUS_LABELS[status]}</strong>.`;
  if (status === "SHIPPED") {
    intro += `<br>Transporteur : ${escapeHtml(order.carrier ?? "—")}${order.trackingNumber ? ` · Numéro de suivi : <strong>${escapeHtml(order.trackingNumber)}</strong>` : ""}`;
  }
  if (status === "PAID") intro += "<br>Votre paiement a bien été reçu. Nous préparons votre colis avec soin.";
  const body = `<p>Bonjour ${escapeHtml(order.shipFirstName)},</p><p>${intro}</p>${itemsTable(order)}
<p><a href="${appUrl}/suivi?n=${encodeURIComponent(order.number)}&e=${encodeURIComponent(order.email)}" style="display:inline-block;padding:12px 24px;background:#1c1a17;color:#fff;text-decoration:none;letter-spacing:.15em;font-size:12px;text-transform:uppercase">Suivre ma commande</a></p>`;
  return sendEmail({
    to: order.email,
    subject: `${s.brandName} — Commande ${order.number} : ${ORDER_STATUS_LABELS[status]}`,
    html: await layout(ORDER_STATUS_LABELS[status], body),
    template: `order_${status.toLowerCase()}`,
    orderId: order.id,
  });
}

export async function sendWelcome(email: string, firstName: string) {
  const s = await getSettings();
  const body = `<p>Bonjour ${escapeHtml(firstName)},</p><p>Votre compte ${escapeHtml(s.brandName)} est créé. Retrouvez vos commandes, vos adresses et vos informations dans votre espace client.</p>`;
  return sendEmail({ to: email, subject: `Bienvenue chez ${s.brandName}`, html: await layout("Bienvenue", body), template: "welcome" });
}

export async function sendContactNotification(name: string, email: string, subject: string | null, message: string) {
  const s = await getSettings();
  const body = `<p><strong>De :</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p><p><strong>Sujet :</strong> ${escapeHtml(subject ?? "—")}</p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`;
  return sendEmail({ to: s.contactEmail, subject: `[Contact] ${subject ?? "Nouveau message"}`, html: await layout("Nouveau message de contact", body), template: "contact" });
}
