/** Adresse publique du site : APP_URL si défini, sinon l'adresse Netlify (fixée au build), sinon localhost. */
export function siteUrl(): string {
  return (process.env.APP_URL || process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
