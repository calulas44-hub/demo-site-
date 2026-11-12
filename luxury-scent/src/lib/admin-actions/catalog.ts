"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logAdminAction, requireAdmin } from "@/lib/auth";
import { brandSchema, categorySchema, collectionSchema, firstError, formToObject, productSchema, variantSchema } from "@/lib/validators";
import { uniqueSlug } from "@/lib/slug";
import { cleanHtml } from "@/lib/sanitize";
import { deleteStoredUrl, isOwnMediaUrl, kindOf, mediaUrlFromForm } from "@/lib/storage";
import type { FormState } from "@/lib/shop-actions";

function revalidateShop() {
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------------ Produits

export async function saveProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = productSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const d = parsed.data;

  // Variantes : champs indexés variants[i][champ]
  const variantRows = new Map<string, Record<string, unknown>>();
  for (const [key, value] of formData.entries()) {
    const m = key.match(/^variants\[(\d+)\]\[(\w+)\]$/);
    if (m && typeof value === "string") {
      const row = variantRows.get(m[1]) ?? {};
      row[m[2]] = value;
      variantRows.set(m[1], row);
    }
  }
  const variants: ReturnType<typeof variantSchema.parse>[] = [];
  for (const [index, row] of [...variantRows.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    if (!String(row.label ?? "").trim() && !String(row.price ?? "").trim()) continue;
    const v = variantSchema.safeParse({ ...row, position: index });
    if (!v.success) return { ok: false, message: `Contenance ${Number(index) + 1} : ${firstError(v.error)}` };
    variants.push(v.data);
  }
  if (variants.length === 0) return { ok: false, message: "Ajoutez au moins une contenance avec un prix." };
  const skus = variants.map((v) => v.sku).filter(Boolean);
  if (new Set(skus).size !== skus.length) return { ok: false, message: "Deux contenances ont la même référence (SKU)." };

  const slug = await uniqueSlug(d.slug || d.name, async (s) => Boolean(await prisma.product.findFirst({ where: { slug: s, NOT: id ? { id } : undefined } })));
  const data = {
    name: d.name,
    slug,
    subtitle: d.subtitle,
    brandId: d.brandId,
    categoryId: d.categoryId,
    collectionId: d.collectionId,
    shortDescription: d.shortDescription,
    description: cleanHtml(d.description),
    inspiration: cleanHtml(d.inspiration),
    notesTop: d.notesTop,
    notesHeart: d.notesHeart,
    notesBase: d.notesBase,
    families: d.families,
    gender: d.gender,
    status: d.status,
    featured: d.featured,
    isNew: d.isNew,
    isLimited: d.isLimited,
    commercialLabel: d.commercialLabel,
    upsellEligible: d.upsellEligible,
    isDemo: false,
    vatRate: d.vatRate,
    position: d.position,
    seoTitle: d.seoTitle,
    seoDescription: d.seoDescription,
  };

  let productId = id;
  await prisma.$transaction(async (tx) => {
    if (id) {
      await tx.product.update({ where: { id }, data });
      const keepIds = variants.map((v) => v.id).filter((x): x is string => Boolean(x));
      await tx.productVariant.deleteMany({ where: { productId: id, id: { notIn: keepIds } } });
      for (const v of variants) {
        const { id: vid, ...vd } = v;
        const payload = { label: vd.label, volumeMl: vd.volumeMl, sku: vd.sku, price: vd.price ?? 0, salePrice: vd.salePrice, costPrice: vd.costPrice, stock: vd.stock, lowStockThreshold: vd.lowStockThreshold, active: vd.active, position: vd.position };
        if (vid) await tx.productVariant.update({ where: { id: vid }, data: payload });
        else await tx.productVariant.create({ data: { ...payload, productId: id } });
      }
    } else {
      const created = await tx.product.create({
        data: { ...data, variants: { create: variants.map((v) => ({ label: v.label, volumeMl: v.volumeMl, sku: v.sku, price: v.price ?? 0, salePrice: v.salePrice, costPrice: v.costPrice, stock: v.stock, lowStockThreshold: v.lowStockThreshold, active: v.active, position: v.position })) } },
      });
      productId = created.id;
    }
  });
  await logAdminAction(admin.id, "product", productId, id ? "UPDATE" : "CREATE", { name: d.name });
  revalidateShop();
  if (!id) redirect(`/admin/produits/${productId}?ok=1`);
  return { ok: true, message: "Produit enregistré." };
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const product = await prisma.product.findUnique({ where: { id }, include: { images: true } });
  if (!product) return;
  await prisma.product.delete({ where: { id } });
  for (const img of product.images) {
    await deleteStoredUrl(img.url);
    await deleteStoredUrl(img.posterUrl);
  }
  await logAdminAction(admin.id, "product", id, "DELETE", { name: product.name });
  revalidateShop();
  redirect("/admin/produits?deleted=1");
}

/** Rattache à un produit des médias déjà envoyés au stockage (photos ou vidéos). */
export async function addProductMediaAction(input: { productId: string; urls: string[] }): Promise<FormState> {
  const admin = await requireAdmin();
  const product = await prisma.product.findUnique({ where: { id: input.productId }, include: { images: true } });
  if (!product) return { ok: false, message: "Produit introuvable." };
  const urls = (input.urls ?? []).filter(Boolean).slice(0, 30);
  if (urls.length === 0) return { ok: false, message: "Aucun fichier reçu." };
  if (!urls.every(isOwnMediaUrl)) return { ok: false, message: "Fichier refusé : il doit être envoyé depuis l'administration." };
  const media = await prisma.media.findMany({ where: { url: { in: urls } } });
  let position = product.images.length;
  let hasPrimary = product.images.some((i) => i.isPrimary);
  let count = 0;
  for (const url of urls) {
    const m = media.find((x) => x.url === url);
    if (!m) return { ok: false, message: "Fichier inconnu de la médiathèque." };
    const kind = kindOf(m.mimeType) === "video" ? "VIDEO" : "IMAGE";
    const isPrimary = !hasPrimary && kind === "IMAGE";
    if (isPrimary) hasPrimary = true;
    await prisma.productImage.create({ data: { productId: product.id, url, kind, alt: product.name, position: position++, isPrimary } });
    count++;
  }
  await logAdminAction(admin.id, "product", product.id, "UPLOAD_MEDIA", { count });
  revalidateShop();
  return { ok: true, message: `${count} média(s) ajouté(s).` };
}

export async function imageAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const imageId = String(formData.get("imageId") ?? "");
  const op = String(formData.get("op") ?? "");
  const img = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!img) return;
  if (op === "delete") {
    await prisma.productImage.delete({ where: { id: imageId } });
    await deleteStoredUrl(img.url);
    await deleteStoredUrl(img.posterUrl);
    const remaining = await prisma.productImage.findMany({ where: { productId: img.productId }, orderBy: { position: "asc" } });
    if (remaining.length && !remaining.some((r) => r.isPrimary)) await prisma.productImage.update({ where: { id: remaining[0].id }, data: { isPrimary: true } });
  } else if (op === "primary" && img.kind !== "VIDEO") {
    await prisma.$transaction([
      prisma.productImage.updateMany({ where: { productId: img.productId }, data: { isPrimary: false } }),
      prisma.productImage.update({ where: { id: imageId }, data: { isPrimary: true, position: -1 } }),
    ]);
  } else if (op === "left" || op === "right") {
    const all = await prisma.productImage.findMany({ where: { productId: img.productId }, orderBy: [{ isPrimary: "desc" }, { position: "asc" }] });
    const idx = all.findIndex((a) => a.id === imageId);
    const swap = op === "left" ? idx - 1 : idx + 1;
    if (swap >= 0 && swap < all.length) {
      const reordered = [...all];
      [reordered[idx], reordered[swap]] = [reordered[swap], reordered[idx]];
      await prisma.$transaction(reordered.map((r, i) => prisma.productImage.update({ where: { id: r.id }, data: { position: i, isPrimary: i === 0 } })));
    }
  } else if (op === "alt") {
    await prisma.productImage.update({ where: { id: imageId }, data: { alt: String(formData.get("alt") ?? "").slice(0, 200) || null } });
  }
  await logAdminAction(admin.id, "product", img.productId, `IMAGE_${op.toUpperCase()}`);
  revalidateShop();
}

