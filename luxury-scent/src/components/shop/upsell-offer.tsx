"use client";

import Link from "next/link";
import { useTransition } from "react";
import { addToCartAction } from "@/lib/cart-actions";
import { useCart } from "./cart-context";
import { Price } from "./price";

/** Encart « 2e parfum » : affiché tant que la remise n'est pas obtenue. Le calcul réel reste côté serveur. */
export function UpsellOffer({ onNavigate }: { onNavigate?: () => void }) {
  const { cart, setCart, showToast } = useCart();
  const [pending, startTransition] = useTransition();
  const offer = cart.upsellOffer;
  if (cart.discount) {
    return (
      <div className="upsell upsell--done" role="status">
        <strong>{cart.discount.label}</strong> appliquée : <Price cents={cart.discount.amount} /> d&apos;économie.
      </div>
    );
  }
  if (!offer) return null;
  const add = (variantId: string) =>
    startTransition(async () => {
      const r = await addToCartAction(variantId, 1);
      setCart(r.cart);
      if (r.cart.discount) showToast(`${r.cart.discount.label} appliquée`);
      else if (r.message) showToast(r.message);
    });
  return (
    <div className="upsell" style={{ opacity: pending ? 0.6 : 1 }}>
      <p className="upsell__title">{offer.title}</p>
      <p className="upsell__text">{offer.text}</p>
      {offer.suggestions.length > 0 && (
        <ul className="upsell__list">
          {offer.suggestions.map((s) => (
            <li key={s.variantId} className="upsell__item">
              <Link href={`/produits/${s.slug}`} className="upsell__img" onClick={onNavigate} tabIndex={-1} aria-hidden="true">
                {s.imageUrl && <img src={s.imageUrl} alt="" loading="lazy" />}
              </Link>
              <div className="upsell__info">
                <Link href={`/produits/${s.slug}`} onClick={onNavigate} className="upsell__name">
                  {s.name}
                </Link>
                <span className="small muted">{s.variantLabel}</span>
                <span className="upsell__price">
                  <s>
                    <Price cents={s.price} />
                  </s>{" "}
                  <strong>
                    <Price cents={s.discountedPrice} />
                  </strong>
                </span>
              </div>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => add(s.variantId)} disabled={pending}>
                Ajouter
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
