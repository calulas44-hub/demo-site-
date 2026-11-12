import type { Metadata } from "next";
import { CatalogList, parseCatalogParams, type SearchParams } from "@/components/shop/catalog-list";

export const metadata: Metadata = { title: "Tous les parfums", description: "Eaux de parfum, extraits, coffrets : découvrez toute la sélection Luxury Scent." };

export default async function AllProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters = parseCatalogParams(sp);
  return (
    <div className="container">
      <header className="plp-head">
        <p className="eyebrow">Catalogue</p>
        <h1>Tous les parfums</h1>
        <p className="lead">Eaux de parfum, extraits, colognes et coffrets. Chaque création est expédiée dans son écrin.</p>
      </header>
      <CatalogList basePath="/parfums" filters={filters} searchParams={sp} />
    </div>
  );
}
