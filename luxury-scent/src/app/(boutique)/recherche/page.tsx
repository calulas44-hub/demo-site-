import type { Metadata } from "next";
import { CatalogList, parseCatalogParams, type SearchParams } from "@/components/shop/catalog-list";

export const metadata: Metadata = { title: "Recherche", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const filters = { ...parseCatalogParams(sp), q };
  return (
    <div className="container">
      <header className="plp-head">
        <p className="eyebrow">Recherche</p>
        <h1>{q ? `« ${q} »` : "Rechercher"}</h1>
        <form action="/recherche" method="get" role="search" className="newsletter__form" style={{ marginTop: "1.5rem" }}>
          <label className="visually-hidden" htmlFor="q">
            Rechercher
          </label>
          <input id="q" type="search" name="q" defaultValue={q} placeholder="Un parfum, une note, une marque…" className="input" />
          <button type="submit" className="btn">
            Rechercher
          </button>
        </form>
      </header>
      {q && <CatalogList basePath="/recherche" filters={filters} searchParams={sp} />}
    </div>
  );
}
