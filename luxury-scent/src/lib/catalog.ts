import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export const PRODUCTS_PER_PAGE = 12;

export type VariantInfo = {
  id: string;
  label: string;
  volumeMl: number | null;
  sku: string | null;
  price: number;
  salePrice: number | null;
  effectivePrice: number;
  stock: number;
  available: boolean;
  lowStock: boolean;
  position: number;
};

export type ProductCard = {
  id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  brand: string | null;
  families: string[];
  image: string | null;
  hoverImage: string | null;
  priceFrom: number;
  compareAt: number | null;
  hasRange: boolean;
  isNew: boolean;
  isLimited: boolean;
  commercialLabel: string | null;
  available: boolean;
  sizes: string[];
};

export function effectivePrice(v: { price: number; salePrice: number | null }): number {
  return v.salePrice !== null && v.salePrice < v.price ? v.salePrice : v.price;
}

export function splitList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const cardInclude = {
  brand: true,
  images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
  variants: { where: { active: true }, orderBy: { position: "asc" } },
} satisfies Prisma.ProductInclude;

type ProductWithCard = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

export function toCard(p: ProductWithCard): ProductCard {
  const variants = p.variants.map((v) => ({ ...v, eff: effectivePrice(v) }));
  const inStock = variants.filter((v) => v.stock > 0);
  const priceSource = inStock.length > 0 ? inStock : variants;
  const prices = priceSource.map((v) => v.eff);
  const priceFrom = prices.length ? Math.min(...prices) : 0;
  const cheapest = priceSource.find((v) => v.eff === priceFrom);
  const compareAt = cheapest && cheapest.salePrice !== null && cheapest.salePrice < cheapest.price ? cheapest.price : null;
  const photos = p.images.filter((i) => i.kind !== "VIDEO");
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    subtitle: p.subtitle,
    brand: p.brand?.name ?? null,
    families: splitList(p.families),
    image: photos[0]?.url ?? null,
    hoverImage: photos[1]?.url ?? null,
    priceFrom,
    compareAt,
    hasRange: new Set(prices).size > 1,
    isNew: p.isNew,
    isLimited: p.isLimited,
    commercialLabel: p.commercialLabel,
    available: inStock.length > 0,
    sizes: variants.map((v) => v.label),
  };
}

export function toVariantInfo(v: {
  id: string;
  label: string;
  volumeMl: number | null;
  sku: string | null;
  price: number;
  salePrice: number | null;
  stock: number;
  lowStockThreshold: number;
  position: number;
}): VariantInfo {
  return {
    id: v.id,
    label: v.label,
    volumeMl: v.volumeMl,
    sku: v.sku,
    price: v.price,
    salePrice: v.salePrice !== null && v.salePrice < v.price ? v.salePrice : null,
    effectivePrice: effectivePrice(v),
    stock: v.stock,
    available: v.stock > 0,
    lowStock: v.stock > 0 && v.stock <= v.lowStockThreshold,
    position: v.position,
  };
}

// ------------------------------------------------------------------ Listes et filtres

export interface CatalogFilters {
  categorySlug?: string;
  collectionSlug?: string;
  brands?: string[];
  families?: string[];
  genders?: string[];
  priceMin?: number | null;
  priceMax?: number | null;
  q?: string;
  sort?: "featured" | "price_asc" | "price_desc" | "newest" | "name";
  page?: number;
  perPage?: number;
  onlyAvailable?: boolean;
}

async function categoryIdsIncludingChildren(slug: string): Promise<string[] | null> {
  const cat = await prisma.category.findUnique({ where: { slug }, include: { children: { include: { children: true } } } });
  if (!cat) return null;
  const ids = [cat.id];
  for (const c of cat.children) {
    ids.push(c.id);
    for (const cc of c.children) ids.push(cc.id);
  }
  return ids;
}

