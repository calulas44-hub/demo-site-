/**
 * Initialisation exécutée à chaque déploiement (après `prisma migrate deploy`).
 * - Sur une base Supabase uniquement : Row Level Security sur toutes les tables.
 * - Crée le compte propriétaire à partir de ADMIN_EMAIL / ADMIN_PASSWORD s'il n'existe aucun propriétaire.
 * - Compte de recette temporaire (QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD, domaine @qa.luxury-scent.invalid) :
 *   créé quand les variables sont présentes, désactivé automatiquement dès qu'elles sont retirées.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

const prisma = new PrismaClient();
const QA_DOMAIN = "@qa.luxury-scent.invalid";

try {
  // Base Supabase uniquement (API REST publique) : RLS sur toutes les tables, y compris les nouvelles.
  const [{ supabase }] = await prisma.$queryRawUnsafe(`SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AS supabase`);
  if (supabase) {
    await prisma.$executeRawUnsafe(`DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;`);
    console.log("[bootstrap] Row Level Security active sur toutes les tables.");
  }

  const owners = await prisma.adminUser.count({ where: { role: "OWNER", active: true, NOT: { email: { endsWith: QA_DOMAIN } } } });
  if (owners > 0) {
    console.log("[bootstrap] Un propriétaire existe déjà.");
  } else {
    const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD ?? "";
    if (!email || password.length < 10) {
      // Installation sans variable : code à usage unique affiché dans le journal de déploiement.
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const bytes = randomBytes(12);
      const raw = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
      const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
      const hash = createHash("sha256").update(raw).digest("hex");
      const value = JSON.stringify({ hash, createdAt: new Date().toISOString() });
      await prisma.setting.upsert({ where: { key: "setup-code" }, create: { key: "setup-code", value }, update: { value } });
      const line = "=".repeat(64);
      console.log(`\n${line}\n  PREMIÈRE INSTALLATION — CODE D'INSTALLATION : ${code}\n  Ouvrez ${(process.env.URL || "https://<votre-site>").replace(/\/$/, "")}/admin/setup et saisissez ce code\n  pour créer votre compte administrateur (valable jusqu'au prochain déploiement).\n${line}\n`);
    } else if (await prisma.adminUser.findUnique({ where: { email } })) {
      console.warn(`[bootstrap] ${email} existe mais n'est pas propriétaire actif : aucune modification.`);
    } else {
      await prisma.adminUser.create({ data: { email, name: "Propriétaire", role: "OWNER", passwordHash: await bcrypt.hash(password, 12) } });
      console.log(`[bootstrap] Compte propriétaire créé : ${email}`);
    }
  }

  const qaEmail = (process.env.QA_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const qaPassword = process.env.QA_ADMIN_PASSWORD ?? "";
  if (qaEmail.endsWith(QA_DOMAIN) && qaPassword.length >= 16) {
    const passwordHash = await bcrypt.hash(qaPassword, 12);
    await prisma.adminUser.upsert({
      where: { email: qaEmail },
      create: { email: qaEmail, name: "Recette (temporaire)", role: "ADMIN", passwordHash },
      update: { passwordHash, active: true, tokenVersion: { increment: 1 } },
    });
    console.log("[bootstrap] Compte de recette temporaire actif.");
  } else {
    const r = await prisma.adminUser.updateMany({ where: { email: { endsWith: QA_DOMAIN }, active: true }, data: { active: false, tokenVersion: { increment: 1 } } });
    if (r.count) console.log(`[bootstrap] ${r.count} compte(s) de recette désactivé(s).`);
  }
} finally {
  await prisma.$disconnect();
}
