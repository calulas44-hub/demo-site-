import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Netlify Database fournit NETLIFY_DB_URL ; DATABASE_URL reste prioritaire (local, autre hébergeur). */
function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL || process.env.NETLIFY_DB_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.hostname.includes("-pooler") && !u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
    return u.toString();
  } catch {
    return raw;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