export async function duplicateProductAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const p = await prisma.product.findUnique({ where: { id }, include: { variants: true, images: true } });
  if (!p) return;
  const slug = await uniqueSlug(`${p.slug}-copie`, async (s) => Boolean(await prisma.product.findUnique({ where: { slug: s } })));
  const { id: _id, createdAt: _c, updatedAt: _u, variants, images, ...rest } = p;
  void _id;
  void _c;
  void _u;
  const created = await prisma.product.create({
    data: {
      ...rest,
      name: `${p.name} (copie)`,
      slug,
      status: "DRAFT",
      variants: { create: variants.map(({ id: _v, productId: _p, sku, ...v }) => ({ ...v, sku: sku ? `${sku}-COPIE` : null })) },
      images: { create: images.map(({ id: _i, productId: _p, ...im }) => im) },
    },
  });
  await logAdminAction(admin.id, "product", created.id, "DUPLICATE", { from: id });
  redirect(`/admin/produits/${created.id}`);
}

// ------------------------------------------------------------------ Catégories, marques, collections

export async function saveCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = categorySchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const d = parsed.data;
  if (id && d.parentId === id) return { ok: false, message: "Une catégorie ne peut pas être sa propre parente." };
  const slug = await uniqueSlug(d.slug || d.name, async (s) => Boolean(await prisma.category.findFirst({ where: { slug: s, NOT: id ? { id } : undefined } })));
  let imageUrl: string | null | undefined;
  try {
    imageUrl = mediaUrlFromForm(formData, "imageUrl");
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Image refusée." };
  }
  const data = { name: d.name, slug, description: d.description, parentId: d.parentId, position: d.position, active: d.active, showInMenu: d.showInMenu, seoTitle: d.seoTitle, seoDescription: d.seoDescription, ...(imageUrl !== undefined ? { imageUrl } : {}) };
  const row = id ? await prisma.category.update({ where: { id }, data }) : await prisma.category.create({ data });
  await logAdminAction(admin.id, "category", row.id, id ? "UPDATE" : "CREATE", { name: d.name });
  revalidateShop();
  redirect("/admin/categories?ok=1");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) return;
  await prisma.category.delete({ where: { id } });
  await deleteStoredUrl(cat.imageUrl);
  await logAdminAction(admin.id, "category", id, "DELETE", { name: cat.name });
  revalidateShop();
}

