import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveCollections, getCollectionBySlug } from "@/lib/catalog";
import { CatalogList, parseCatalogParams, type SearchParams } from "@/components/shop/catalog-list";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCollectionBySlug(slug);
  if (!c) return {};
  return { title: `Collection ${c.name}`, description: c.tagline ?? undefined };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const c = await getCollectionBySlug(slug);
  if (!c) notFound();
  const others = (await getActiveCollections()).filter((o) => o.id !== c.id);
  const filters = { ...parseCatalogParams(sp), collectionSlug: slug };
  return (
    <>
      <section className="hero hero--short">
        <div className="hero__media">{c.heroImageUrl && <img src={c.heroImageUrl} alt="" />}</div>
        <div className="container">
          <div className="hero__content hero__content--center">
            <p className="eyebrow">Collection</p>
            <h1 className="hero__title">{c.name}</h1>
            {c.tagline && <p className="hero__text">{c.tagline}</p>}
          </div>
        </div>
      </section>
      <div className="container">
        {c.description && <div className="rte container--text" style={{ margin: "3rem auto", textAlign: "center" }} dangerouslySetInnerHTML={{ __html: c.description }} />}
        <CatalogList basePath={`/collections/${slug}`} filters={filters} searchParams={sp} />
        {others.length > 0 && (
          <section className="section">
            <div className="section__head">
              <p className="eyebrow">Explorer</p>
              <h2>Les autres collections</h2>
            </div>
            <div className={`tiles${others.length === 3 ? " tiles--3" : ""}`}>
              {others.slice(0, 4).map((o) => (
                <Link key={o.id} href={`/collections/${o.slug}`} className="tile">
                  {(o.imageUrl ?? o.heroImageUrl) && <img src={o.imageUrl ?? o.heroImageUrl ?? ""} alt="" loading="lazy" />}
                  <div className="tile__label">
                    <h3>{o.name}</h3>
                    {o.tagline && <span>{o.tagline}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
