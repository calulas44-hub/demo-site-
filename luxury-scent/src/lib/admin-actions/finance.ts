"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canManageBank, canManageFinance, logAdminAction, requireAdmin, verifyPassword } from "@/lib/auth";
import { bankAccountSchema, expenseSchema, firstError, formToObject } from "@/lib/validators";
import { addVat } from "@/lib/money";
import { postExpense, removeEntries } from "@/lib/accounting";
import { saveDocument } from "@/lib/uploads";
import { activateBankAccount, createBankAccount, deleteBankAccount, revealBankAccount, updateBankAccount } from "@/lib/bank";
import type { FormState } from "@/lib/shop-actions";

// ------------------------------------------------------------------ Dépenses

export async function saveExpenseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!canManageFinance(admin.role)) return { ok: false, message: "Droits insuffisants." };
  const id = String(formData.get("id") ?? "");
  const parsed = expenseSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const d = parsed.data;
  const { tva, ttc } = addVat(d.amountHt ?? 0, d.vatRate ?? 0);
  let receiptUrl: string | undefined;
  const receipt = formData.get("receipt");
  if (receipt instanceof File && receipt.size > 0) {
    try {
      receiptUrl = (await saveDocument(receipt, "justificatifs")).url;
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Justificatif refusé." };
    }
  }
  const data = {
    date: new Date(d.date),
    label: d.label,
    supplier: d.supplier,
    category: d.category,
    amountHt: d.amountHt ?? 0,
    vatRate: d.vatRate ?? 0,
    vatAmount: tva,
    amountTtc: ttc,
    paymentMethod: d.paymentMethod,
    invoiceNumber: d.invoiceNumber,
    notes: d.notes,
    ...(receiptUrl ? { receiptUrl } : {}),
  };
  await prisma.$transaction(async (tx) => {
    const row = id ? await tx.expense.update({ where: { id }, data }) : await tx.expense.create({ data });
    await postExpense(tx, row);
  });
  await logAdminAction(admin.id, "expense", id || null, id ? "UPDATE" : "CREATE", { label: d.label, amountTtc: ttc });
  revalidatePath("/admin/comptabilite");
  redirect("/admin/comptabilite/depenses?ok=1");
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  if (!canManageFinance(admin.role)) return;
  const id = String(formData.get("id") ?? "");
  await prisma.$transaction(async (tx) => {
    await removeEntries(tx, "EXPENSE", id);
    await tx.expense.delete({ where: { id } }).catch(() => null);
  });
  await logAdminAction(admin.id, "expense", id, "DELETE");
  revalidatePath("/admin/comptabilite/depenses");
}

/** Reconstruit le journal à partir des factures, avoirs, paiements et dépenses (utile après un import ou le seed). */
export async function rebuildLedgerAction(): Promise<void> {
  const admin = await requireAdmin();
  if (!canManageFinance(admin.role)) return;
  const { postInvoice, postPayment, postCreditNote } = await import("@/lib/accounting");
  await prisma.$transaction(async (tx) => {
    await tx.ledgerEntry.deleteMany({});
    const invoices = await tx.invoice.findMany({ include: { order: { include: { items: true } } } });
    for (const inv of invoices) {
      await postInvoice(tx, inv, inv.order);
      if (inv.order.paidAt) await postPayment(tx, inv.order, inv.order.paidAt);
    }
    const notes = await tx.creditNote.findMany({ include: { order: true, refund: true } });
    for (const n of notes) await postCreditNote(tx, n, n.order, Boolean(n.refund));
    const expenses = await tx.expense.findMany();
    for (const e of expenses) await postExpense(tx, e);
  });
  await logAdminAction(admin.id, "ledger", null, "REBUILD");
  revalidatePath("/admin/comptabilite");
}

// ------------------------------------------------------------------ Coordonnées bancaires

async function confirmPassword(adminId: string, password: string): Promise<boolean> {
  const user = await prisma.adminUser.findUnique({ where: { id: adminId } });
  return Boolean(user && (await verifyPassword(password, user.passwordHash)));
}

export async function saveBankAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!canManageBank(admin.role)) return { ok: false, message: "Seul le propriétaire peut modifier les coordonnées bancaires." };
  const id = String(formData.get("id") ?? "");
  const parsed = bankAccountSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const d = parsed.data;
  if (!(await confirmPassword(admin.id, d.confirmPassword))) {
    await logAdminAction(admin.id, "bank", id || null, "CONFIRM_FAILED");
    return { ok: false, message: "Mot de passe de confirmation incorrect." };
  }
  try {
    const input = { label: d.label, holderName: d.holderName, bankName: d.bankName, iban: d.iban, bic: d.bic || null, showOnInvoice: d.showOnInvoice };
    if (id) await updateBankAccount(id, input, admin.id);
    else await createBankAccount(input, admin.id);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur." };
  }
  revalidatePath("/admin/banque");
  redirect("/admin/banque?ok=1");
}

export async function bankAccountOpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!canManageBank(admin.role)) return { ok: false, message: "Droits insuffisants." };
  const id = String(formData.get("id") ?? "");
  const op = String(formData.get("op") ?? "");
  const password = String(formData.get("confirmPassword") ?? "");
  if (!(await confirmPassword(admin.id, password))) {
    await logAdminAction(admin.id, "bank", id, "CONFIRM_FAILED");
    return { ok: false, message: "Mot de passe de confirmation incorrect." };
  }
  try {
    if (op === "activate") await activateBankAccount(id, admin.id);
    else if (op === "delete") await deleteBankAccount(id, admin.id);
    else if (op === "reveal") {
      const r = await revealBankAccount(id, admin.id);
      return { ok: true, message: `${r.label} — ${r.holderName} — IBAN ${r.iban}${r.bic ? " — BIC " + r.bic : ""}` };
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur." };
  }
  revalidatePath("/admin/banque");
  return { ok: true, message: op === "activate" ? "Compte activé." : "Compte supprimé." };
}
