"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useCart } from "./cart-context";
import { Icon } from "./icon";
import { Price } from "./price";
import { removeFromCartAction, updateCartAction } from "@/lib/cart-actions";

export function CartDrawer() {
  const { cart, isOpen, close, setCart, toast } = useCart();
  const [pending, startTransition] = useTransition();

  const update = (variantId: string, quantity: number) => {
    startTransition(async () => {
      const next = quantity <= 0 ? await removeFromCartAction(variantId) : await updateCartAction(variantId, quantity);
      setCart(next);
    });
  };

  return (
    <>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      <div className={`drawer${isOpen ? " is-open" : ""}`} aria-hidden={!isOpen}>
        <div className="drawer__backdrop" onClick={close} />
        <aside className="drawer__panel drawer__panel--right" role="dialog" aria-modal="true" aria-label="Panier">
          <div className="drawer__head">
            <span className="drawer__title">
              Mon panier <span className="muted small">({cart.count})</span>
            </span>
            <button type="button" className="icon-btn" onClick={close} aria-label="Fermer le panier">
              <Icon name="close" />
            </button>
          </div>
          <div className="drawer__body" style={{ opacity: pending ? 0.6 : 1, transition: "opacity .2s" }}>
            {cart.lines.length === 0 ? (
              <div className="empty">
                <p>Votre panier est vide.</p>
                <Link href="/parfums" className="btn btn--outline" onClick={close}>
                  Découvrir les parfums
                </Link>
              </div>
            ) : (
              <>
                {cart.warnings.map((w) => (
                  <p key={w} className="alert alert--info small">
                    {w}
                  </p>
                ))}
                {cart.lines.map((l) => (
                  <div key={l.variantId} className="cart-line">
                    <Link href={`/produits/${l.slug}`} className="cart-line__img" onClick={close} tabIndex={-1} aria-hidden="true">
                      {l.imageUrl && <img src={l.imageUrl} alt="" loading="lazy" />}
                    </Link>
                    <div>
                      {l.brand && <div className="card__brand">{l.brand}</div>}
                      <Link href={`/produits/${l.slug}`} className="cart-line__title" onClick={close}>
                        {l.name}
                      </Link>
                      <div className="cart-line__meta">
                        {l.subtitle ? `${l.subtitle} · ` : ""}
                        {l.variantLabel}
                      </div>
                      <div className="cart-line__row">
                        <div className="qty" aria-label="Quantité">
                          <button type="button" onClick={() => update(l.variantId, l.quantity - 1)} aria-label="Diminuer">
                            <Icon name="minus" />
                          </button>
                          <input type="number" value={l.quantity} min={0} max={l.stock} readOnly aria-label="Quantité" />
                          <button type="button" onClick={() => update(l.variantId, l.quantity + 1)} aria-label="Augmenter" disabled={l.quantity >= l.stock}>
                            <Icon name="plus" />
                          </button>
                        </div>
                        <strong>
                          <Price cents={l.total} />
                        </strong>
                      </div>
                      <button type="button" className="cart-remove" onClick={() => update(l.variantId, 0)}>
                        Retirer
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
          {cart.lines.length > 0 && (
            <div className="drawer__foot">
              {cart.freeShippingThreshold !== null && (
                <div className="cart-progress">
                  {cart.freeShippingRemaining && cart.freeShippingRemaining > 0 ? (
                    <>
                      Plus que <strong><Price cents={cart.freeShippingRemaining} /></strong> pour la livraison offerte
                    </>
                  ) : (
                    <>La livraison vous est offerte</>
                  )}
                  <div className="cart-progress__bar">
                    <span style={{ width: `${Math.min(100, (cart.subtotal / cart.freeShippingThreshold) * 100)}%` }} />
                  </div>
                </div>
              )}
              <div className="cart-total">
                <span>Sous-total</span>
                <strong>
                  <Price cents={cart.subtotal} />
                </strong>
              </div>
              <p className="small muted">Livraison calculée à l&apos;étape suivante.</p>
              <Link href="/commande" className="btn btn--block" onClick={close}>
                Commander
              </Link>
              <Link href="/panier" className="link-line" style={{ display: "inline-block", marginTop: "1rem" }} onClick={close}>
                Voir le panier
              </Link>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
