/**
 * Initialisation exécutée à chaque déploiement (après `prisma migrate deploy`).
 * - Sur une base Supabase uniquement : Row Level Security sur toutes les tables.
 * - Crée le compte propriétaire à partir de ADMIN_EMAIL / ADMIN_PASSWORD s'il n'existe aucun propriétaire.
 * - Compte de recette temporaire (QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD, domaine @qa.luxury-scent.invalid) :
 *   créé quand les variables sont présentes, désactivé automatiquement dès qu'elles sont retirées.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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
      console.warn("[bootstrap] Aucun propriétaire : définissez ADMIN_EMAIL et ADMIN_PASSWORD (10 caractères min.) puis redéployez.");
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
