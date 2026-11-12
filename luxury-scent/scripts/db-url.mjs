/**
 * Résout les adresses de connexion PostgreSQL.
 * - Netlify Database fournit NETLIFY_DB_URL (base de production, ou branche isolée pour les deploy previews).
 * - Sinon DATABASE_URL / DIRECT_URL (développement local, autre hébergeur).
 * Si l'adresse passe par un pooler (« -pooler » dans l'hôte), Prisma doit le savoir (pgbouncer=true)
 * et les migrations utilisent la connexion directe (même hôte sans « -pooler »).
 */
export function resolveDbUrls(env = process.env) {
  const raw = env.DATABASE_URL || env.NETLIFY_DB_URL || "";
  if (!raw) return { runtime: "", direct: "" };
  const u = new URL(raw);
  const pooled = u.hostname.includes("-pooler");
  const runtime = new URL(raw);
  if (pooled && !runtime.searchParams.has("pgbouncer")) runtime.searchParams.set("pgbouncer", "true");
  let direct = env.DIRECT_URL || "";
  if (!direct) {
    const d = new URL(raw);
    if (pooled) d.hostname = d.hostname.replace("-pooler", "");
    d.searchParams.delete("pgbouncer");
    direct = d.toString();
  }
  return { runtime: runtime.toString(), direct };
}

// Utilisation en ligne de commande : affiche les deux variables au format shell.
if (process.argv[1] && process.argv[1].endsWith("db-url.mjs")) {
  const { runtime, direct } = resolveDbUrls();
  if (!runtime) process.exit(1);
  const q = (s) => `'${s.replace(/'/g, "'\\''")}'`;
  console.log(`export DATABASE_URL=${q(runtime)}\nexport DIRECT_URL=${q(direct)}`);
}
