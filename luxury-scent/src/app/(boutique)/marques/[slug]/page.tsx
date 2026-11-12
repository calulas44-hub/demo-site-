import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CatalogList, parseCatalogParams, type SearchParams } from "@/components/shop/catalog-list";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await prisma.brand.findFirst({ where: { slug, active: true } });
  return b ? { title: b.name, description: b.description ?? undefined } : {};
}

export default async function BrandPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const brand = await prisma.brand.findFirst({ where: { slug, active: true } });
  if (!brand) notFound();
  const filters = { ...parseCatalogParams(sp), brands: [slug] };
  return (
    <div className="container">
      <header className="plp-head">
        <p className="eyebrow">Marque</p>
        <h1>{brand.name}</h1>
        {brand.description && <p className="lead">{brand.description}</p>}
      </header>
      <CatalogList basePath={`/marques/${slug}`} filters={filters} searchParams={sp} />
    </div>
  );
}
