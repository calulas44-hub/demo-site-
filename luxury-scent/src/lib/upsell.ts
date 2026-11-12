/**
 * Vente additionnelle « 2e parfum » — calcul pur, exécuté uniquement côté serveur
 * (panier, création de commande, session Stripe) : le navigateur n'envoie jamais de montant.
 *
 * Règle : si le panier contient au moins 2 parfums éligibles (en unités), UNE unité du parfum
 * éligible le moins cher dont le prix unitaire est ≤ au seuil reçoit la remise.
 * Pas de cumul : un article déjà en promotion (prix barré) n'est jamais remisé une seconde fois.
 */

export interface UpsellSettings {
  upsellEnabled: boolean;
  upsellRate: number; // %
  upsellMaxPrice: number; // centimes
}

export interface UpsellLine {
  variantId: string;
  unitPrice: number;
  regularPrice: number;
  quantity: number;
  upsellEligible: boolean;
}

export interface UpsellDiscount {
  variantId: string;
  amount: number; // centimes
  rate: number;
  label: string;
}

export function upsellLabel(rate: number): string {
  return `2e parfum -${rate} %`;
}

export function isUpsellCandidate(l: { unitPrice: number; regularPrice: number; upsellEligible: boolean }, s: UpsellSettings): boolean {
  const onSale = l.unitPrice < l.regularPrice;
  return l.upsellEligible && !onSale && l.unitPrice > 0 && l.unitPrice <= s.upsellMaxPrice;
}

export function computeUpsell(lines: UpsellLine[], s: UpsellSettings): UpsellDiscount | null {
  const rate = Math.floor(Number(s.upsellRate));
  if (!s.upsellEnabled || !(rate > 0 && rate < 100) || !(s.upsellMaxPrice > 0)) return null;
  const eligibleUnits = lines.filter((l) => l.upsellEligible).reduce((n, l) => n + l.quantity, 0);
  if (eligibleUnits < 2) return null;
  const candidates = lines.filter((l) => l.quantity > 0 && isUpsellCandidate(l, s)).sort((a, b) => a.unitPrice - b.unitPrice);
  const target = candidates[0];
  if (!target) return null;
  const amount = Math.round((target.unitPrice * rate) / 100);
  if (amount <= 0) return null;
  return { variantId: target.variantId, amount, rate, label: upsellLabel(rate) };
}
