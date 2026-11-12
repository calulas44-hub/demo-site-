"use server";

import { revalidatePath } from "next/cache";
import { getCartDetails, readCart, writeCart, type CartDetails } from "./cart";
import type { ClientCart } from "@/components/shop/cart-context";

function toClient(c: CartDetails): ClientCart {
  return {
    lines: c.lines.map((l) => ({
      variantId: l.variantId,
      productId: l.productId,
      name: l.name,
      slug: l.slug,
      subtitle: l.subtitle,
      brand: l.brand,
      variantLabel: l.variantLabel,
      imageUrl: l.imageUrl,
      unitPrice: l.unitPrice,
      regularPrice: l.regularPrice,
      quantity: l.quantity,
      stock: l.stock,
      total: l.total,
    })),
    subtotal: c.subtotal,
    discount: c.discount ? { variantId: c.discount.variantId, amount: c.discount.amount, label: c.discount.label } : null,
    total: c.total,
    upsellOffer: c.upsellOffer,
    count: c.count,
    freeShippingThreshold: c.freeShippingThreshold,
    freeShippingRemaining: c.freeShippingRemaining,
    warnings: c.warnings,
  };
}

export async function getClientCart(): Promise<ClientCart> {
  const details = await getCartDetails();
  return toClient(details);
}

export async function addToCartAction(variantId: string, quantity = 1): Promise<{ ok: boolean; cart: ClientCart; message?: string }> {
  const items = await readCart();
  const qty = Math.max(1, Math.min(10, Math.floor(quantity)));
  const existing = items.find((i) => i.v === variantId);
  if (existing) existing.q = Math.min(10, existing.q + qty);
  else items.push({ v: variantId, q: qty });
  const details = await getCartDetails(items);
  const line = details.lines.find((l) => l.variantId === variantId);
  await writeCart(details.lines.map((l) => ({ v: l.variantId, q: l.quantity })));
  revalidatePath("/panier");
  if (!line) return { ok: false, cart: toClient(details), message: details.warnings[0] ?? "Article indisponible." };
  return { ok: true, cart: toClient(details), message: details.warnings[0] };
}

export async function updateCartAction(variantId: string, quantity: number): Promise<ClientCart> {
  const items = await readCart().then((list) => list.filter((i) => i.v !== variantId));
  if (quantity > 0) items.push({ v: variantId, q: Math.min(10, Math.floor(quantity)) });
  const details = await getCartDetails(items);
  await writeCart(details.lines.map((l) => ({ v: l.variantId, q: l.quantity })));
  revalidatePath("/panier");
  return toClient(details);
}

export async function removeFromCartAction(variantId: string): Promise<ClientCart> {
  return updateCartAction(variantId, 0);
}
