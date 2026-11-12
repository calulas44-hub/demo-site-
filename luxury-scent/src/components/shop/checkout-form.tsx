"use client";

import { ActionForm } from "@/components/action-form";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { placeOrderAction } from "@/lib/checkout-actions";
import type { FormState } from "@/lib/shop-actions";
import { COUNTRIES } from "@/lib/constants";
import { formatPrice } from "@/lib/money";
import { Icon } from "./icon";

interface Method {
  id: string;
  name: string;
  description: string | null;
  price: number;
  freeAbove: number | null;
  estimatedDays: string | null;
  countries: string;
}
interface Addr {
  id: string;
  label: string | null;
  firstName: string;
  lastName: string;
  company: string | null;
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  country: string;
  phone: string | null;
}
interface Props {
  cart: { lines: { variantId: string; name: string; variantLabel: string; imageUrl: string | null; quantity: number; total: number }[]; subtotal: number };
  methods: Method[];
  customer: { email: string; firstName: string; lastName: string; phone: string | null } | null;
  addresses: Addr[];
  cardEnabled: boolean;
}

const initial: FormState = { ok: false, message: "" };

function AddressFields({ prefix, defaults, onCountryChange }: { prefix: string; defaults?: Partial<Addr>; onCountryChange?: (c: string) => void }) {
  return (
    <>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${prefix}-firstName`}>Prénom</label>
          <input id={`${prefix}-firstName`} name={`${prefix}.firstName`} defaultValue={defaults?.firstName ?? ""} autoComplete="given-name" required />
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-lastName`}>Nom</label>
          <input id={`${prefix}-lastName`} name={`${prefix}.lastName`} defaultValue={defaults?.lastName ?? ""} autoComplete="family-name" required />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-company`}>Société (facultatif)</label>
        <input id={`${prefix}-company`} name={`${prefix}.company`} defaultValue={defaults?.company ?? ""} autoComplete="organization" />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-line1`}>Adresse</label>
        <input id={`${prefix}-line1`} name={`${prefix}.line1`} defaultValue={defaults?.line1 ?? ""} autoComplete="address-line1" required />
      </div>
      <div className="field">
        <label htmlFor={`${prefix}-line2`}>Complément (facultatif)</label>
        <input id={`${prefix}-line2`} name={`${prefix}.line2`} defaultValue={defaults?.line2 ?? ""} autoComplete="address-line2" />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${prefix}-postalCode`}>Code postal</label>
          <input id={`${prefix}-postalCode`} name={`${prefix}.postalCode`} defaultValue={defaults?.postalCode ?? ""} autoComplete="postal-code" required />
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-city`}>Ville</label>
          <input id={`${prefix}-city`} name={`${prefix}.city`} defaultValue={defaults?.city ?? ""} autoComplete="address-level2" required />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${prefix}-country`}>Pays</label>
          <select id={`${prefix}-country`} name={`${prefix}.country`} defaultValue={defaults?.country ?? "FR"} onChange={(e) => onCountryChange?.(e.target.value)} autoComplete="country">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-phone`}>Téléphone</label>
          <input id={`${prefix}-phone`} name={`${prefix}.phone`} defaultValue={defaults?.phone ?? ""} autoComplete="tel" type="tel" />
        </div>
      </div>
    </>
  );
}

