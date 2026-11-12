// Tous les montants sont des entiers en centimes.

const formatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

export function formatPrice(cents: number): string {
  return formatter.format(cents / 100);
}

export function formatNumber(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Convertit une saisie utilisateur (« 135 », « 135,50 », « 135.5 ») en centimes. */
export function parseEuros(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function centsToEurosInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Décompose un montant TTC en HT et TVA pour un taux donné (ex. 20). */
export function splitVat(ttc: number, rate: number): { ht: number; tva: number; ttc: number } {
  const ht = Math.round(ttc / (1 + rate / 100));
  return { ht, tva: ttc - ht, ttc };
}

/** Calcule TVA et TTC à partir d'un HT. */
export function addVat(ht: number, rate: number): { ht: number; tva: number; ttc: number } {
  const tva = Math.round((ht * rate) / 100);
  return { ht, tva, ttc: ht + tva };
}

/** Prix pour 100 ml, affiché sur les fiches produit. */
export function pricePer100ml(priceCents: number, volumeMl: number | null | undefined): number | null {
  if (!volumeMl || volumeMl <= 0) return null;
  return Math.round((priceCents / volumeMl) * 100);
}
