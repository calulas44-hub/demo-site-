import "server-only";
import { prisma } from "./db";
import { clientIp } from "./auth";
import { decryptSecret, encryptSecret, formatIban, isValidBic, isValidIban, maskIban, normalizeIban } from "./crypto";

export interface BankAccountView {
  id: string;
  label: string;
  holderName: string;
  bankName: string | null;
  ibanMasked: string;
  hasBic: boolean;
  isActive: boolean;
  showOnInvoice: boolean;
  updatedAt: Date;
}

export async function listBankAccounts(): Promise<BankAccountView[]> {
  const rows = await prisma.bankAccount.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] });
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    holderName: r.holderName,
    bankName: r.bankName,
    ibanMasked: `${r.ibanLast4 ? maskIban("XXXX" + "X".repeat(10) + r.ibanLast4).replace(/^XXXX/, "····") : "····"}`,
    hasBic: Boolean(r.bicEncrypted),
    isActive: r.isActive,
    showOnInvoice: r.showOnInvoice,
    updatedAt: r.updatedAt,
  }));
}

async function audit(bankAccountId: string | null, adminUserId: string, action: string, details?: unknown) {
  await prisma.bankAccountAudit.create({
    data: { bankAccountId, adminUserId, action, details: details === undefined ? null : JSON.stringify(details), ip: await clientIp() },
  });
}

export interface BankAccountInput {
  label: string;
  holderName: string;
  bankName: string | null;
  iban: string;
  bic?: string | null;
  showOnInvoice: boolean;
}

export async function createBankAccount(input: BankAccountInput, adminUserId: string) {
  const iban = normalizeIban(input.iban);
  if (!isValidIban(iban)) throw new Error("IBAN invalide (vérifiez la saisie).");
  const bic = input.bic ? input.bic.replace(/\s+/g, "").toUpperCase() : null;
  if (bic && !isValidBic(bic)) throw new Error("BIC invalide.");
  const count = await prisma.bankAccount.count();
  const row = await prisma.bankAccount.create({
    data: {
      label: input.label,
      holderName: input.holderName,
      bankName: input.bankName,
      ibanEncrypted: await encryptSecret(iban),
      ibanLast4: iban.slice(-4),
      bicEncrypted: bic ? await encryptSecret(bic) : null,
      showOnInvoice: input.showOnInvoice,
      isActive: count === 0,
    },
  });
  await audit(row.id, adminUserId, "CREATE", { label: row.label, holderName: row.holderName, iban: maskIban(iban), bankName: row.bankName });
  return row;
}

export async function updateBankAccount(id: string, input: BankAccountInput, adminUserId: string) {
  const existing = await prisma.bankAccount.findUnique({ where: { id } });
  if (!existing) throw new Error("Compte introuvable.");
  const iban = normalizeIban(input.iban);
  if (!isValidIban(iban)) throw new Error("IBAN invalide (vérifiez la saisie).");
  const bic = input.bic ? input.bic.replace(/\s+/g, "").toUpperCase() : null;
  if (bic && !isValidBic(bic)) throw new Error("BIC invalide.");
  const previousIban = await decryptSecret(existing.ibanEncrypted);
  const row = await prisma.bankAccount.update({
    where: { id },
    data: {
      label: input.label,
      holderName: input.holderName,
      bankName: input.bankName,
      ibanEncrypted: await encryptSecret(iban),
      ibanLast4: iban.slice(-4),
      bicEncrypted: bic ? await encryptSecret(bic) : null,
      showOnInvoice: input.showOnInvoice,
    },
  });
  await audit(id, adminUserId, "UPDATE", {
    before: { label: existing.label, holderName: existing.holderName, iban: maskIban(previousIban), bankName: existing.bankName },
    after: { label: row.label, holderName: row.holderName, iban: maskIban(iban), bankName: row.bankName },
    ibanChanged: previousIban !== iban,
  });
  return row;
}

export async function activateBankAccount(id: string, adminUserId: string) {
  await prisma.$transaction([
    prisma.bankAccount.updateMany({ data: { isActive: false } }),
    prisma.bankAccount.update({ where: { id }, data: { isActive: true } }),
  ]);
  await audit(id, adminUserId, "ACTIVATE");
}

export async function deleteBankAccount(id: string, adminUserId: string) {
  const existing = await prisma.bankAccount.findUnique({ where: { id } });
  if (!existing) return;
  if (existing.isActive) throw new Error("Impossible de supprimer le compte actif : activez d'abord un autre compte.");
  await audit(id, adminUserId, "DELETE", { label: existing.label, ibanLast4: existing.ibanLast4 });
  await prisma.bankAccount.delete({ where: { id } });
}

/** Révèle l'IBAN complet d'un compte (action tracée). */
export async function revealBankAccount(id: string, adminUserId: string) {
  const row = await prisma.bankAccount.findUnique({ where: { id } });
  if (!row) throw new Error("Compte introuvable.");
  await audit(id, adminUserId, "VIEW");
  return {
    id: row.id,
    label: row.label,
    holderName: row.holderName,
    bankName: row.bankName,
    iban: formatIban(await decryptSecret(row.ibanEncrypted)),
    bic: row.bicEncrypted ? await decryptSecret(row.bicEncrypted) : null,
    showOnInvoice: row.showOnInvoice,
  };
}

/** Coordonnées du compte actif, pour les instructions de virement et les factures. */
export async function getActiveBankDetails(): Promise<{ holderName: string; bankName: string | null; iban: string; bic: string | null } | null> {
  const row = await prisma.bankAccount.findFirst({ where: { isActive: true } });
  if (!row) return null;
  try {
    return {
      holderName: row.holderName,
      bankName: row.bankName,
      iban: formatIban(await decryptSecret(row.ibanEncrypted)),
      bic: row.bicEncrypted ? await decryptSecret(row.bicEncrypted) : null,
    };
  } catch {
    return null;
  }
}

export async function getBankAudits(limit = 50) {
  return prisma.bankAccountAudit.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { adminUser: { select: { name: true, email: true } }, bankAccount: { select: { label: true } } },
  });
}
