import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { ACCOUNTS, EXPENSE_ACCOUNTS, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "./constants";
import { splitVat } from "./money";

// Journal interne de gestion. Il alimente les tableaux de bord et les exports
// vers un logiciel comptable ; il ne constitue pas une comptabilité certifiée.

type Tx = Prisma.TransactionClient;

interface EntryInput {
  date: Date;
  journal: string;
  account: string;
  label: string;
  debit?: number;
  credit?: number;
  reference: string | null;
  sourceType: string;
  sourceId: string;
}

async function post(tx: Tx, entries: EntryInput[]) {
  await tx.ledgerEntry.createMany({
    data: entries.map((e) => ({ ...e, debit: e.debit ?? 0, credit: e.credit ?? 0 })),
  });
}

export async function removeEntries(tx: Tx, sourceType: string, sourceId: string) {
  await tx.ledgerEntry.deleteMany({ where: { sourceType, sourceId } });
}

/** Décompose une commande en HT / TVA (articles + port). */
export function orderTaxBreakdown(order: {
  shippingPrice: number;
  vatRate: number;
  discount: number;
  items: { total: number; vatRate: number }[];
}) {
  let itemsHt = 0;
  let itemsTva = 0;
  for (const it of order.items) {
    const s = splitVat(it.total, it.vatRate);
    itemsHt += s.ht;
    itemsTva += s.tva;
  }
  const ship = splitVat(order.shippingPrice, order.vatRate);
  const disc = splitVat(order.discount, order.vatRate);
  return {
    itemsHt,
    itemsTva,
    shippingHt: ship.ht,
    shippingTva: ship.tva,
    discountHt: disc.ht,
    discountTva: disc.tva,
    totalHt: itemsHt + ship.ht - disc.ht,
    totalTva: itemsTva + ship.tva - disc.tva,
    totalTtc: order.items.reduce((s, i) => s + i.total, 0) + order.shippingPrice - order.discount,
  };
}

export async function postInvoice(
  tx: Tx,
  invoice: { id: string; number: string; issuedAt: Date },
  order: { number: string; shippingPrice: number; vatRate: number; discount: number; items: { total: number; vatRate: number }[] },
) {
  const b = orderTaxBreakdown(order);
  const base = { date: invoice.issuedAt, journal: "VENTES", reference: invoice.number, sourceType: "INVOICE", sourceId: invoice.id };
  const entries: EntryInput[] = [
    { ...base, account: ACCOUNTS.CLIENTS, label: `Facture ${invoice.number} — commande ${order.number}`, debit: b.totalTtc },
    { ...base, account: ACCOUNTS.VENTES_MARCHANDISES, label: `Ventes ${invoice.number}`, credit: b.itemsHt },
  ];
  if (b.shippingHt > 0) entries.push({ ...base, account: ACCOUNTS.PORT_FACTURE, label: `Port facturé ${invoice.number}`, credit: b.shippingHt });
  if (b.discountHt > 0) entries.push({ ...base, account: ACCOUNTS.RABAIS_REMISES, label: `Remise ${invoice.number}`, debit: b.discountHt });
  if (b.totalTva !== 0) entries.push({ ...base, account: ACCOUNTS.TVA_COLLECTEE, label: `TVA collectée ${invoice.number}`, credit: b.totalTva });
  await post(tx, entries);
}

export async function postPayment(tx: Tx, order: { id: string; number: string; total: number; paymentMethod: string }, date: Date) {
  const label = `Règlement commande ${order.number} (${order.paymentMethod === "CARD" ? "carte" : "virement"})`;
  const base = { date, journal: "BANQUE", reference: order.number, sourceType: "PAYMENT", sourceId: order.id };
  await post(tx, [
    { ...base, account: ACCOUNTS.BANQUE, label, debit: order.total },
    { ...base, account: ACCOUNTS.CLIENTS, label, credit: order.total },
  ]);
}

export async function postCreditNote(
  tx: Tx,
  note: { id: string; number: string; amount: number; issuedAt: Date },
  order: { number: string; vatRate: number },
  refunded: boolean,
) {
  const s = splitVat(note.amount, order.vatRate);
  const base = { date: note.issuedAt, journal: "VENTES", reference: note.number, sourceType: "CREDIT_NOTE", sourceId: note.id };
  const entries: EntryInput[] = [
    { ...base, account: ACCOUNTS.VENTES_MARCHANDISES, label: `Avoir ${note.number} — commande ${order.number}`, debit: s.ht },
    { ...base, account: ACCOUNTS.TVA_COLLECTEE, label: `TVA sur avoir ${note.number}`, debit: s.tva },
    { ...base, account: ACCOUNTS.CLIENTS, label: `Avoir ${note.number}`, credit: note.amount },
  ];
  if (refunded) {
    entries.push(
      { ...base, journal: "BANQUE", sourceType: "REFUND", account: ACCOUNTS.CLIENTS, label: `Remboursement ${note.number}`, debit: note.amount },
      { ...base, journal: "BANQUE", sourceType: "REFUND", account: ACCOUNTS.BANQUE, label: `Remboursement ${note.number}`, credit: note.amount },
    );
  }
  await post(tx, entries);
}

export async function postExpense(
  tx: Tx,
  expense: { id: string; date: Date; label: string; category: string; amountHt: number; vatAmount: number; amountTtc: number; invoiceNumber: string | null; supplier: string | null },
) {
  await removeEntries(tx, "EXPENSE", expense.id);
  const account = EXPENSE_ACCOUNTS[expense.category as ExpenseCategory] ?? ACCOUNTS.AUTRES_CHARGES;
  const ref = expense.invoiceNumber ?? null;
  const who = expense.supplier ? ` — ${expense.supplier}` : "";
  const base = { date: expense.date, journal: "ACHATS", reference: ref, sourceType: "EXPENSE", sourceId: expense.id };
  const entries: EntryInput[] = [
    { ...base, account, label: `${expense.label}${who}`, debit: expense.amountHt },
    { ...base, account: ACCOUNTS.FOURNISSEURS, label: `${expense.label}${who}`, credit: expense.amountTtc },
  ];
  if (expense.vatAmount > 0) entries.splice(1, 0, { ...base, account: ACCOUNTS.TVA_DEDUCTIBLE, label: `TVA déductible — ${expense.label}`, debit: expense.vatAmount });
  entries.push(
    { ...base, journal: "BANQUE", account: ACCOUNTS.FOURNISSEURS, label: `Paiement ${expense.label}${who}`, debit: expense.amountTtc },
    { ...base, journal: "BANQUE", account: ACCOUNTS.BANQUE, label: `Paiement ${expense.label}${who}`, credit: expense.amountTtc },
  );
  await post(tx, entries);
}

// ------------------------------------------------------------------ Tableaux de bord

export interface Period {
  from: Date;
  to: Date;
}

export function periodFromSearch(preset: string | undefined, fromStr?: string, toStr?: string): Period & { preset: string } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  if (preset === "custom" && fromStr && toStr) {
    return { preset, from: startOfDay(new Date(fromStr)), to: endOfDay(new Date(toStr)) };
  }
  switch (preset) {
    case "today":
      return { preset, from: startOfDay(now), to: endOfDay(now) };
    case "7d":
      return { preset, from: startOfDay(new Date(now.getTime() - 6 * 86400000)), to: endOfDay(now) };
    case "year":
      return { preset, from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
    case "last_month": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { preset, from: first, to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999) };
    }
    case "month":
    default:
      return { preset: "month", from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
  }
}

