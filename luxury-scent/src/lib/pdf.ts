import "server-only";
import PDFDocument from "pdfkit";
import { prisma } from "./db";
import { getSettings, type SiteSettings } from "./settings";
import { getActiveBankDetails } from "./bank";
import { orderTaxBreakdown } from "./accounting";
import { formatPrice } from "./money";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "./constants";

const INK = "#1c1a17";
const MUTED = "#6f685f";
const LINE = "#e3dcd1";

function render(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, info: { Producer: "Luxury Scent" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    build(doc);
    doc.end();
  });
}

function addressBlock(doc: PDFKit.PDFDocument, x: number, y: number, title: string, lines: (string | null | undefined)[]) {
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text(title.toUpperCase(), x, y, { characterSpacing: 1 });
  doc.font("Helvetica").fontSize(10).fillColor(INK);
  let yy = y + 14;
  for (const l of lines) {
    if (!l) continue;
    doc.text(l, x, yy, { width: 240 });
    yy += 13;
  }
  return yy;
}

function header(doc: PDFKit.PDFDocument, s: SiteSettings, kind: string, number: string, date: Date, orderLine: string) {
  doc.font("Helvetica").fontSize(18).fillColor(INK).text(s.brandName.toUpperCase(), 50, 50, { characterSpacing: 4 });
  doc.fontSize(9).fillColor(MUTED).text(s.tagline, 50, 74);
  doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text(kind, 350, 50, { width: 195, align: "right" });
  doc.font("Helvetica").fontSize(10).fillColor(INK).text(`N° ${number}`, 350, 72, { width: 195, align: "right" });
  doc.fillColor(MUTED).text(`Date : ${date.toLocaleDateString("fr-FR")}`, 350, 86, { width: 195, align: "right" });
  doc.text(orderLine, 350, 100, { width: 195, align: "right" });
  doc.moveTo(50, 120).lineTo(545, 120).strokeColor(LINE).lineWidth(1).stroke();
}

function companyLines(s: SiteSettings): (string | null)[] {
  return [
    s.companyLegalName || s.brandName,
    s.companyForm && s.shareCapital ? `${s.companyForm} au capital de ${s.shareCapital}` : s.companyForm || null,
    ...s.address.split("\n"),
    s.siret ? `SIRET ${s.siret}` : null,
    s.vatNumber ? `TVA ${s.vatNumber}` : null,
    s.rcs ? `RCS ${s.rcs}` : null,
    s.contactEmail,
    s.contactPhone,
  ];
}

function table(doc: PDFKit.PDFDocument, y: number, rows: { label: string; detail: string; qty: string; unit: string; total: string }[]) {
  const cols = { label: 50, qty: 350, unit: 410, total: 480 };
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED);
  doc.text("DÉSIGNATION", cols.label, y, { characterSpacing: 1 });
  doc.text("QTÉ", cols.qty, y, { width: 50, align: "right" });
  doc.text("PU TTC", cols.unit, y, { width: 60, align: "right" });
  doc.text("TOTAL TTC", cols.total, y, { width: 65, align: "right" });
  y += 14;
  doc.moveTo(50, y).lineTo(545, y).strokeColor(LINE).stroke();
  y += 8;
  for (const r of rows) {
    doc.font("Helvetica").fontSize(10).fillColor(INK);
    doc.text(r.label, cols.label, y, { width: 290 });
    if (r.detail) doc.fontSize(8).fillColor(MUTED).text(r.detail, cols.label, y + 12, { width: 290 });
    doc.fontSize(10).fillColor(INK);
    doc.text(r.qty, cols.qty, y, { width: 50, align: "right" });
    doc.text(r.unit, cols.unit, y, { width: 60, align: "right" });
    doc.text(r.total, cols.total, y, { width: 65, align: "right" });
    y += r.detail ? 28 : 18;
  }
  doc.moveTo(50, y).lineTo(545, y).strokeColor(LINE).stroke();
  return y + 10;
}

function totals(doc: PDFKit.PDFDocument, y: number, lines: [string, string, boolean?][]) {
  for (const [label, value, bold] of lines) {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 10).fillColor(bold ? INK : MUTED);
    doc.text(label, 350, y, { width: 120, align: "right" });
    doc.fillColor(INK).text(value, 480, y, { width: 65, align: "right" });
    y += 16;
  }
  return y;
}

