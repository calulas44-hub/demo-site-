import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { CART_COOKIE } from "./constants";
import { effectivePrice } from "./catalog";
import { getSettings } from "./settings";

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
}

export interface CartDetails {
  lines: CartLine[];
  subtotal: number;
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
    return { lines: [], subtotal: 0, count: 0, freeShippingThreshold: settings.freeShippingThreshold, freeShippingRemaining: null, warnings: [] };
  }
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: input.map((i) => i.v) }, active: true, product: { status: "ACTIVE" } },
    include: { product: { include: { brand: true, images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }], take: 1 } } } },
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
    });
  }
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const threshold = settings.freeShippingThreshold;
  return {
    lines,
    subtotal,
    count,
    freeShippingThreshold: threshold,
    freeShippingRemaining: threshold ? Math.max(0, threshold - subtotal) : null,
    warnings,
  };
}

export async function getCartCount(): Promise<number> {
  const items = await readCart();
  return items.reduce((s, i) => s + i.q, 0);
}
