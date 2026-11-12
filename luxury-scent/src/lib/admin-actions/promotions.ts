"use server";

import { revalidatePath } from "next/cache";
import { logAdminAction, requireAdmin } from "@/lib/auth";
import { saveSettings } from "@/lib/settings";
import { parseEuros } from "@/lib/money";
import { prisma } from "@/lib/db";
import { deleteStoredUrl } from "@/lib/storage";
import type { FormState } from "@/lib/shop-actions";

export async function savePromotionsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin(["OWNER", "ADMIN"]);
  const rate = Math.floor(Number(String(formData.get("upsellRate") ?? "").replace(",", ".")));
  if (!Number.isFinite(rate) || rate < 1 || rate > 90) return { ok: false, message: "Le taux de remise doit être compris entre 1 et 90 %." };
  const maxPrice = parseEuros(String(formData.get("upsellMaxPrice") ?? ""));
  if (maxPrice === null || maxPrice <= 0 || maxPrice > 100000) return { ok: false, message: "Le prix maximal doit être un montant positif (ex. 100)." };
  const title = String(formData.get("upsellTitle") ?? "").trim().slice(0, 80);
  const text = String(formData.get("upsellText") ?? "").trim().slice(0, 240);
  if (!title) return { ok: false, message: "Indiquez le titre de l'offre affiché dans le panier." };
  const patch = {
    upsellEnabled: formData.get("upsellEnabled") === "on",
    upsellRate: rate,
    upsellMaxPrice: maxPrice,
    upsellTitle: title,
    upsellText: text,
    bankTransferEnabled: formData.get("bankTransferEnabled") === "on",
  };
  await saveSettings(patch);
  // Produits éligibles (case cochée = éligible)
  const eligible = new Set(formData.getAll("eligible").map(String));
  const listed = formData.getAll("listed").map(String);
  if (listed.length) {
    await prisma.$transaction([
      prisma.product.updateMany({ where: { id: { in: listed.filter((id) => eligible.has(id)) } }, data: { upsellEligible: true } }),
      prisma.product.updateMany({ where: { id: { in: listed.filter((id) => !eligible.has(id)) } }, data: { upsellEligible: false } }),
    ]);
  }
  await logAdminAction(admin.id, "settings", "promotions", "UPDATE", patch);
  revalidatePath("/", "layout");
  return { ok: true, message: "Offre enregistrée et appliquée au panier." };
}

/** Supprime d'un coup les produits de démonstration (et leurs médias) ; les commandes passées conservent leur historique. */
export async function deleteDemoProductsAction(): Promise<void> {
  const admin = await requireAdmin(["OWNER", "ADMIN"]);
  const products = await prisma.product.findMany({ where: { isDemo: true }, include: { images: true } });
  const ids = products.map((p) => p.id);
  if (ids.length) {
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
    for (const p of products) for (const img of p.images) {
      await deleteStoredUrl(img.url);
      await deleteStoredUrl(img.posterUrl);
    }
  }
  const sections = await prisma.homeSection.findMany({ where: { type: "FEATURED_PRODUCTS" } });
  for (const s of sections) {
    try {
      const data = JSON.parse(s.data ?? "{}") as { productIds?: string[] };
      if (data.productIds?.length) {
        data.productIds = data.productIds.filter((id) => !ids.includes(id));
        await prisma.homeSection.update({ where: { id: s.id }, data: { data: JSON.stringify(data) } });
      }
    } catch {
      /* données de section illisibles : ignorées */
    }
  }
  await logAdminAction(admin.id, "product", null, "DELETE_DEMO", { count: ids.length });
  revalidatePath("/", "layout");
}
