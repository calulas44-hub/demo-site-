import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";

/**
 * Première installation sans variable d'environnement : tant qu'aucun propriétaire n'existe,
 * chaque déploiement génère un code d'installation affiché dans le journal de déploiement Netlify
 * (visible uniquement par le titulaire du compte Netlify). Ce code permet de créer le compte propriétaire
 * depuis /admin/setup, une seule fois.
 */
export const SETUP_KEY = "setup-code";

export function hashSetupCode(code: string): string {
  return createHash("sha256").update(code.replace(/[^A-Z0-9]/gi, "").toUpperCase()).digest("hex");
}

export async function hasOwner(): Promise<boolean> {
  return (await prisma.adminUser.count({ where: { role: "OWNER", active: true } })) > 0;
}

export async function checkSetupCode(code: string): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: SETUP_KEY } });
  if (!row) return false;
  const { hash } = JSON.parse(row.value) as { hash: string };
  const a = Buffer.from(hash);
  const b = Buffer.from(hashSetupCode(code));
  return a.length === b.length && timingSafeEqual(a, b);
}