export async function buildInvoicePdf(orderId: string): Promise<{ buffer: Buffer; filename: string }> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true, invoice: true } });
  if (!order) throw new Error("Commande introuvable.");
  const invoice = order.invoice;
  if (!invoice) throw new Error("Cette commande n'a pas encore de facture (elle n'est pas payée).");
  const [settings, bank] = await Promise.all([getSettings(), getActiveBankDetails()]);
  const showBank = bank ? (await prisma.bankAccount.findFirst({ where: { isActive: true }, select: { showOnInvoice: true } }))?.showOnInvoice : false;
  const b = orderTaxBreakdown(order);

  const buffer = await render((doc) => {
    header(doc, settings, "FACTURE", invoice.number, invoice.issuedAt, `Commande : ${order.number}`);
    const yA = addressBlock(doc, 50, 135, "Émetteur", companyLines(settings));
    const yB = addressBlock(doc, 320, 135, "Facturé à", [
      `${order.billFirstName} ${order.billLastName}`,
      order.billCompany,
      order.billLine1,
      order.billLine2,
      `${order.billPostalCode} ${order.billCity}`,
      order.billCountry,
      order.email,
    ]);
    const yC = addressBlock(doc, 320, Math.max(yA, yB) + 10, "Livré à", [
      `${order.shipFirstName} ${order.shipLastName}`,
      order.shipLine1,
      order.shipLine2,
      `${order.shipPostalCode} ${order.shipCity}`,
      order.shipCountry,
    ]);
    let y = Math.max(yA, yC) + 20;
    const rows = order.items.map((it) => ({
      label: it.name,
      detail: `${it.variantLabel}${it.sku ? " · réf. " + it.sku : ""} · TVA ${it.vatRate} %`,
      qty: String(it.quantity),
      unit: formatPrice(it.unitPrice),
      total: formatPrice(it.total),
    }));
    rows.push({ label: `Livraison — ${order.shippingMethodName}`, detail: "", qty: "1", unit: formatPrice(order.shippingPrice), total: formatPrice(order.shippingPrice) });
    y = table(doc, y, rows);
    const tl: [string, string, boolean?][] = [["Total HT", formatPrice(b.totalHt)]];
    if (order.discount > 0) tl.push(["Remise TTC", `- ${formatPrice(order.discount)}`]);
    tl.push(["TVA", formatPrice(b.totalTva)], ["Total TTC", formatPrice(b.totalTtc), true]);
    y = totals(doc, y, tl) + 10;

    doc.font("Helvetica").fontSize(9).fillColor(MUTED);
    const payLabel = PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod] ?? order.paymentMethod;
    doc.text(`Règlement : ${payLabel}${order.paidAt ? ` — payée le ${order.paidAt.toLocaleDateString("fr-FR")}` : ""}`, 50, y);
    y += 14;
    if (bank && showBank) {
      doc.text(`Coordonnées bancaires : ${bank.holderName} — IBAN ${bank.iban}${bank.bic ? " — BIC " + bank.bic : ""}`, 50, y, { width: 495 });
      y += 14;
    }
    if (settings.invoiceFooter) {
      doc.text(settings.invoiceFooter, 50, y + 6, { width: 495 });
    }
    doc.fontSize(8).fillColor(MUTED).text(
      "TVA sur les encaissements. Pas d'escompte pour règlement anticipé. En cas de retard de paiement, indemnité forfaitaire pour frais de recouvrement : 40 €.",
      50,
      780,
      { width: 495, align: "center" },
    );
  });
  return { buffer, filename: `${invoice.number}.pdf` };
}

export async function buildCreditNotePdf(creditNoteId: string): Promise<{ buffer: Buffer; filename: string }> {
  const note = await prisma.creditNote.findUnique({ where: { id: creditNoteId }, include: { order: { include: { invoice: true } } } });
  if (!note) throw new Error("Avoir introuvable.");
  const order = note.order;
  const settings = await getSettings();
  const rate = order.vatRate;
  const ht = Math.round(note.amount / (1 + rate / 100));
  const buffer = await render((doc) => {
    header(doc, settings, "AVOIR", note.number, note.issuedAt, `Commande : ${order.number}${order.invoice ? " — Facture " + order.invoice.number : ""}`);
    const yA = addressBlock(doc, 50, 135, "Émetteur", companyLines(settings));
    const yB = addressBlock(doc, 320, 135, "Client", [
      `${order.billFirstName} ${order.billLastName}`,
      order.billLine1,
      order.billLine2,
      `${order.billPostalCode} ${order.billCity}`,
      order.billCountry,
      order.email,
    ]);
    let y = Math.max(yA, yB) + 20;
    y = table(doc, y, [{ label: `Avoir sur commande ${order.number}`, detail: note.reason ?? "", qty: "1", unit: formatPrice(note.amount), total: formatPrice(note.amount) }]);
    y = totals(doc, y, [
      ["Total HT", formatPrice(ht)],
      [`TVA ${rate} %`, formatPrice(note.amount - ht)],
      ["Total TTC", formatPrice(note.amount), true],
    ]);
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Cet avoir annule partiellement ou totalement la facture mentionnée ci-dessus.", 50, y + 10);
  });
  return { buffer, filename: `${note.number}.pdf` };
}
