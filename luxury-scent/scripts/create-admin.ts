/**
 * Crée ou met à jour un administrateur.
 * Usage : npm run admin:create -- email@domaine.fr "Mot de passe" "Nom" [OWNER|ADMIN|STAFF]
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [email, password, name = "Administrateur", role = "OWNER"] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage : npm run admin:create -- email "mot de passe" "Nom" [OWNER|ADMIN|STAFF]');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Le mot de passe doit contenir au moins 10 caractères.");
    process.exit(1);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.adminUser.upsert({
    where: { email: email.toLowerCase() },
    create: { email: email.toLowerCase(), passwordHash, name, role },
    update: { passwordHash, name, role, active: true, tokenVersion: { increment: 1 } },
  });
  console.log(`Administrateur prêt : ${user.email} (${user.role})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
