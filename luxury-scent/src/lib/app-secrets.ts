import { randomBytes } from "node:crypto";
import { prisma } from "./db";

/**
 * Clés secrètes de l'application.
 * Si SESSION_SECRET / BANK_ENCRYPTION_KEY sont définies dans l'environnement, elles sont utilisées.
 * Sinon, elles sont générées une seule fois (aléatoires, 256 bits) et conservées dans la base,
 * qui n'est jamais exposée publiquement : aucune variable à saisir dans Netlify.
 */
interface Secrets {
  session: string;
  bank: string;
}

const KEY = "app-secrets";
let cache: Secrets | null = null;

function fromEnv(): Partial<Secrets> {
  const session = process.env.SESSION_SECRET ?? "";
  const bank = process.env.BANK_ENCRYPTION_KEY ?? "";
  return {
    ...(session.length >= 32 ? { session } : {}),
    ...(/^[0-9a-fA-F]{64}$/.test(bank) ? { bank } : {}),
  };
}

export async function appSecrets(): Promise<Secrets> {
  if (cache) return cache;
  const env = fromEnv();
  if (env.session && env.bank) return (cache = env as Secrets);
  let row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row) {
    const value = JSON.stringify({ session: randomBytes(32).toString("hex"), bank: randomBytes(32).toString("hex") });
    // createMany + skipDuplicates : sûr même si plusieurs fonctions démarrent en même temps.
    await prisma.setting.createMany({ data: [{ key: KEY, value }], skipDuplicates: true });
    row = await prisma.setting.findUnique({ where: { key: KEY } });
  }
  const stored = JSON.parse(row!.value) as Secrets;
  cache = { session: env.session ?? stored.session, bank: env.bank ?? stored.bank };
  return cache;
}

/** Indique si la clé de chiffrement bancaire vient de l'environnement (recommandé) ou de la base. */
export function bankKeyFromEnv(): boolean {
  return Boolean(fromEnv().bank);
}
