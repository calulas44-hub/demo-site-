"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAdminAction, requireAdmin, canManageFinance } from "@/lib/auth";
import { markOrderPaid, OrderError, refundOrder, updateOrderStatus } from "@/lib/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";
import { parseEuros } from "@/lib/money";
import type { FormState } from "@/lib/shop-actions";

export async function changeOrderStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  if (!ORDER_STATUSES.includes(status)) return { ok: false, message: "Statut invalide." };
  const note = String(formData.get("note") ?? "").trim() || null;
  const carrier = String(formData.get("carrier") ?? "").trim() || null;
  const trackingNumber = String(formData.get("trackingNumber") ?? "").trim() || null;
  const notify = formData.get("notify") === "on";
  try {
    if (status === "PAID") await markOrderPaid(orderId, { adminUserId: admin.id, note: note ?? "Paiement confirmé manuellement" });
    else await updateOrderStatus(orderId, status, { note, adminUserId: admin.id, carrier, trackingNumber, notify });
  } catch (e) {
    return { ok: false, message: e instanceof OrderError ? e.message : "Erreur lors du changement de statut." };
  }
  await logAdminAction(admin.id, "order", orderId, "STATUS", { status, note });
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/commandes");
  return { ok: true, message: "Statut mis à jour." };
}

export async function saveOrderNoteAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  await prisma.order.update({ where: { id: orderId }, data: { adminNote: String(formData.get("adminNote") ?? "").slice(0, 2000) || null } });
  await logAdminAction(admin.id, "order", orderId, "NOTE");
  revalidatePath(`/admin/commandes/${orderId}`);
}

export async function saveTrackingAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const orderId = String(formData.get("orderId") ?? "");
  await prisma.order.update({
    where: { id: orderId },
    data: { carrier: String(formData.get("carrier") ?? "").trim() || null, trackingNumber: String(formData.get("trackingNumber") ?? "").trim() || null },
  });
  await logAdminAction(admin.id, "order", orderId, "TRACKING");
  revalidatePath(`/admin/commandes/${orderId}`);
}

export async function refundOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!canManageFinance(admin.role)) return { ok: false, message: "Droits insuffisants." };
  const orderId = String(formData.get("orderId") ?? "");
  const amount = parseEuros(String(formData.get("amount") ?? ""));
  if (!amount || amount <= 0) return { ok: false, message: "Montant invalide." };
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const method = formData.get("method") === "CARD" ? "CARD" : "BANK_TRANSFER";
  try {
    const note = await refundOrder(orderId, amount, reason, admin.id, method);
    await logAdminAction(admin.id, "order", orderId, "REFUND", { amount, creditNote: note.number });
    revalidatePath(`/admin/commandes/${orderId}`);
    return { ok: true, message: `Avoir ${note.number} émis. Pensez à effectuer le remboursement ${method === "CARD" ? "depuis votre prestataire de paiement" : "par virement"}.` };
  } catch (e) {
    return { ok: false, message: e instanceof OrderError ? e.message : "Erreur lors du remboursement." };
  }
}