export async function listProducts(filters: CatalogFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? PRODUCTS_PER_PAGE;

  const where: Prisma.ProductWhereInput = { status: "ACTIVE", variants: { some: { active: true } } };
  const and: Prisma.ProductWhereInput[] = [];

  if (filters.categorySlug) {
    const ids = await categoryIdsIncludingChildren(filters.categorySlug);
    if (!ids) return { items: [] as ProductCard[], total: 0, page, pages: 0, perPage };
    and.push({ categoryId: { in: ids } });
  }
  if (filters.collectionSlug) and.push({ collection: { slug: filters.collectionSlug } });
  if (filters.brands?.length) and.push({ brand: { slug: { in: filters.brands } } });
  if (filters.genders?.length) and.push({ gender: { in: filters.genders } });
  if (filters.families?.length) {
    and.push({ OR: filters.families.map((f) => ({ families: { contains: f, mode: "insensitive" } })) });
  }
  if (filters.q) {
    const q = filters.q.trim();
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { subtitle: { contains: q, mode: "insensitive" } },
        { families: { contains: q, mode: "insensitive" } },
        { notesTop: { contains: q, mode: "insensitive" } },
        { notesHeart: { contains: q, mode: "insensitive" } },
        { notesBase: { contains: q, mode: "insensitive" } },
        { shortDescription: { contains: q, mode: "insensitive" } },
        { brand: { name: { contains: q, mode: "insensitive" } } },
        { collection: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (filters.onlyAvailable) and.push({ variants: { some: { active: true, stock: { gt: 0 } } } });
  if (and.length) where.AND = and;

  const rows = await prisma.product.findMany({
    where,
    include: cardInclude,
    orderBy: [{ featured: "desc" }, { position: "asc" }, { createdAt: "desc" }],
  });

  let cards = rows.map(toCard);
  if (filters.priceMin != null) cards = cards.filter((c) => c.priceFrom >= filters.priceMin!);
  if (filters.priceMax != null) cards = cards.filter((c) => c.priceFrom <= filters.priceMax!);

  switch (filters.sort) {
    case "price_asc":
      cards.sort((a, b) => a.priceFrom - b.priceFrom);
      break;
    case "price_desc":
      cards.sort((a, b) => b.priceFrom - a.priceFrom);
      break;
    case "name":
      cards.sort((a, b) => a.name.localeCompare(b.name, "fr"));
      break;
    case "newest": {
      const order = new Map(rows.map((r, i) => [r.id, r.createdAt.getTime() * 1000 + i]));
      cards.sort((a, b) => (order.get(b.id) ?? 0) - (order.get(a.id) ?? 0));
      break;
    }
    default:
      break;
  }

  const total = cards.length;
  const pages = Math.ceil(total / perPage);
  const items = cards.slice((page - 1) * perPage, page * perPage);
  return { items, total, page, pages, perPage };
}

export async function getFilterOptions() {
  const [brands, products] = await Promise.all([
    prisma.brand.findMany({ where: { active: true, products: { some: { status: "ACTIVE" } } }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { status: "ACTIVE" }, select: { families: true, gender: true } }),
  ]);
  const families = new Map<string, number>();
  const genders = new Map<string, number>();
  for (const p of products) {
    for (const f of splitList(p.families)) families.set(f, (families.get(f) ?? 0) + 1);
    genders.set(p.gender, (genders.get(p.gender) ?? 0) + 1);
  }
  return {
    brands: brands.map((b) => ({ slug: b.slug, name: b.name })),
    families: [...families.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr")).map(([name, count]) => ({ name, count })),
    genders: [...genders.entries()].map(([value, count]) => ({ value, count })),
  };
}

export async function getFeaturedProducts(limit = 8): Promise<ProductCard[]> {
  const rows = await prisma.product.findMany({
    where: { status: "ACTIVE", featured: true, variants: { some: { active: true } } },
    include: cardInclude,
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(toCard);
}

export async function getProductsByIds(ids: string[]): Promise<ProductCard[]> {
  if (!ids.length) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: ids }, status: "ACTIVE" }, include: cardInclude });
  const byId = new Map(rows.map((r) => [r.id, toCard(r)]));
  return ids.map((id) => byId.get(id)).filter((c): c is ProductCard => Boolean(c));
}

export async function getNewProducts(limit = 8): Promise<ProductCard[]> {
  const rows = await prisma.product.findMany({
    where: { status: "ACTIVE", isNew: true, variants: { some: { active: true } } },
    include: cardInclude,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toCard);
}

// ------------------------------------------------------------------ Fiche produit

/** preview = aperçu administrateur : affiche aussi les brouillons (jamais indexé, réservé aux sessions admin). */
export async function getProductBySlug(slug: string, preview = false) {
  const p = await prisma.product.findFirst({
    where: { slug, ...(preview ? {} : { status: "ACTIVE" }) },
    include: {
      brand: true,
      category: { include: { parent: true } },
      collection: true,
      images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
      variants: { where: { active: true }, orderBy: { position: "asc" } },
    },
  });
  if (!p) return null;
  return { ...p, variantInfos: p.variants.map(toVariantInfo) };
}

export async function getRelatedProducts(productId: string, collectionId: string | null, categoryId: string | null, limit = 4) {
  const where: Prisma.ProductWhereInput = { status: "ACTIVE", id: { not: productId }, variants: { some: { active: true } } };
  if (collectionId) where.collectionId = collectionId;
  else if (categoryId) where.categoryId = categoryId;
  let rows = await prisma.product.findMany({ where, include: cardInclude, take: limit, orderBy: { position: "asc" } });
  if (rows.length < limit) {
    const extra = await prisma.product.findMany({
      where: { status: "ACTIVE", id: { notIn: [productId, ...rows.map((r) => r.id)] }, variants: { some: { active: true } } },
      include: cardInclude,
      take: limit - rows.length,
      orderBy: [{ featured: "desc" }, { position: "asc" }],
    });
    rows = [...rows, ...extra];
  }
  return rows.map(toCard);
}

// ------------------------------------------------------------------ Navigation et contenu

export async function getNavigation() {
  const [categories, collections, pages, menuItems] = await Promise.all([
    prisma.category.findMany({
      where: { active: true, showInMenu: true, parentId: null },
      include: { children: { where: { active: true, showInMenu: true }, orderBy: { position: "asc" } } },
      orderBy: { position: "asc" },
    }),
    prisma.collection.findMany({ where: { active: true }, orderBy: { position: "asc" } }),
    prisma.page.findMany({ where: { published: true, showInFooter: true }, orderBy: { position: "asc" }, select: { slug: true, title: true } }),
    prisma.menuItem.findMany({ where: { active: true }, orderBy: { position: "asc" } }),
  ]);
  return { categories, collections, pages, menuItems };
}

export async function getActiveAnnouncements() {
  const now = new Date();
  return prisma.announcement.findMany({
    where: {
      active: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: { position: "asc" },
  });
}

export async function getHomeSections(preview = false) {
  return prisma.homeSection.findMany({ where: preview ? {} : { active: true }, orderBy: { position: "asc" } });
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findFirst({
    where: { slug, active: true },
    include: { parent: true, children: { where: { active: true }, orderBy: { position: "asc" } } },
  });
}

export async function getCollectionBySlug(slug: string) {
  return prisma.collection.findFirst({ where: { slug, active: true } });
}

export async function getActiveCollections() {
  return prisma.collection.findMany({ where: { active: true }, orderBy: { position: "asc" } });
}

export async function getTopCategories() {
  return prisma.category.findMany({ where: { active: true, parentId: null }, orderBy: { position: "asc" } });
}
