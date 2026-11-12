/** Utilitaires partagés client/serveur pour les URL de médias. */

/** Lien de consultation d'un justificatif (fichier privé servi après contrôle des droits). */
export function receiptHref(url: string): string {
  return url.startsWith("private:") ? `/api/admin/private-file?path=${encodeURIComponent(url.slice("private:".length))}` : url;
}

export function isVideoUrl(url: string | null | undefined): boolean {
  return Boolean(url && /\.(mp4|webm)(\?|#|$)/i.test(url));
}
