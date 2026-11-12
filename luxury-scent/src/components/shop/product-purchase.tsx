"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { VariantInfo } from "@/lib/catalog";
import { formatPrice, pricePer100ml } from "@/lib/money";
import { addToCartAction } from "@/lib/cart-actions";
import { useCart } from "./cart-context";
import { Icon } from "./icon";

export function ProductPurchase({ productName, variants, initialVariantId }: { productName: string; variants: VariantInfo[]; initialVariantId?: string }) {
  const firstAvailable = variants.find((v) => v.available) ?? variants[0];
  const [selectedId, setSelectedId] = useState<string>(initialVariantId && variants.some((v) => v.id === initialVariantId) ? initialVariantId : firstAvailable?.id ?? "");
  const [qty, setQty] = useState(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stickyVisible, setStickyVisible] = useState(false);
  const { setCart, open, showToast } = useCart();

  const selected = useMemo(() => variants.find((v) => v.id === selectedId) ?? firstAvailable, [variants, selectedId, firstAvailable]);

  useEffect(() => {
    if (!selected) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("variante", selected.id);
      window.history.replaceState({}, "", url.toString());
    } catch {
      /* ignore */
    }
  }, [selected]);

  useEffect(() => {
    const anchor = document.querySelector("[data-buy-anchor]");
    if (!anchor || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setStickyVisible(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(anchor);
    return () => io.disconnect();
  }, []);

  if (!selected) return null;
  const per100 = pricePer100ml(selected.effectivePrice, selected.volumeMl);

  const add = () => {
    setError(null);
    startTransition(async () => {
      const res = await addToCartAction(selected.id, qty);
      setCart(res.cart);
      if (res.ok) {
        showToast(`${productName} (${selected.label}) ajouté au panier`);
        open();
      } else setError(res.message ?? "Impossible d'ajouter cet article.");
    });
  };

  const buyButton = (block = true) => (
    <button type="button" className={`btn${block ? " btn--block" : ""}`} onClick={add} disabled={!selected.available || pending}>
      {pending ? "Ajout…" : selected.available ? "Ajouter au panier" : "Épuisé"}
    </button>
  );

  return (
    <div data-buy-anchor>
      <div className="pdp__price" aria-live="polite">
        {selected.salePrice !== null && <s>{formatPrice(selected.price)}</s>}
        <span>{formatPrice(selected.effectivePrice)}</span>
      </div>
      <p className="pdp__per">
        {per100 ? `Soit ${formatPrice(per100)} les 100 ml · ` : ""}
        TVA incluse, livraison calculée à l&apos;étape suivante.
      </p>

      {variants.length > 1 && (
        <fieldset className="sizes" style={{ border: 0, padding: 0, margin: "0 0 1.5rem" }}>
          <legend className="sizes__legend">Contenance</legend>
          {variants.map((v) => (
            <div key={v.id} className={`size${v.available ? "" : " size--soldout"}`}>
              <input type="radio" id={`v-${v.id}`} name="variant" value={v.id} checked={v.id === selected.id} onChange={() => setSelectedId(v.id)} />
              <label htmlFor={`v-${v.id}`}>
                <b>{v.label}</b>
                <small>{v.available ? formatPrice(v.effectivePrice) : "Épuisé"}</small>
              </label>
            </div>
          ))}
        </fieldset>
      )}

      <p className={`pdp__stock${!selected.available ? " pdp__stock--out" : selected.lowStock ? " pdp__stock--low" : ""}`}>
        {!selected.available ? "Cette contenance est épuisée." : selected.lowStock ? `Plus que ${selected.stock} en stock` : "En stock, expédié sous 24 à 48 h"}
      </p>

      <div className="buy-row">
        <div className="qty qty--lg" aria-label="Quantité">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuer la quantité">
            <Icon name="minus" />
          </button>
          <input type="number" value={qty} min={1} max={Math.min(10, selected.stock || 1)} onChange={(e) => setQty(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} aria-label="Quantité" />
          <button type="button" onClick={() => setQty((q) => Math.min(10, selected.stock, q + 1))} aria-label="Augmenter la quantité" disabled={qty >= Math.min(10, selected.stock)}>
            <Icon name="plus" />
          </button>
        </div>
        {buyButton()}
      </div>
      {error && (
        <p className="alert alert--error" role="alert">
          {error}
        </p>
      )}

      <div className={`sticky-buy${stickyVisible ? " is-visible" : ""}`} aria-hidden={!stickyVisible}>
        <div>
          <div className="sticky-buy__name">{productName}</div>
          <div className="sticky-buy__price">
            {selected.label} · {formatPrice(selected.effectivePrice)}
          </div>
        </div>
        {buyButton(false)}
      </div>
    </div>
  );
}
