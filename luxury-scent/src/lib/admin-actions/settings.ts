"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, logAdminAction, requireAdmin } from "@/lib/auth";
import { emailSchema, firstError, formToObject, passwordSchema, settingsSchema, shippingMethodSchema } from "@/lib/validators";
import { saveSettings } from "@/lib/settings";
import { mediaUrlFromForm } from "@/lib/storage";
import { ADMIN_ROLES } from "@/lib/constants";
import type { FormState } from "@/lib/shop-actions";

function revalidateShop() {
  revalidatePath("/", "layout");
}

export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin(["OWNER", "ADMIN"]);
  const parsed = settingsSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const d = parsed.data;
  const reassurance: { icon: string; title: string; text: string }[] = [];
  for (let i = 0; i < 4; i++) {
    const title = String(formData.get(`reassurance[${i}][title]`) ?? "").trim();
    if (!title) continue;
    reassurance.push({ icon: String(formData.get(`reassurance[${i}][icon]`) ?? "check"), title, text: String(formData.get(`reassurance[${i}][text]`) ?? "").trim() });
  }
  const patch: Record<string, unknown> = { ...d, vatRate: d.vatRate ?? 20, reassurance };
  try {
    const logoUrl = mediaUrlFromForm(formData, "logoUrl");
    const faviconUrl = mediaUrlFromForm(formData, "faviconUrl");
    if (logoUrl !== undefined) patch.logoUrl = logoUrl;
    if (faviconUrl !== undefined) patch.faviconUrl = faviconUrl;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Image refusée." };
  }
  await saveSettings(patch);
  await logAdminAction(admin.id, "settings", "site", "UPDATE");
  revalidateShop();
  return { ok: true, message: "Paramètres enregistrés et appliqués au site." };
}

// ------------------------------------------------------------------ Livraison

export async function saveShippingMethodAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const parsed = shippingMethodSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const d = parsed.data;
  const data = { name: d.name, description: d.description, price: d.price ?? 0, freeAbove: d.freeAbove, estimatedDays: d.estimatedDays, countries: d.countries.toUpperCase().replace(/\s/g, ""), position: d.position, active: d.active };
  if (id) await prisma.shippingMethod.update({ where: { id }, data });
  else await prisma.shippingMethod.create({ data });
  await logAdminAction(admin.id, "shipping", id || null, id ? "UPDATE" : "CREATE", { name: d.name });
  revalidateShop();
  redirect("/admin/livraison?ok=1");
}

export async function deleteShippingMethodAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "");
  await prisma.shippingMethod.delete({ where: { id } }).catch(() => null);
  await logAdminAction(admin.id, "shipping", id, "DELETE");
  revalidateShop();
}

// ------------------------------------------------------------------ Utilisateurs administrateurs

export async function saveAdminUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin(["OWNER"]);
  const id = String(formData.get("id") ?? "");
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { ok: false, message: "E-mail invalide." };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, message: "Le nom est obligatoire." };
  const role = String(formData.get("role") ?? "STAFF");
  if (!(ADMIN_ROLES as readonly string[]).includes(role)) return { ok: false, message: "Rôle invalide." };
  const active = formData.get("active") === "on";
  const password = String(formData.get("password") ?? "");
  if (id === admin.id && (role !== "OWNER" || !active)) return { ok: false, message: "Vous ne pouvez pas retirer vos propres droits." };
  const data: { email: string; name: string; role: string; active: boolean; passwordHash?: string; tokenVersion?: { increment: number } } = { email: email.data, name, role, active };
  if (password) {
    const p = passwordSchema.safeParse(password);
    if (!p.success) return { ok: false, message: firstError(p.error) };
    data.passwordHash = await hashPassword(password);
    data.tokenVersion = { increment: 1 };
  } else if (!id) return { ok: false, message: "Un mot de passe est requis pour un nouvel utilisateur." };
  const existing = await prisma.adminUser.findUnique({ where: { email: email.data } });
  if (existing && existing.id !== id) return { ok: false, message: "Cet e-mail est déjà utilisé." };
  const row = id
    ? await prisma.adminUser.update({ where: { id }, data })
    : await prisma.adminUser.create({ data: { email: data.email, name: data.name, role: data.role, active: data.active, passwordHash: data.passwordHash! } });
  await logAdminAction(admin.id, "adminUser", row.id, id ? "UPDATE" : "CREATE", { email: row.email, role: row.role });
  redirect("/admin/utilisateurs?ok=1");
}

export async function deleteAdminUserAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin(["OWNER"]);
  const id = String(formData.get("id") ?? "");
  if (id === admin.id) return;
  await prisma.adminUser.update({ where: { id }, data: { active: false, tokenVersion: { increment: 1 } } }).catch(() => null);
  await logAdminAction(admin.id, "adminUser", id, "DEACTIVATE");
  revalidatePath("/admin/utilisateurs");
}
