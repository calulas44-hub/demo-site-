import Link from "next/link";
import type { ProductCard as Card } from "@/lib/catalog";
import { Price } from "./price";
import { QuickAdd } from "./quick-add";

export function ProductCard({ product, priority = false }: { product: Card; priority?: boolean }) {
  const href = `/produits/${product.slug}`;
  return (
    <article className={`card${product.available ? "" : " card--soldout"}`}>
      <Link href={href} className="card__media" tabIndex={-1} aria-hidden="true">
        {product.image ? (
          <img className="card__img card__img--main" src={product.image} alt="" loading={priority ? "eager" : "lazy"} />
        ) : (
          <span className="card__img card__img--main" />
        )}
        {product.hoverImage && <img className="card__img card__img--hover" src={product.hoverImage} alt="" loading="lazy" />}
        <div className="card__badges">
          {!product.available && <span className="badge badge--dark">Épuisé</span>}
          {product.available && product.commercialLabel && <span className="badge badge--gold">{product.commercialLabel}</span>}
          {product.available && product.isNew && <span className="badge">Nouveauté</span>}
          {product.available && product.isLimited && <span className="badge badge--gold">Édition limitée</span>}
          {product.available && product.compareAt && <span className="badge badge--gold">Offre</span>}
        </div>
      </Link>
      {product.available && (
        <div className="card__quick">
          <QuickAdd slug={product.slug} singleSize={product.sizes.length === 1} />
        </div>
      )}
      <div className="card__body">
        {product.brand && <div className="card__brand">{product.brand}</div>}
        <h3 className="card__title">
          <Link href={href}>{product.name}</Link>
        </h3>
        {product.subtitle && <div className="card__subtitle">{product.subtitle}</div>}
        {product.families.length > 0 && <div className="card__families">{product.families.slice(0, 3).join(" · ")}</div>}
        <div className="card__price">
          {product.hasRange && <span className="card__from">À partir de</span>}
          {product.compareAt && (
            <s>
              <Price cents={product.compareAt} />
            </s>
          )}
          <Price cents={product.priceFrom} />
        </div>
      </div>
    </article>
  );
}
