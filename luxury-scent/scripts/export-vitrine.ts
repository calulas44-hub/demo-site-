/**
 * Exporte le contenu de la boutique (base Luxury Scent) vers le site vitrine statique.
 * Écrit ../luxury-scent-vitrine/data/site.json et copie les images utilisées dans
 * ../luxury-scent-vitrine/assets/img/. Ne prend que les produits « En ligne ».
 *
 * Usage : npm run vitrine:export   (puis, dans luxury-scent-vitrine : node build.mjs)
 */
import { PrismaClient } from "@prisma/client";
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const root = process.cwd();
const outDir = path.resolve(root, "..", "luxury-scent-vitrine");
const imgDir = path.join(outDir, "assets", "img");
const uploadRoot = path.resolve(root, process.env.UPLOAD_DIR || "./storage/uploads");

// Les produits créés par les tests automatiques ne doivent jamais partir sur la vitrine.
const isTestData = (name: string) => /\btest\b/i.test(name);

const copied = new Map<string, string>();
function asset(url: string | null | undefined): string | null {
  if (!url) return null;
  if (copied.has(url)) return copied.get(url)!;
  if (!url.startsWith("/uploads/")) return null;
  const rel = url.slice("/uploads/".length);
  const src = path.join(uploadRoot, rel);
  if (!existsSync(src)) {
    console.warn("Image absente, ignorée :", url);
    return null;
  }
  const dest = path.join(imgDir, rel);
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  const publicUrl = `/assets/img/${rel}`;
  copied.set(url, publicUrl);
  return publicUrl;
}

async function main() {
  rmSync(imgDir, { recursive: true, force: true });
  mkdirSync(imgDir, { recursive: true });

  const [settingsRow, products, collections, categories, sections, announcements, pages] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "site" } }),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      include: { brand: true, category: { include: { parent: true } }, collection: true, images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] }, variants: { where: { active: true }, orderBy: { position: "asc" } } },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    prisma.collection.findMany({ where: { active: true }, orderBy: { position: "asc" } }),
    prisma.category.findMany({ where: { active: true }, orderBy: { position: "asc" } }),
    prisma.homeSection.findMany({ where: { active: true }, orderBy: { position: "asc" } }),
    prisma.announcement.findMany({ where: { active: true }, orderBy: { position: "asc" } }),
    prisma.page.findMany({ where: { published: true }, orderBy: { position: "asc" } }),
  ]);

  const settings = settingsRow ? JSON.parse(settingsRow.value) : {};
  const kept = products.filter((p) => !isTestData(p.name) && p.variants.length > 0);

  const data = {
    exportedAt: new Date().toISOString(),
    settings: {
      brandName: settings.brandName ?? "Luxury Scent",
      tagline: settings.tagline ?? "",
      contactEmail: settings.contactEmail ?? "",
      contactPhone: settings.contactPhone ?? "",
      address: settings.address ?? "",
      openingHours: settings.openingHours ?? "",
      instagram: settings.instagram ?? "",
      facebook: settings.facebook ?? "",
      tiktok: settings.tiktok ?? "",
      seoTitle: settings.seoTitle ?? "",
      seoDescription: settings.seoDescription ?? "",
      logoUrl: asset(settings.logoUrl),
      reassurance: settings.reassurance ?? [],
    },
    announcements: announcements.map((a) => ({ text: a.text })),
    sections: sections.map((s) => ({
      type: s.type,
      title: s.title,
      subtitle: s.subtitle,
      text: s.text,
      imageUrl: asset(s.imageUrl),
      imageMobileUrl: asset(s.imageMobileUrl),
      buttonLabel: s.buttonLabel,
      buttonUrl: s.buttonUrl,
      data: s.data ? JSON.parse(s.data) : {},
    })),
    collections: collections.map((c) => ({ name: c.name, slug: c.slug, tagline: c.tagline, description: c.description, imageUrl: asset(c.imageUrl), heroImageUrl: asset(c.heroImageUrl) })),
    categories: categories.map((c) => ({ name: c.name, slug: c.slug, parentSlug: categories.find((p) => p.id === c.parentId)?.slug ?? null, description: c.description, imageUrl: asset(c.imageUrl) })),
    products: kept.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      subtitle: p.subtitle,
      brand: p.brand?.name ?? null,
      category: p.category ? { name: p.category.name, slug: p.category.slug, parent: p.category.parent?.name ?? null } : null,
      collection: p.collection ? { name: p.collection.name, slug: p.collection.slug } : null,
      gender: p.gender,
      families: (p.families ?? "").split(/[,;]/).map((f) => f.trim()).filter(Boolean),
      notesTop: p.notesTop,
      notesHeart: p.notesHeart,
      notesBase: p.notesBase,
      shortDescription: p.shortDescription,
      description: p.description,
      inspiration: p.inspiration,
      featured: p.featured,
      isNew: p.isNew,
      isLimited: p.isLimited,
      images: p.images.map((i) => ({ url: asset(i.url), alt: i.alt })).filter((i) => i.url),
      variants: p.variants.map((v) => ({
        label: v.label,
        volumeMl: v.volumeMl,
        price: v.price,
        salePrice: v.salePrice !== null && v.salePrice < v.price ? v.salePrice : null,
        available: v.stock > 0,
      })),
    })),
    pages: pages.filter((p) => ["notre-maison", "faq", "mentions-legales", "politique-de-confidentialite"].includes(p.slug)).map((p) => ({ slug: p.slug, title: p.title, content: p.content })),
  };

  // Les produits mis en avant référencent des identifiants : on les remplace par des slugs.
  for (const s of data.sections) {
    if (s.type === "FEATURED_PRODUCTS" && Array.isArray(s.data.productIds)) {
      s.data.productSlugs = (s.data.productIds as string[]).map((id) => kept.find((p) => p.id === id)?.slug).filter(Boolean);
      delete s.data.productIds;
    }
  }
  for (const p of data.products) delete (p as { id?: string }).id;

  mkdirSync(path.join(outDir, "data"), { recursive: true });
  writeFileSync(path.join(outDir, "data", "site.json"), JSON.stringify(data, null, 2) + "\n");
  const skipped = products.length - kept.length;
  console.log(`Vitrine : ${data.products.length} produits, ${data.collections.length} collections, ${copied.size} images exportés${skipped ? ` (${skipped} produit(s) de test ignoré(s))` : ""}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