export async function saveBrandAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = brandSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const d = parsed.data;
  const slug = await uniqueSlug(d.slug || d.name, async (s) => Boolean(await prisma.brand.findFirst({ where: { slug: s, NOT: id ? { id } : undefined } })));
  const data = { name: d.name, slug, description: d.description, position: d.position, active: d.active };
  const row = id ? await prisma.brand.update({ where: { id }, data }) : await prisma.brand.create({ data });
  await logAdminAction(admin.id, "brand", row.id, id ? "UPDATE" : "CREATE", { name: d.name });
  revalidateShop();
  redirect("/admin/marques?ok=1");
}

export async function deleteBrandAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "");
  await prisma.brand.delete({ where: { id } }).catch(() => null);
  await logAdminAction(admin.id, "brand", id, "DELETE");
  revalidateShop();
}

export async function saveCollectionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const parsed = collectionSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ok: false, message: firstError(parsed.error) };
  const d = parsed.data;
  const slug = await uniqueSlug(d.slug || d.name, async (s) => Boolean(await prisma.collection.findFirst({ where: { slug: s, NOT: id ? { id } : undefined } })));
  const extra: { imageUrl?: string | null; heroImageUrl?: string | null } = {};
  try {
    const imageUrl = mediaUrlFromForm(formData, "imageUrl");
    const heroImageUrl = mediaUrlFromForm(formData, "heroImageUrl");
    if (imageUrl !== undefined) extra.imageUrl = imageUrl;
    if (heroImageUrl !== undefined) extra.heroImageUrl = heroImageUrl;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Image refusée." };
  }
  const data = { name: d.name, slug, tagline: d.tagline, description: cleanHtml(d.description), position: d.position, active: d.active, ...extra };
  const row = id ? await prisma.collection.update({ where: { id }, data }) : await prisma.collection.create({ data });
  await logAdminAction(admin.id, "collection", row.id, id ? "UPDATE" : "CREATE", { name: d.name });
  revalidateShop();
  redirect("/admin/collections?ok=1");
}

export async function deleteCollectionAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "");
  const c = await prisma.collection.findUnique({ where: { id } });
  if (!c) return;
  await prisma.collection.delete({ where: { id } });
  for (const u of [c.imageUrl, c.heroImageUrl]) await deleteStoredUrl(u);
  await logAdminAction(admin.id, "collection", id, "DELETE", { name: c.name });
  revalidateShop();
}

