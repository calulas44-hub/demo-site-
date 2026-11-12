import Link from "next/link";
import { getActiveCollections, getFeaturedProducts, getHomeSections, getProductsByIds, getTopCategories } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { ProductCard } from "@/components/shop/product-card";
import { Reveal } from "@/components/shop/reveal";
import { Icon } from "@/components/shop/icon";
import { NewsletterForm } from "@/components/shop/newsletter-form";
import { prisma } from "@/lib/db";
import { isAdminPreview } from "@/lib/preview";
import { PreviewBanner } from "@/components/shop/preview-banner";
import { isVideoUrl } from "@/lib/media-url";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ apercu?: string }> }) {
  const preview = await isAdminPreview((await searchParams).apercu);
  const [sections, settings] = await Promise.all([getHomeSections(preview), getSettings()]);
  const first = sections[0];
  const hasHero = first?.type === "HERO";

  return (
    <>
      {!hasHero && <div style={{ height: 0 }} />}
      {preview && <PreviewBanner text="Aperçu : les sections masquées sont affichées (contour pointillé)." />}
      {sections.map((s, i) =>
        s.active ? (
          <Section key={s.id} section={s} index={i} settings={settings} />
        ) : (
          <div key={s.id} className="preview-hidden">
            <Section section={s} index={i} settings={settings} />
          </div>
        ),
      )}
      {sections.length === 0 && (
        <section className="section container prose-center">
          <h1>{settings.brandName}</h1>
          <p className="lead">Ajoutez des sections d&apos;accueil depuis l&apos;administration.</p>
        </section>
      )}
    </>
  );
}

type SectionRow = Awaited<ReturnType<typeof getHomeSections>>[number];
type Settings = Awaited<ReturnType<typeof getSettings>>;

