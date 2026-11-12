"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useCart } from "./cart-context";
import { Icon } from "./icon";
import { Price } from "./price";
import { UpsellOffer } from "./upsell-offer";
import { removeFromCartAction, updateCartAction } from "@/lib/cart-actions";

export function CartPageLines() {
  const { cart, setCart } = useCart();
  const [pending, startTransition] = useTransition();
  const update = (variantId: string, quantity: number) =>
    startTransition(async () => setCart(quantity <= 0 ? await removeFromCartAction(variantId) : await updateCartAction(variantId, quantity)));

  if (cart.lines.length === 0) {
    return (
      <div className="empty">
        <p>Votre panier est vide.</p>
        <Link href="/parfums" className="btn">
          Découvrir les parfums
        </Link>
      </div>
    );
  }

  return (
    <div className="cart-page" style={{ opacity: pending ? 0.6 : 1, transition: "opacity .2s" }}>
      <div className="cart-table">
        {cart.warnings.map((w) => (
          <p key={w} className="alert alert--info">
            {w}
          </p>
        ))}
        {cart.lines.map((l) => (
          <div key={l.variantId} className="cart-line">
            <Link href={`/produits/${l.slug}`} className="cart-line__img" tabIndex={-1} aria-hidden="true">
              {l.imageUrl && <img src={l.imageUrl} alt="" />}
            </Link>
            <div>
              {l.brand && <div className="card__brand">{l.brand}</div>}
              <Link href={`/produits/${l.slug}`} className="cart-line__title">
                {l.name}
              </Link>
              <div className="cart-line__meta">
                {l.subtitle ? `${l.subtitle} · ` : ""}
                {l.variantLabel} · <Price cents={l.unitPrice} />
                {l.unitPrice < l.regularPrice && (
                  <>
                    {" "}
                    <s>
                      <Price cents={l.regularPrice} />
                    </s>
                  </>
                )}
              </div>
              <div className="cart-line__row" style={{ justifyContent: "flex-start", gap: "1.2rem" }}>
                <div className="qty" aria-label="Quantité">
                  <button type="button" onClick={() => update(l.variantId, l.quantity - 1)} aria-label="Diminuer">
                    <Icon name="minus" />
                  </button>
                  <input type="number" value={l.quantity} readOnly aria-label="Quantité" />
                  <button type="button" onClick={() => update(l.variantId, l.quantity + 1)} aria-label="Augmenter" disabled={l.quantity >= l.stock}>
                    <Icon name="plus" />
                  </button>
                </div>
                <button type="button" className="cart-remove" onClick={() => update(l.variantId, 0)}>
                  Retirer
                </button>
              </div>
            </div>
            <div className="cart-line__total">
              <Price cents={l.total} />
            </div>
          </div>
        ))}
      </div>
      <aside className="summary">
        <h3>Récapitulatif</h3>
        <div className="summary__row">
          <span>Sous-total</span>
          <span>
            <Price cents={cart.subtotal} />
          </span>
        </div>
        {cart.discount && (
          <div className="summary__row summary__row--discount">
            <span>{cart.discount.label}</span>
            <span>
              − <Price cents={cart.discount.amount} />
            </span>
          </div>
        )}
        <div className="summary__row">
          <span>Livraison</span>
          <span className="muted">{cart.freeShippingRemaining === 0 ? "Offerte" : "Calculée à l'étape suivante"}</span>
        </div>
        <div className="summary__row summary__row--total">
          <span>Total TTC</span>
          <strong>
            <Price cents={cart.total} />
          </strong>
        </div>
        {cart.freeShippingThreshold !== null && cart.freeShippingRemaining ? (
          <p className="small muted" style={{ marginTop: ".8rem" }}>
            Plus que <Price cents={cart.freeShippingRemaining} /> pour la livraison offerte.
          </p>
        ) : null}
        <UpsellOffer />
        <Link href="/commande" className="btn btn--block">
          Passer la commande
        </Link>
        <ul className="perks">
          <li>
            <Icon name="lock" /> Paiement sécurisé
          </li>
        </ul>
      </aside>
    </div>
  );
}
