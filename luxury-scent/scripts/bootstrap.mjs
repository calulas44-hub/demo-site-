/**
 * Initialisation au démarrage (utilisé par l'image Docker, utilisable seul : node scripts/bootstrap.mjs).
 * Crée le compte propriétaire à partir de ADMIN_EMAIL / ADMIN_PASSWORD s'il n'existe aucun administrateur.
 * Ne crée aucune donnée de démonstration. Ne modifie rien si un administrateur existe déjà.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

try {
  const count = await prisma.adminUser.count();
  if (count > 0) {
    console.log("[bootstrap] Un administrateur existe déjà : rien à faire.");
  } else {
    const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD ?? "";
    if (!email || password.length < 10) {
      console.warn("[bootstrap] Aucun administrateur et ADMIN_EMAIL / ADMIN_PASSWORD (10 caractères min.) absents : l'administration sera inaccessible.");
    } else {
      await prisma.adminUser.create({ data: { email, name: "Propriétaire", role: "OWNER", passwordHash: await bcrypt.hash(password, 12) } });
      console.log(`[bootstrap] Compte propriétaire créé : ${email}`);
      console.log("[bootstrap] Pensez à retirer ADMIN_PASSWORD de l'environnement et à changer le mot de passe.");
    }
  }
} finally {
  await prisma.$disconnect();
}