export function CheckoutForm({ cart, methods, customer, addresses, cardEnabled }: Props) {
  const [state, action, pending] = useActionState(placeOrderAction, initial);
  const [country, setCountry] = useState(addresses[0]?.country ?? "FR");
  const [billingSame, setBillingSame] = useState(true);
  const [createAccount, setCreateAccount] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string>(addresses[0]?.id ?? "new");
  const [methodId, setMethodId] = useState<string>("");

  const available = useMemo(() => {
    const list = methods.filter((m) => {
      const cs = m.countries.split(",").map((c) => c.trim().toUpperCase());
      return cs.includes("*") || cs.includes(country.toUpperCase());
    });
    return list.map((m) => ({ ...m, computed: m.freeAbove !== null && cart.subtotal >= m.freeAbove ? 0 : m.price }));
  }, [methods, country, cart.subtotal]);

  const chosen = available.find((m) => m.id === methodId) ?? available[0];
  const shippingPrice = chosen?.computed ?? 0;
  const addr = addresses.find((a) => a.id === selectedAddress);

  return (
    <ActionForm action={action} className="checkout" noValidate>
      <div>
        {state.message && !state.ok && (
          <p className="alert alert--error" role="alert">
            {state.message}
          </p>
        )}

        <section className="checkout__step">
          <h2>
            <span>1</span>Coordonnées
          </h2>
          <div className="field">
            <label htmlFor="email">Adresse e-mail</label>
            <input id="email" name="email" type="email" defaultValue={customer?.email ?? ""} autoComplete="email" required readOnly={Boolean(customer)} />
            <span className="hint">Votre confirmation de commande sera envoyée à cette adresse.</span>
          </div>
          {!customer && (
            <p className="small muted">
              Déjà cliente ou client ?{" "}
              <Link href="/compte/connexion?retour=/commande" style={{ textDecoration: "underline" }}>
                Se connecter
              </Link>
            </p>
          )}
        </section>

        <section className="checkout__step">
          <h2>
            <span>2</span>Adresse de livraison
          </h2>
          {addresses.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              {addresses.map((a) => (
                <label key={a.id} className="option">
                  <input type="radio" name="savedAddress" value={a.id} checked={selectedAddress === a.id} onChange={() => { setSelectedAddress(a.id); setCountry(a.country); }} />
                  <span className="option__body">
                    <span className="option__title">{a.label ?? `${a.firstName} ${a.lastName}`}</span>
                    <span className="option__desc">
                      {a.line1}, {a.postalCode} {a.city}
                    </span>
                  </span>
                </label>
              ))}
              <label className="option">
                <input type="radio" name="savedAddress" value="new" checked={selectedAddress === "new"} onChange={() => setSelectedAddress("new")} />
                <span className="option__body">
                  <span className="option__title">Nouvelle adresse</span>
                </span>
              </label>
            </div>
          )}
          <AddressFields key={selectedAddress} prefix="shipping" defaults={addr ?? { firstName: customer?.firstName, lastName: customer?.lastName, phone: customer?.phone, country: "FR" }} onCountryChange={setCountry} />
          <label className="check">
            <input type="checkbox" name="billingSame" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} />
            <span>Utiliser la même adresse pour la facturation</span>
          </label>
          {!billingSame && (
            <div style={{ marginTop: "1.2rem" }}>
              <p className="caps" style={{ marginBottom: ".8rem" }}>
                Adresse de facturation
              </p>
              <AddressFields prefix="billing" defaults={{ country: "FR" }} />
            </div>
          )}
        </section>

        <section className="checkout__step">
          <h2>
            <span>3</span>Livraison
          </h2>
          {available.length === 0 ? (
            <p className="alert alert--error">Aucun mode de livraison n&apos;est disponible pour ce pays. Contactez-nous.</p>
          ) : (
            available.map((m) => (
              <label key={m.id} className="option">
                <input type="radio" name="shippingMethodId" value={m.id} checked={(chosen?.id ?? "") === m.id} onChange={() => setMethodId(m.id)} />
                <span className="option__body">
                  <span className="option__title">
                    <span>{m.name}</span>
                    <span>{m.computed === 0 ? "Offerte" : formatPrice(m.computed)}</span>
                  </span>
                  <span className="option__desc">
                    {m.description}
                    {m.estimatedDays ? ` · ${m.estimatedDays}` : ""}
                  </span>
                </span>
              </label>
            ))
          )}
        </section>

        <section className="checkout__step">
          <h2>
            <span>4</span>Paiement
          </h2>
          {cardEnabled && (
            <label className="option">
              <input type="radio" name="paymentMethod" value="CARD" defaultChecked />
              <span className="option__body">
                <span className="option__title">Carte bancaire</span>
                <span className="option__desc">Paiement sécurisé sur la page de notre prestataire (Stripe). Vos données de carte ne transitent jamais par nos serveurs.</span>
              </span>
            </label>
          )}
          <label className="option">
            <input type="radio" name="paymentMethod" value="BANK_TRANSFER" defaultChecked={!cardEnabled} />
            <span className="option__body">
              <span className="option__title">Virement bancaire</span>
              <span className="option__desc">Nos coordonnées bancaires vous sont communiquées à l&apos;étape suivante. Votre commande est expédiée dès réception du virement.</span>
            </span>
          </label>
          {!cardEnabled && <p className="small muted">Le paiement par carte sera proposé dès l&apos;activation du prestataire de paiement.</p>}
        </section>

        <section className="checkout__step">
          <div className="field">
            <label htmlFor="customerNote">Message pour la commande (facultatif)</label>
            <textarea id="customerNote" name="customerNote" rows={3} placeholder="Un mot pour l'emballage cadeau, une consigne de livraison…" />
          </div>
          {!customer && (
            <>
              <label className="check">
                <input type="checkbox" name="createAccount" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} />
                <span>Créer un compte pour suivre mes commandes</span>
              </label>
              {createAccount && (
                <div className="field" style={{ marginTop: "1rem" }}>
                  <label htmlFor="password">Mot de passe (10 caractères minimum)</label>
                  <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} />
                </div>
              )}
            </>
          )}
          <label className="check" style={{ marginTop: "1rem" }}>
            <input type="checkbox" name="acceptTerms" required />
            <span>
              J&apos;ai lu et j&apos;accepte les{" "}
              <Link href="/pages/conditions-generales-de-vente" target="_blank" style={{ textDecoration: "underline" }}>
                conditions générales de vente
              </Link>
              .
            </span>
          </label>
        </section>
      </div>

      <aside className="summary checkout__summary">
        <h3>Votre commande</h3>
        <div className="mini-lines">
          {cart.lines.map((l) => (
            <div key={l.variantId} className="mini-line">
              {l.imageUrl ? <img src={l.imageUrl} alt="" /> : <span />}
              <span>
                {l.name}
                <br />
                <span className="muted small">
                  {l.variantLabel} × {l.quantity}
                </span>
              </span>
              <span>{formatPrice(l.total)}</span>
            </div>
          ))}
        </div>
        <div className="summary__row">
          <span>Sous-total</span>
          <span>{formatPrice(cart.subtotal)}</span>
        </div>
        <div className="summary__row">
          <span>Livraison</span>
          <span>{chosen ? (shippingPrice === 0 ? "Offerte" : formatPrice(shippingPrice)) : "—"}</span>
        </div>
        <div className="summary__row summary__row--total">
          <span>Total TTC</span>
          <strong>{formatPrice(cart.subtotal + shippingPrice)}</strong>
        </div>
        <button type="submit" className="btn btn--block" disabled={pending || available.length === 0}>
          {pending ? "Validation…" : "Confirmer la commande"}
        </button>
        <ul className="perks">
          <li>
            <Icon name="lock" /> Paiement sécurisé
          </li>
          <li>
            <Icon name="truck" /> Expédition sous 24 à 48 h
          </li>
        </ul>
      </aside>
    </ActionForm>
  );
}
