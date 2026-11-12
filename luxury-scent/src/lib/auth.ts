import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { ADMIN_COOKIE, CUSTOMER_COOKIE, type AdminRole } from "./constants";

const ADMIN_TTL_SECONDS = 60 * 60 * 12; // 12 h
const CUSTOMER_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 jours

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET doit faire au moins 32 caractères.");
  return new TextEncoder().encode(s);
}

type SessionKind = "admin" | "customer";

interface SessionPayload {
  sub: string;
  kind: SessionKind;
  tv: number;
}

async function sign(payload: SessionPayload, ttl: number): Promise<string> {
  return new SignJWT({ kind: payload.kind, tv: payload.tv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secret());
}

async function verify(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.kind !== "string") return null;
    return { sub: payload.sub, kind: payload.kind as SessionKind, tv: Number(payload.tv ?? 0) };
  } catch {
    return null;
  }
}

function cookieOptions(ttl: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ttl,
  };
}

// ------------------------------------------------------------------ Mots de passe

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ------------------------------------------------------------------ Limitation des tentatives

const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 6;
const WINDOW_MS = 15 * 60 * 1000;

export function checkRateLimit(key: string): { allowed: boolean; retryAfterMinutes: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.until < now) return { allowed: true, retryAfterMinutes: 0 };
  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterMinutes: Math.ceil((entry.until - now) / 60000) };
  }
  return { allowed: true, retryAfterMinutes: 0 };
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.until < now) {
    attempts.set(key, { count: 1, until: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearAttempts(key: string): void {
  attempts.delete(key);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
}

// ------------------------------------------------------------------ Sessions admin

export type AdminSession = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
};

export async function createAdminSession(userId: string, tokenVersion: number): Promise<void> {
  const token = await sign({ sub: userId, kind: "admin", tv: tokenVersion }, ADMIN_TTL_SECONDS);
  (await cookies()).set(ADMIN_COOKIE, token, cookieOptions(ADMIN_TTL_SECONDS));
}

export async function destroyAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const payload = await verify(token);
  if (!payload || payload.kind !== "admin") return null;
  const user = await prisma.adminUser.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active || user.tokenVersion !== payload.tv) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role as AdminRole };
}

/** Exige une session admin ; redirige vers la page de connexion sinon. */
export async function requireAdmin(roles?: AdminRole[]): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (roles && !roles.includes(session.role)) redirect("/admin?error=forbidden");
  return session;
}

export function canManageBank(role: AdminRole): boolean {
  return role === "OWNER";
}

export function canManageFinance(role: AdminRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

// ------------------------------------------------------------------ Sessions clients

export type CustomerSession = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export async function createCustomerSession(customerId: string, tokenVersion: number): Promise<void> {
  const token = await sign({ sub: customerId, kind: "customer", tv: tokenVersion }, CUSTOMER_TTL_SECONDS);
  (await cookies()).set(CUSTOMER_COOKIE, token, cookieOptions(CUSTOMER_TTL_SECONDS));
}

export async function destroyCustomerSession(): Promise<void> {
  (await cookies()).delete(CUSTOMER_COOKIE);
}

export async function getCustomerSession(): Promise<CustomerSession | null> {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  const payload = await verify(token);
  if (!payload || payload.kind !== "customer") return null;
  const c = await prisma.customer.findUnique({ where: { id: payload.sub } });
  if (!c || c.tokenVersion !== payload.tv) return null;
  return { id: c.id, email: c.email, firstName: c.firstName, lastName: c.lastName };
}

export async function requireCustomer(): Promise<CustomerSession> {
  const session = await getCustomerSession();
  if (!session) redirect("/compte/connexion");
  return session;
}

// ------------------------------------------------------------------ Journal d'audit admin

export async function logAdminAction(
  adminUserId: string | null,
  entity: string,
  entityId: string | null,
  action: string,
  details?: unknown,
): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      adminUserId,
      entity,
      entityId,
      action,
      details: details === undefined ? null : JSON.stringify(details),
      ip: await clientIp(),
    },
  });
}
