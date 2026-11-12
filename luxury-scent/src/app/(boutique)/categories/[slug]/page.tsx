import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryBySlug } from "@/lib/catalog";
import { CatalogList, parseCatalogParams, type SearchParams } from "@/components/shop/catalog-list";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) return {};
  return { title: cat.seoTitle ?? cat.name, description: cat.seoDescription ?? cat.description ?? undefined };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();
  const filters = { ...parseCatalogParams(sp), categorySlug: slug };
  const isGenderCat = ["parfums-femme", "parfums-homme", "parfums-mixtes"].includes(slug);
  return (
    <div className="container">
      {cat.imageUrl && !cat.parent && (
        <div className="plp-hero" style={{ marginTop: "1.5rem" }}>
          <img src={cat.imageUrl} alt="" />
        </div>
      )}
      <header className="plp-head">
        <nav className="breadcrumb" aria-label="Fil d'Ariane">
          <Link href="/">Accueil</Link>
          <span aria-hidden="true">/</span>
          {cat.parent && (
            <>
              <Link href={`/categories/${cat.parent.slug}`}>{cat.parent.name}</Link>
              <span aria-hidden="true">/</span>
            </>
          )}
          <span aria-current="page">{cat.name}</span>
        </nav>
        <h1>{cat.parent ? `${cat.parent.name} ${cat.name.toLowerCase()}` : cat.name}</h1>
        {cat.description && <p className="lead">{cat.description}</p>}
      </header>
      {cat.children.length > 0 && (
        <div className="subcats">
          <Link href={`/categories/${cat.slug}`} aria-current="page">
            Tout
          </Link>
          {cat.children.map((c) => (
            <Link key={c.id} href={`/categories/${c.slug}`}>
              {c.name}
            </Link>
          ))}
        </div>
      )}
      <CatalogList basePath={`/categories/${slug}`} filters={filters} searchParams={sp} hideGender={isGenderCat} />
    </div>
  );
}
