import type { Metadata } from "next";
import Link from "next/link";
import { isAdminPreview } from "@/lib/preview";
import { PreviewBanner } from "@/components/shop/preview-banner";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts, splitList } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { ProductPurchase } from "@/components/shop/product-purchase";
import { ProductCard } from "@/components/shop/product-card";
import { Reveal } from "@/components/shop/reveal";
import { Icon } from "@/components/shop/icon";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ variante?: string; apercu?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return {};
  const title = p.seoTitle ?? [p.name, p.subtitle, p.brand?.name].filter(Boolean).join(" ⋅ ");
  return {
    title,
    description: p.seoDescription ?? p.shortDescription ?? undefined,
    openGraph: { title, images: p.images.find((i) => i.kind !== "VIDEO") ? [{ url: p.images.find((i) => i.kind !== "VIDEO")!.url }] : undefined, type: "website" },
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const preview = await isAdminPreview(sp.apercu);
  const p = await getProductBySlug(slug, preview);
  if (!p) notFound();
  const [related, settings] = await Promise.all([getRelatedProducts(p.id, p.collectionId, p.categoryId, 4), getSettings()]);
  const families = splitList(p.families);
  const hasNotes = p.notesTop || p.notesHeart || p.notesBase;
  const appUrl = process.env.APP_URL ?? "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${p.name}${p.subtitle ? " — " + p.subtitle : ""}`,
    image: p.images.filter((i) => i.kind !== "VIDEO").map((i) => (i.url.startsWith("http") ? i.url : `${appUrl}${i.url}`)),
    description: p.shortDescription ?? undefined,
    brand: p.brand ? { "@type": "Brand", name: p.brand.name } : undefined,
    offers: p.variantInfos.map((v) => ({
      "@type": "Offer",
      sku: v.sku ?? undefined,
      price: (v.effectivePrice / 100).toFixed(2),
      priceCurrency: "EUR",
      availability: v.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${appUrl}/produits/${p.slug}?variante=${v.id}`,
    })),
  };

  return (
    <div className="container">
      {preview && p.status !== "ACTIVE" && <PreviewBanner text="Ce produit n'est pas en ligne (brouillon ou archivé)." />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="breadcrumb" aria-label="Fil d'Ariane" style={{ justifyContent: "flex-start", margin: "1.5rem 0 0" }}>
        <Link href="/">Accueil</Link>
        <span aria-hidden="true">/</span>
        {p.category?.parent && (
          <>
            <Link href={`/categories/${p.category.parent.slug}`}>{p.category.parent.name}</Link>
            <span aria-hidden="true">/</span>
          </>
        )}
        {p.category && (
          <>
            <Link href={`/categories/${p.category.slug}`}>{p.category.name}</Link>
            <span aria-hidden="true">/</span>
          </>
        )}
        <span aria-current="page">{p.name}</span>
      </nav>

      <div className="pdp">
        <div>
          <div className="gallery gallery--mobile">
            {p.images.map((img) => (
              <div className="gallery__item" key={img.id}>
                <GalleryMedia img={img} fallbackAlt={p.name} />
              </div>
            ))}
          </div>
          <div className={`gallery gallery--desktop${p.images.length <= 2 ? " gallery--two" : ""}`}>
            {p.images.map((img, i) => (
              <div className="gallery__item" key={img.id}>
                <GalleryMedia img={img} fallbackAlt={p.name} eager={i === 0} />
              </div>
            ))}
            {p.images.length === 0 && <div className="gallery__item" />}
          </div>
        </div>

        <div className="pdp__info">
          {p.brand && (
            <div className="pdp__brand">
              <Link href={`/marques/${p.brand.slug}`}>{p.brand.name}</Link>
            </div>
          )}
          {p.commercialLabel && <p className="badge badge--gold pdp__label">{p.commercialLabel}</p>}
          <h1 className="pdp__title">{p.name}</h1>
          {p.subtitle && <p className="pdp__subtitle">{p.subtitle}</p>}
          {families.length > 0 && (
            <div className="pdp__families">
              {families.map((f) => (
                <span key={f}>{f}</span>
              ))}
            </div>
          )}
          {p.shortDescription && <p className="lead">{p.shortDescription}</p>}

          <ProductPurchase productName={p.name} variants={p.variantInfos} initialVariantId={sp.variante} />

          <ul className="perks pdp__perks">
            {settings.reassurance.slice(0, 3).map((r, i) => (
              <li key={i}>
                <Icon name={r.icon} /> <strong>{r.title}</strong>&nbsp;{r.text}
              </li>
            ))}
          </ul>

          {hasNotes && (
            <div className="notes">
              <p className="caps">Pyramide olfactive</p>
              <dl>
                {p.notesTop && (
                  <div className="notes__row">
                    <dt>Tête</dt>
                    <dd>{p.notesTop}</dd>
                  </div>
                )}
                {p.notesHeart && (
                  <div className="notes__row">
                    <dt>Cœur</dt>
                    <dd>{p.notesHeart}</dd>
                  </div>
                )}
                {p.notesBase && (
                  <div className="notes__row">
                    <dt>Fond</dt>
                    <dd>{p.notesBase}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {p.description && (
            <details className="accordion" open>
              <summary>Description</summary>
              <div className="accordion__body rte" dangerouslySetInnerHTML={{ __html: p.description }} />
            </details>
          )}
          <details className="accordion">
            <summary>Livraison et retours</summary>
            <div className="accordion__body">
              <p>{settings.shippingInfo}</p>
              <p>
                <Link href="/pages/livraison-et-retours" className="link-line">
                  En savoir plus
                </Link>
              </p>
            </div>
          </details>
          <details className="accordion">
            <summary>Conseils d&apos;utilisation</summary>
            <div className="accordion__body">
              <p>Vaporisez sur les points de chaleur (poignets, cou) à 15 cm de la peau. Conservez le flacon à l&apos;abri de la lumière et de la chaleur.</p>
            </div>
          </details>
        </div>
      </div>

      {p.inspiration && (
        <section className="section">
          <Reveal className="pdp__story">
            <div>
              <p className="eyebrow">L&apos;inspiration</p>
              <h2>{p.name}</h2>
            </div>
            <div className="rte lead" dangerouslySetInnerHTML={{ __html: p.inspiration }} />
          </Reveal>
        </section>
      )}

      {related.length > 0 && (
        <section className="section">
          <Reveal className="section__head">
            <p className="eyebrow">{p.collection ? `Collection ${p.collection.name}` : "Vous aimerez aussi"}</p>
            <h2>{p.collection ? "Compléter le rituel" : "Nos suggestions"}</h2>
          </Reveal>
          <div className="grid">
            {related.map((r, i) => (
              <Reveal key={r.id} delay={(i % 4) as 0 | 1 | 2 | 3}>
                <ProductCard product={r} />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GalleryMedia({ img, fallbackAlt, eager = false }: { img: { url: string; alt: string | null; kind: string; posterUrl: string | null }; fallbackAlt: string; eager?: boolean }) {
  if (img.kind === "VIDEO") {
    return <video src={img.url} poster={img.posterUrl ?? undefined} autoPlay muted loop playsInline controls preload="metadata" aria-label={img.alt ?? fallbackAlt} />;
  }
  return <img src={img.url} alt={img.alt ?? fallbackAlt} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} />;
}
