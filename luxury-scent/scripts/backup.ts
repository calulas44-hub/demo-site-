/**
 * Sauvegarde : copie la base SQLite (ou un dump PostgreSQL si pg_dump est disponible)
 * et archive les fichiers téléversés dans backups/<horodatage>/.
 * Usage : npm run backup
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dest = path.join(root, "backups", stamp);
mkdirSync(dest, { recursive: true });

const dbUrl = process.env.DATABASE_URL ?? "file:./storage/luxury-scent.db";
if (dbUrl.startsWith("file:")) {
  const dbPath = path.resolve(root, "prisma", dbUrl.slice("file:".length));
  const alt = path.resolve(root, dbUrl.slice("file:".length));
  const src = existsSync(dbPath) ? dbPath : alt;
  if (existsSync(src)) {
    cpSync(src, path.join(dest, "luxury-scent.db"));
    console.log("Base SQLite copiée.");
  } else {
    console.warn("Base SQLite introuvable :", src);
  }
} else if (dbUrl.startsWith("postgres")) {
  try {
    execSync(`pg_dump "${dbUrl}" -F c -f "${path.join(dest, "luxury-scent.dump")}"`, { stdio: "inherit" });
    console.log("Dump PostgreSQL créé.");
  } catch {
    console.error("pg_dump a échoué : installez les outils PostgreSQL ou sauvegardez la base depuis votre hébergeur.");
  }
}

const uploads = path.resolve(root, process.env.UPLOAD_DIR ?? "./storage/uploads");
if (existsSync(uploads)) {
  cpSync(uploads, path.join(dest, "uploads"), { recursive: true });
  console.log("Fichiers téléversés copiés.");
}

try {
  execSync(`tar -czf "${dest}.tar.gz" -C "${path.dirname(dest)}" "${path.basename(dest)}"`, { stdio: "inherit" });
  rmSync(dest, { recursive: true, force: true });
  console.log(`Archive : ${dest}.tar.gz`);
} catch {
  console.log(`Dossier de sauvegarde : ${dest} (archive tar indisponible)`);
}

// Conserve les 30 dernières archives.
const dir = path.join(root, "backups");
const archives = readdirSync(dir)
  .filter((f) => f.endsWith(".tar.gz"))
  .map((f) => ({ f, t: statSync(path.join(dir, f)).mtimeMs }))
  .sort((a, b) => b.t - a.t);
for (const old of archives.slice(30)) rmSync(path.join(dir, old.f));
