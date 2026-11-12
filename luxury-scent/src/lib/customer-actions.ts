"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "./db";
import { checkRateLimit, clearAttempts, clientIp, createCustomerSession, destroyCustomerSession, hashPassword, recordFailedAttempt, requireCustomer, verifyPassword } from "./auth";
import { addressSchema, emailSchema, firstError, formToObject, passwordSchema, registerSchema } from "./validators";
import { sendWelcome } from "./email";
import type { FormState } from "./shop-actions";

function safeReturn(url: unknown): string {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//") ? url : "/compte";
}

export async function customerLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email.success || !password) return { ok: false, message: "E-mail ou mot de passe invalide." };
  const key = `customer:${await clientIp()}:${email.data}`;
  const limit = checkRateLimit(key);
  if (!limit.allowed) return { ok: false, message: `Trop de tentatives. Réessayez dans ${limit.retryAfterMinutes} min.` };
  const customer = await prisma.customer.findUnique({ where: { email: email.data } });
  if (!customer?.passwordHash || !(await verifyPassword(password, customer.passwordHash))) {
    recordFailedAttempt(key);
    return { ok: false, message: "E-mail ou mot de passe incorrect." };
  }
  clearAttempts(key);
  await createCustomerSession(customer.id, customer.tokenVersion);
  redirect(safeReturn(formData.get("retour")));
}

export async function customerRegisterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const d = parsed.data;
  const existing = await prisma.customer.findUnique({ where: { email: d.email } });
  if (existing?.passwordHash) return { ok: false, message: "Un compte existe déjà avec cette adresse. Connectez-vous." };
  const passwordHash = await hashPassword(d.password);
  const customer = existing
    ? await prisma.customer.update({ where: { id: existing.id }, data: { passwordHash, firstName: d.firstName, lastName: d.lastName, newsletter: d.newsletter } })
    : await prisma.customer.create({ data: { email: d.email, passwordHash, firstName: d.firstName, lastName: d.lastName, newsletter: d.newsletter } });
  if (d.newsletter) await prisma.newsletterSubscriber.upsert({ where: { email: d.email }, create: { email: d.email }, update: {} });
  await createCustomerSession(customer.id, customer.tokenVersion);
  await sendWelcome(customer.email, customer.firstName);
  redirect(safeReturn(formData.get("retour")));
}

export async function customerLogoutAction(): Promise<void> {
  await destroyCustomerSession();
  redirect("/");
}

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireCustomer();
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  if (!firstName || !lastName) return { ok: false, message: "Prénom et nom sont obligatoires." };
  await prisma.customer.update({ where: { id: session.id }, data: { firstName, lastName, phone, newsletter: formData.get("newsletter") === "on" } });
  revalidatePath("/compte");
  return { ok: true, message: "Vos informations sont enregistrées." };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireCustomer();
  const current = String(formData.get("current") ?? "");
  const next = passwordSchema.safeParse(formData.get("password"));
  if (!next.success) return { ok: false, message: firstError(next.error) };
  const customer = await prisma.customer.findUnique({ where: { id: session.id } });
  if (!customer?.passwordHash || !(await verifyPassword(current, customer.passwordHash))) return { ok: false, message: "Mot de passe actuel incorrect." };
  const updated = await prisma.customer.update({ where: { id: session.id }, data: { passwordHash: await hashPassword(next.data), tokenVersion: { increment: 1 } } });
  await createCustomerSession(updated.id, updated.tokenVersion);
  return { ok: true, message: "Mot de passe modifié." };
}

export async function saveAddressAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireCustomer();
  const parsed = addressSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "").trim() || null;
  const isDefault = formData.get("isDefault") === "on";
  if (isDefault) await prisma.address.updateMany({ where: { customerId: session.id }, data: { isDefault: false } });
  if (id) {
    await prisma.address.updateMany({ where: { id, customerId: session.id }, data: { ...parsed.data, label, isDefault } });
  } else {
    const count = await prisma.address.count({ where: { customerId: session.id } });
    await prisma.address.create({ data: { ...parsed.data, label, isDefault: isDefault || count === 0, customerId: session.id } });
  }
  revalidatePath("/compte/adresses");
  redirect("/compte/adresses");
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const session = await requireCustomer();
  const id = String(formData.get("id") ?? "");
  await prisma.address.deleteMany({ where: { id, customerId: session.id } });
  revalidatePath("/compte/adresses");
}
