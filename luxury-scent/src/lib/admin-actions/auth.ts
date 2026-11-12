"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { checkRateLimit, clearAttempts, clientIp, createAdminSession, destroyAdminSession, getAdminSession, hashPassword, logAdminAction, recordFailedAttempt, verifyPassword } from "@/lib/auth";
import { checkSetupCode, hasOwner, SETUP_KEY } from "@/lib/setup-code";
import { emailSchema } from "@/lib/validators";
import type { FormState } from "@/lib/shop-actions";

export async function adminLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email.success || !password) return { ok: false, message: "Identifiants invalides." };
  const key = `admin:${await clientIp()}:${email.data}`;
  const limit = await checkRateLimit(key);
  if (!limit.allowed) return { ok: false, message: `Trop de tentatives. Réessayez dans ${limit.retryAfterMinutes} min.` };
  const user = await prisma.adminUser.findUnique({ where: { email: email.data } });
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    await recordFailedAttempt(key);
    await logAdminAction(null, "auth", null, "LOGIN_FAILED", { email: email.data });
    return { ok: false, message: "E-mail ou mot de passe incorrect." };
  }
  await clearAttempts(key);
  await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createAdminSession(user.id, user.tokenVersion);
  await logAdminAction(user.id, "auth", user.id, "LOGIN");
  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  const session = await getAdminSession();
  if (session) await logAdminAction(session.id, "auth", session.id, "LOGOUT");
  await destroyAdminSession();
  redirect("/admin/login");
}

/** Première installation : création du compte propriétaire avec le code affiché dans le journal de déploiement. */
export async function setupOwnerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (await hasOwner()) redirect("/admin/login");
  const key = `setup:${await clientIp()}`;
  const limit = await checkRateLimit(key);
  if (!limit.allowed) return { ok: false, message: `Trop de tentatives. Réessayez dans ${limit.retryAfterMinutes} min.` };
  const code = String(formData.get("code") ?? "");
  if (!(await checkSetupCode(code))) {
    await recordFailedAttempt(key);
    return { ok: false, message: "Code d'installation incorrect. Il figure dans le journal du dernier déploiement Netlify." };
  }
  const email = emailSchema.safeParse(formData.get("email"));
  const name = String(formData.get("name") ?? "").trim().slice(0, 80) || "Propriétaire";
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!email.success) return { ok: false, message: "Adresse e-mail invalide." };
  if (password.length < 10) return { ok: false, message: "Le mot de passe doit contenir au moins 10 caractères." };
  if (password !== confirm) return { ok: false, message: "Les deux mots de passe ne correspondent pas." };
  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    // Re-vérifié dans la transaction : un seul propriétaire peut être créé par ce moyen.
    if ((await tx.adminUser.count({ where: { role: "OWNER", active: true } })) > 0) return null;
    const created = await tx.adminUser.upsert({
      where: { email: email.data },
      create: { email: email.data, name, role: "OWNER", passwordHash },
      update: { name, role: "OWNER", passwordHash, active: true, tokenVersion: { increment: 1 } },
    });
    await tx.setting.deleteMany({ where: { key: SETUP_KEY } });
    return created;
  });
  if (!user) redirect("/admin/login");
  await clearAttempts(key);
  await createAdminSession(user.id, user.tokenVersion);
  await logAdminAction(user.id, "auth", user.id, "SETUP_OWNER", { email: user.email });
  redirect("/admin?bienvenue=1");
}
