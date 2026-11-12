"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { checkRateLimit, clearAttempts, clientIp, createAdminSession, destroyAdminSession, getAdminSession, logAdminAction, recordFailedAttempt, verifyPassword } from "@/lib/auth";
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
