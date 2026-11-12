import "server-only";
import { getAdminSession } from "./auth";

/** Aperçu avant publication : ?apercu=1 n'a d'effet que pour un administrateur connecté. */
export async function isAdminPreview(apercu: string | string[] | undefined): Promise<boolean> {
  if (apercu !== "1") return false;
  return Boolean(await getAdminSession());
}