export async function getFinanceOverview(period: Period) {
  const [invoices, creditNotes, expenses, paidOrders, pendingOrders] = await Promise.all([
    prisma.invoice.findMany({ where: { issuedAt: { gte: period.from, lte: period.to } }, include: { order: { include: { items: true } } } }),
    prisma.creditNote.findMany({ where: { issuedAt: { gte: period.from, lte: period.to } }, include: { order: true } }),
    prisma.expense.findMany({ where: { date: { gte: period.from, lte: period.to } } }),
    prisma.order.findMany({
      where: { paidAt: { gte: period.from, lte: period.to }, paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } },
      include: { items: true },
    }),
    prisma.order.count({ where: { status: "PENDING_PAYMENT" } }),
  ]);

  let revenueTtc = 0;
  let revenueHt = 0;
  let vatCollected = 0;
  for (const inv of invoices) {
    revenueTtc += inv.totalTtc;
    revenueHt += inv.totalHt;
    vatCollected += inv.totalTva;
  }
  let creditTtc = 0;
  let creditHt = 0;
  let creditTva = 0;
  for (const cn of creditNotes) {
    const s = splitVat(cn.amount, cn.order.vatRate);
    creditTtc += cn.amount;
    creditHt += s.ht;
    creditTva += s.tva;
  }
  let expensesHt = 0;
  let expensesTtc = 0;
  let vatDeductible = 0;
  const expensesByCategory = new Map<string, number>();
  for (const e of expenses) {
    expensesHt += e.amountHt;
    expensesTtc += e.amountTtc;
    vatDeductible += e.vatAmount;
    expensesByCategory.set(e.category, (expensesByCategory.get(e.category) ?? 0) + e.amountHt);
  }

  // Marge brute : (prix de vente HT − coût d'achat HT) par article vendu.
  let cogs = 0;
  let marginBase = 0;
  const productStats = new Map<string, { name: string; quantity: number; revenueHt: number; cost: number }>();
  for (const o of paidOrders) {
    for (const it of o.items) {
      const ht = splitVat(it.total, it.vatRate).ht;
      const cost = (it.costPrice ?? 0) * it.quantity;
      marginBase += ht;
      cogs += cost;
      const key = it.productId ?? it.name;
      const ps = productStats.get(key) ?? { name: it.name, quantity: 0, revenueHt: 0, cost: 0 };
      ps.quantity += it.quantity;
      ps.revenueHt += ht;
      ps.cost += cost;
      productStats.set(key, ps);
    }
  }

  // Série temporelle (par jour) des ventes TTC encaissées.
  const series = new Map<string, number>();
  for (const o of paidOrders) {
    const key = o.paidAt!.toISOString().slice(0, 10);
    series.set(key, (series.get(key) ?? 0) + o.total);
  }

  const topProducts = [...productStats.values()]
    .map((p) => ({ ...p, margin: p.revenueHt - p.cost, marginRate: p.revenueHt > 0 ? ((p.revenueHt - p.cost) / p.revenueHt) * 100 : 0 }))
    .sort((a, b) => b.revenueHt - a.revenueHt)
    .slice(0, 10);

  return {
    period,
    invoicesCount: invoices.length,
    ordersCount: paidOrders.length,
    averageBasket: paidOrders.length ? Math.round(paidOrders.reduce((s, o) => s + o.total, 0) / paidOrders.length) : 0,
    revenueTtc,
    revenueHt,
    vatCollected,
    creditTtc,
    creditHt,
    creditTva,
    netRevenueHt: revenueHt - creditHt,
    expensesHt,
    expensesTtc,
    vatDeductible,
    vatBalance: vatCollected - creditTva - vatDeductible,
    grossMargin: marginBase - cogs,
    grossMarginRate: marginBase > 0 ? ((marginBase - cogs) / marginBase) * 100 : 0,
    result: revenueHt - creditHt - expensesHt,
    pendingOrders,
    expensesByCategory: [...expensesByCategory.entries()].map(([category, amountHt]) => ({
      category,
      label: EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] ?? category,
      amountHt,
    })),
    series: [...series.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, total]) => ({ date, total })),
    topProducts,
  };
}