function parseData(s: SectionRow): Record<string, unknown> {
  try {
    return s.data ? (JSON.parse(s.data) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function Section({ section: s, index, settings }: { section: SectionRow; index: number; settings: Settings }) {
  const data = parseData(s);
  switch (s.type) {
    case "HERO": {
      const align = (data.align as string) ?? "left";
      const theme = (data.theme as string) ?? "dark";
      const layout = (data.layout as string) ?? "cover";
      const video = isVideoUrl(s.imageUrl);
      // Proportions réelles de l'image (médiathèque) : l'image est affichée en entier, sans recadrage.
      const media = s.imageUrl && layout !== "cover" ? await prisma.media.findUnique({ where: { url: s.imageUrl }, select: { width: true, height: true } }) : null;
      const ratio = media?.width && media?.height ? `${media.width} / ${media.height}` : "3 / 2";
      return (
        <section
          className={`hero hero--${layout}${theme === "light" ? " hero--light" : ""}${index > 0 && layout === "cover" ? " hero--short" : ""}${s.imageMobileUrl ? " hero--has-mobile" : ""}`}
          style={{ "--hero-ratio": ratio } as React.CSSProperties}
        >
          <div className="hero__media">
            {s.imageUrl &&
              (video ? (
                <video src={s.imageUrl} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
              ) : (
                <picture>
                  {s.imageMobileUrl && <source media="(max-width: 767px)" srcSet={s.imageMobileUrl} />}
                  <img src={s.imageUrl} alt="" fetchPriority="high" />
                </picture>
              ))}
          </div>
          <div className={`container`}>
            <div className={`hero__content hero__content--${align}`}>
              {s.subtitle && <p className="eyebrow">{s.subtitle}</p>}
              {s.title && <h1 className="hero__title">{s.title}</h1>}
              {s.text && <p className="hero__text">{s.text}</p>}
              {s.buttonLabel && (
                <div className="hero__actions">
                  <Link href={s.buttonUrl ?? "/parfums"} className={theme === "light" ? "btn" : "btn btn--light"}>
                    {s.buttonLabel}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      );
    }
    case "REASSURANCE":
      if (settings.reassurance.length === 0) return null;
      return (
        <section className="reassurance">
          <ul className="container reassurance__list">
            {settings.reassurance.map((r, i) => (
              <li className="reassurance__item" key={i}>
                <Icon name={r.icon} />
                <div>
                  <strong>{r.title}</strong>
                  <span>{r.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      );
    case "FEATURED_PRODUCTS": {
      const ids = Array.isArray(data.productIds) ? (data.productIds as string[]) : [];
      const products = ids.length ? await getProductsByIds(ids) : await getFeaturedProducts(8);
      if (products.length === 0) return null;
      return (
        <section className="section container">
          <Reveal className="section__head">
            {s.subtitle && <p className="eyebrow">{s.subtitle}</p>}
            {s.title && <h2>{s.title}</h2>}
            {s.text && <p className="lead">{s.text}</p>}
          </Reveal>
          <div className="grid">
            {products.map((p, i) => (
              <Reveal key={p.id} delay={(i % 4) as 0 | 1 | 2 | 3}>
                <ProductCard product={p} priority={index < 2 && i < 4} />
              </Reveal>
            ))}
          </div>
          {s.buttonLabel && (
            <div className="section__foot">
              <Link href={s.buttonUrl ?? "/parfums"} className="btn btn--outline">
                {s.buttonLabel}
              </Link>
            </div>
          )}
        </section>
      );
    }
    case "COLLECTIONS": {
      const collections = await getActiveCollections();
      if (collections.length === 0) return null;
      return (
        <section className="section section--alt">
          <div className="container">
            <Reveal className="section__head">
              {s.subtitle && <p className="eyebrow">{s.subtitle}</p>}
              {s.title && <h2>{s.title}</h2>}
              {s.text && <p className="lead">{s.text}</p>}
            </Reveal>
            <div className={`tiles${collections.length === 3 ? " tiles--3" : ""}`}>
              {collections.slice(0, 4).map((c, i) => (
                <Reveal key={c.id} delay={(i % 4) as 0 | 1 | 2 | 3}>
                  <Link href={`/collections/${c.slug}`} className="tile">
                    {(c.imageUrl ?? c.heroImageUrl) && <img src={c.imageUrl ?? c.heroImageUrl ?? ""} alt="" loading="lazy" />}
                    <div className="tile__label">
                      <h3>{c.name}</h3>
                      {c.tagline && <span>{c.tagline}</span>}
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      );
    }
    case "CATEGORIES": {
      const cats = (await getTopCategories()).filter((c) => c.imageUrl);
      if (cats.length === 0) return null;
      return (
        <section className="section container">
          <Reveal className="section__head">
            {s.subtitle && <p className="eyebrow">{s.subtitle}</p>}
            {s.title && <h2>{s.title}</h2>}
          </Reveal>
          <div className={`tiles${cats.length === 3 ? " tiles--3" : ""}`}>
            {cats.slice(0, 4).map((c, i) => (
              <Reveal key={c.id} delay={(i % 4) as 0 | 1 | 2 | 3}>
                <Link href={`/categories/${c.slug}`} className="tile">
                  <img src={c.imageUrl ?? ""} alt="" loading="lazy" />
                  <div className="tile__label">
                    <h3>{c.name}</h3>
                    {c.description && <span>{c.description}</span>}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      );
    }
    case "EDITORIAL": {
      const flip = data.imageSide === "right";
      return (
        <section className="section container">
          <Reveal className={`editorial${flip ? " editorial--flip" : ""}`}>
            <div className="editorial__media">{s.imageUrl && <img src={s.imageUrl} alt="" loading="lazy" />}</div>
            <div className="editorial__body">
              {s.subtitle && <p className="eyebrow">{s.subtitle}</p>}
              {s.title && <h2>{s.title}</h2>}
              {s.text && <p className="lead">{s.text}</p>}
              {s.buttonLabel && (
                <Link href={s.buttonUrl ?? "/"} className="btn btn--outline">
                  {s.buttonLabel}
                </Link>
              )}
            </div>
          </Reveal>
        </section>
      );
    }
    case "BANNER":
      return (
        <section className="banner">
          {s.imageUrl && <img src={s.imageUrl} alt="" loading="lazy" />}
          <div className="container">
            <Reveal className="banner__content">
              {s.subtitle && <p className="eyebrow">{s.subtitle}</p>}
              {s.title && <h2>{s.title}</h2>}
              {s.text && <p className="lead">{s.text}</p>}
              {s.buttonLabel && (
                <Link href={s.buttonUrl ?? "/parfums"} className="btn">
                  {s.buttonLabel}
                </Link>
              )}
            </Reveal>
          </div>
        </section>
      );
    case "NEWSLETTER":
      return (
        <section className="section section--dark newsletter">
          <div className="container container--narrow">
            <Reveal>
              {s.subtitle && <p className="eyebrow">{s.subtitle}</p>}
              {s.title && <h2>{s.title}</h2>}
              {s.text && <p className="lead" style={{ color: "inherit", opacity: 0.8 }}>{s.text}</p>}
              <NewsletterForm />
            </Reveal>
          </div>
        </section>
      );
    default:
      return null;
  }
}
