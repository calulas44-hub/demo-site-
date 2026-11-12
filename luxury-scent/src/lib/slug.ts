export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Garantit l'unicité d'un slug en ajoutant un suffixe numérique si besoin. */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
  currentId?: string | null,
): Promise<string> {
  void currentId;
  const root = slugify(base) || "element";
  let candidate = root;
  let i = 2;
  while (await exists(candidate)) {
    candidate = `${root}-${i++}`;
  }
  return candidate;
}