// ------------------------------------------------------------------ Exports

function csvEscape(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function euros(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("fr-FR");
}

export async function exportLedgerCsv(period: Period): Promise<string> {
  const rows = await prisma.ledgerEntry.findMany({ where: { date: { gte: period.from, lte: period.to } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  const lines = ["Date;Journal;Compte;Libellé;Débit;Crédit;Pièce"];
  for (const r of rows) {
    lines.push([fmtDate(r.date), r.journal, r.account, r.label, euros(r.debit), euros(r.credit), r.reference ?? ""].map(csvEscape).join(";"));
  }
  return "﻿" + lines.join("\r\n");
}

export async function exportSalesCsv(period: Period): Promise<string> {
  const invoices = await prisma.invoice.findMany({ where: { issuedAt: { gte: period.from, lte: period.to } }, include: { order: true }, orderBy: { issuedAt: "asc" } });
  const lines = ["Date;Facture;Commande;Client;E-mail;Paiement;HT;TVA;TTC"];
  for (const i of invoices) {
    lines.push(
      [fmtDate(i.issuedAt), i.number, i.order.number, `${i.order.billFirstName} ${i.order.billLastName}`, i.order.email, i.order.paymentMethod, euros(i.totalHt), euros(i.totalTva), euros(i.totalTtc)]
        .map(csvEscape)
        .join(";"),
    );
  }
  return "﻿" + lines.join("\r\n");
}

export async function exportExpensesCsv(period: Period): Promise<string> {
  const rows = await prisma.expense.findMany({ where: { date: { gte: period.from, lte: period.to } }, orderBy: { date: "asc" } });
  const lines = ["Date;Libellé;Fournisseur;Catégorie;N° facture;HT;Taux TVA;TVA;TTC;Paiement"];
  for (const e of rows) {
    lines.push(
      [fmtDate(e.date), e.label, e.supplier ?? "", EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category, e.invoiceNumber ?? "", euros(e.amountHt), e.vatRate, euros(e.vatAmount), euros(e.amountTtc), e.paymentMethod ?? ""]
        .map(csvEscape)
        .join(";"),
    );
  }
  return "﻿" + lines.join("\r\n");
}

export async function exportWorkbook(period: Period): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Luxury Scent";
  const money = "#,##0.00 €";

  const [invoices, expenses, ledger, creditNotes] = await Promise.all([
    prisma.invoice.findMany({ where: { issuedAt: { gte: period.from, lte: period.to } }, include: { order: { include: { items: true } } }, orderBy: { issuedAt: "asc" } }),
    prisma.expense.findMany({ where: { date: { gte: period.from, lte: period.to } }, orderBy: { date: "asc" } }),
    prisma.ledgerEntry.findMany({ where: { date: { gte: period.from, lte: period.to } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.creditNote.findMany({ where: { issuedAt: { gte: period.from, lte: period.to } }, include: { order: true }, orderBy: { issuedAt: "asc" } }),
  ]);

  const sales = wb.addWorksheet("Ventes");
  sales.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Facture", key: "invoice", width: 16 },
    { header: "Commande", key: "order", width: 16 },
    { header: "Client", key: "client", width: 28 },
    { header: "Paiement", key: "payment", width: 14 },
    { header: "HT", key: "ht", width: 12, style: { numFmt: money } },
    { header: "TVA", key: "tva", width: 12, style: { numFmt: money } },
    { header: "TTC", key: "ttc", width: 12, style: { numFmt: money } },
  ];
  for (const i of invoices) {
    sales.addRow({ date: i.issuedAt, invoice: i.number, order: i.order.number, client: `${i.order.billFirstName} ${i.order.billLastName}`, payment: i.order.paymentMethod, ht: i.totalHt / 100, tva: i.totalTva / 100, ttc: i.totalTtc / 100 });
  }

  const lines = wb.addWorksheet("Lignes de vente");
  lines.columns = [
    { header: "Facture", key: "invoice", width: 16 },
    { header: "Produit", key: "name", width: 32 },
    { header: "Contenance", key: "variant", width: 12 },
    { header: "Quantité", key: "qty", width: 10 },
    { header: "PU TTC", key: "unit", width: 12, style: { numFmt: money } },
    { header: "Total TTC", key: "total", width: 12, style: { numFmt: money } },
    { header: "Coût HT", key: "cost", width: 12, style: { numFmt: money } },
  ];
  for (const i of invoices) for (const it of i.order.items) lines.addRow({ invoice: i.number, name: it.name, variant: it.variantLabel, qty: it.quantity, unit: it.unitPrice / 100, total: it.total / 100, cost: ((it.costPrice ?? 0) * it.quantity) / 100 });

  const credits = wb.addWorksheet("Avoirs");
  credits.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Avoir", key: "number", width: 16 },
    { header: "Commande", key: "order", width: 16 },
    { header: "Montant TTC", key: "amount", width: 14, style: { numFmt: money } },
    { header: "Motif", key: "reason", width: 40 },
  ];
  for (const c of creditNotes) credits.addRow({ date: c.issuedAt, number: c.number, order: c.order.number, amount: c.amount / 100, reason: c.reason ?? "" });

  const exp = wb.addWorksheet("Dépenses");
  exp.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Libellé", key: "label", width: 32 },
    { header: "Fournisseur", key: "supplier", width: 24 },
    { header: "Catégorie", key: "category", width: 24 },
    { header: "N° facture", key: "invoice", width: 16 },
    { header: "HT", key: "ht", width: 12, style: { numFmt: money } },
    { header: "TVA", key: "tva", width: 12, style: { numFmt: money } },
    { header: "TTC", key: "ttc", width: 12, style: { numFmt: money } },
  ];
  for (const e of expenses) exp.addRow({ date: e.date, label: e.label, supplier: e.supplier ?? "", category: EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category, invoice: e.invoiceNumber ?? "", ht: e.amountHt / 100, tva: e.vatAmount / 100, ttc: e.amountTtc / 100 });

  const jl = wb.addWorksheet("Journal");
  jl.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Journal", key: "journal", width: 10 },
    { header: "Compte", key: "account", width: 10 },
    { header: "Libellé", key: "label", width: 44 },
    { header: "Débit", key: "debit", width: 12, style: { numFmt: money } },
    { header: "Crédit", key: "credit", width: 12, style: { numFmt: money } },
    { header: "Pièce", key: "ref", width: 16 },
  ];
  for (const r of ledger) jl.addRow({ date: r.date, journal: r.journal, account: r.account, label: r.label, debit: r.debit / 100, credit: r.credit / 100, ref: r.reference ?? "" });

  for (const ws of wb.worksheets) {
    ws.getRow(1).font = { bold: true };
    ws.getColumn("date").numFmt = "dd/mm/yyyy";
  }
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
