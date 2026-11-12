import type { MetadataRoute } from "next";
export const revalidate = 3600;
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const [products, categories, collections, pages] = await Promise.all([
    prisma.product.findMany({ where: { status: "ACTIVE" }, select: { slug: true, updatedAt: true } }),
    prisma.category.findMany({ where: { active: true }, select: { slug: true } }),
    prisma.collection.findMany({ where: { active: true }, select: { slug: true } }),
    prisma.page.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
  ]);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/parfums`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/collections`, changeFrequency: "weekly", priority: 0.7 },
    ...products.map((p) => ({ url: `${base}/produits/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...categories.map((c) => ({ url: `${base}/categories/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...collections.map((c) => ({ url: `${base}/collections/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...pages.map((p) => ({ url: `${base}/pages/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.4 })),
  ];
}
