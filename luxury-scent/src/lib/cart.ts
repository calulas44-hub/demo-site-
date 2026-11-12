import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { CART_COOKIE } from "./constants";
import { effectivePrice } from "./catalog";
import { getSettings } from "./settings";
import { computeUpsell, isUpsellCandidate, type UpsellDiscount } from "./upsell";

export interface CartItemInput {
  v: string; // id de variante
  q: number;
}

export interface CartLine {
  variantId: string;
  productId: string;
  name: string;
  slug: string;
  subtitle: string | null;
  brand: string | null;
  variantLabel: string;
  sku: string | null;
  imageUrl: string | null;
  unitPrice: number;
  regularPrice: number;
  quantity: number;
  stock: number;
  total: number;
  vatRate: number;
  costPrice: number | null;
  upsellEligible: boolean;
}

export interface UpsellSuggestion {
  slug: string;
  name: string;
  variantId: string;
  variantLabel: string;
  imageUrl: string | null;
  price: number;
  discountedPrice: number;
}

export interface UpsellOffer {
  title: string;
  text: string;
  rate: number;
  maxPrice: number;
  suggestions: UpsellSuggestion[];
}

export interface CartDetails {
  lines: CartLine[];
  subtotal: number;
  /** Remise automatique « 2e parfum » (calculée côté serveur) */
  discount: UpsellDiscount | null;
  /** Total articles après remise, hors livraison */
  total: number;
  /** Offre à présenter quand la remise n'est pas encore obtenue */
  upsellOffer: UpsellOffer | null;
  count: number;
  freeShippingThreshold: number | null;
  freeShippingRemaining: number | null;
  warnings: string[];
}

const MAX_QTY = 10;

export async function readCart(): Promise<CartItemInput[]> {
  const raw = (await cookies()).get(CART_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((i): i is CartItemInput => typeof i === "object" && i !== null && typeof (i as CartItemInput).v === "string")
      .map((i) => ({ v: i.v, q: Math.min(MAX_QTY, Math.max(1, Math.floor(Number(i.q) || 1))) }))
      .slice(0, 50);
  } catch {
    return [];
  }
}

export async function writeCart(items: CartItemInput[]): Promise<void> {
  const store = await cookies();
  if (items.length === 0) {
    store.delete(CART_COOKIE);
    return;
  }
  store.set(CART_COOKIE, JSON.stringify(items), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearCart(): Promise<void> {
  (await cookies()).delete(CART_COOKIE);
}

/** Charge le panier avec les données à jour (prix, stock) et le corrige si besoin. */
export async function getCartDetails(items?: CartItemInput[]): Promise<CartDetails> {
  const input = items ?? (await readCart());
  const settings = await getSettings();
  if (input.length === 0) {
    return { lines: [], subtotal: 0, discount: null, total: 0, upsellOffer: null, count: 0, freeShippingThreshold: settings.freeShippingThreshold, freeShippingRemaining: null, warnings: [] };
  }
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: input.map((i) => i.v) }, active: true, product: { status: "ACTIVE" } },
    include: { product: { include: { brand: true, images: { where: { kind: "IMAGE" }, orderBy: [{ isPrimary: "desc" }, { position: "asc" }], take: 1 } } } },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  const warnings: string[] = [];
  const lines: CartLine[] = [];
  for (const item of input) {
    const v = byId.get(item.v);
    if (!v) {
      warnings.push("Un article n'est plus disponible et a été retiré du panier.");
      continue;
    }
    if (v.stock <= 0) {
      warnings.push(`${v.product.name} (${v.label}) est épuisé et a été retiré du panier.`);
      continue;
    }
    const quantity = Math.min(item.q, v.stock);
    if (quantity < item.q) warnings.push(`Stock limité : ${v.product.name} (${v.label}) ramené à ${quantity}.`);
    const unitPrice = effectivePrice(v);
    lines.push({
      variantId: v.id,
      productId: v.productId,
      name: v.product.name,
      slug: v.product.slug,
      subtitle: v.product.subtitle,
      brand: v.product.brand?.name ?? null,
      variantLabel: v.label,
      sku: v.sku,
      imageUrl: v.product.images[0]?.url ?? null,
      unitPrice,
      regularPrice: v.price,
      quantity,
      stock: v.stock,
      total: unitPrice * quantity,
      vatRate: v.product.vatRate ?? settings.vatRate,
      costPrice: v.costPrice,
      upsellEligible: v.product.upsellEligible,
    });
  }
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const discount = computeUpsell(lines, settings);
  const total = subtotal - (discount?.amount ?? 0);
  const threshold = settings.freeShippingThreshold;
  const upsellOffer = !discount && lines.some((l) => l.upsellEligible) ? await buildUpsellOffer(lines, settings) : null;
  return {
    lines,
    subtotal,
    discount,
    total,
    upsellOffer,
    count,
    freeShippingThreshold: threshold,
    freeShippingRemaining: threshold ? Math.max(0, threshold - total) : null,
    warnings,
  };
}

/** Propose jusqu'à 3 parfums éligibles (≤ seuil, sans promotion, en stock) absents du panier. */
async function buildUpsellOffer(lines: CartLine[], settings: Awaited<ReturnType<typeof getSettings>>): Promise<UpsellOffer | null> {
  if (!settings.upsellEnabled || !(settings.upsellRate > 0 && settings.upsellRate < 100)) return null;
  const inCart = new Set(lines.map((l) => l.productId));
  const variants = await prisma.productVariant.findMany({
    where: { active: true, stock: { gt: 0 }, price: { lte: settings.upsellMaxPrice }, salePrice: null, product: { status: "ACTIVE", upsellEligible: true, id: { notIn: [...inCart] } } },
    include: { product: { include: { images: { where: { kind: "IMAGE" }, orderBy: [{ isPrimary: "desc" }, { position: "asc" }], take: 1 } } } },
    orderBy: [{ product: { featured: "desc" } }, { product: { position: "asc" } }, { price: "desc" }],
    take: 30,
  });
  const seen = new Set<string>();
  const suggestions: UpsellSuggestion[] = [];
  for (const v of variants) {
    if (seen.has(v.productId)) continue;
    if (!isUpsellCandidate({ unitPrice: effectivePrice(v), regularPrice: v.price, upsellEligible: true }, settings)) continue;
    seen.add(v.productId);
    suggestions.push({
      slug: v.product.slug,
      name: v.product.name,
      variantId: v.id,
      variantLabel: v.label,
      imageUrl: v.product.images[0]?.url ?? null,
      price: v.price,
      discountedPrice: v.price - Math.round((v.price * settings.upsellRate) / 100),
    });
    if (suggestions.length === 3) break;
  }
  return { title: settings.upsellTitle, text: settings.upsellText, rate: settings.upsellRate, maxPrice: settings.upsellMaxPrice, suggestions };
}

export async function getCartCount(): Promise<number> {
  const items = await readCart();
  return items.reduce((s, i) => s + i.q, 0);
}
