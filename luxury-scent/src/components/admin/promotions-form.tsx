"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { savePromotionsAction } from "@/lib/admin-actions/promotions";
import type { FormState } from "@/lib/shop-actions";
import { centsToEurosInput, formatPrice } from "@/lib/money";
import { Msg, SubmitButton } from "./ui";

interface Props {
  settings: { upsellEnabled: boolean; upsellRate: number; upsellMaxPrice: number; upsellTitle: string; upsellText: string; bankTransferEnabled: boolean };
  products: { id: string; name: string; subtitle: string | null; minPrice: number; upsellEligible: boolean; status: string }[];
  stripeReady: boolean;
}

export function PromotionsForm({ settings: s, products, stripeReady }: Props) {
  const [state, action] = useActionState(savePromotionsAction, { ok: false, message: "" } as FormState);
  return (
    <ActionForm action={action}>
      <Msg state={state} />
      <div className="panel">
        <h2>Offre « 2e parfum »</h2>
        <p className="small">
          Dès que le panier contient deux parfums éligibles, une unité du parfum éligible le moins cher dont le prix est inférieur ou égal au seuil reçoit la remise. Un article déjà en promotion (prix barré) n&apos;est jamais remisé une seconde fois. Le calcul est refait par le serveur à chaque étape, jusqu&apos;au paiement Stripe.
        </p>
        <label className="f-check">
          <input type="checkbox" name="upsellEnabled" defaultChecked={s.upsellEnabled} /> Offre active
        </label>
        <div className="f-row">
          <div className="f">
            <label>Remise (%)</label>
            <input name="upsellRate" type="number" min={1} max={90} defaultValue={s.upsellRate} required />
          </div>
          <div className="f">
            <label>Prix maximal du parfum remisé (€ TTC)</label>
            <input name="upsellMaxPrice" inputMode="decimal" defaultValue={centsToEurosInput(s.upsellMaxPrice)} required />
            <span className="hint">Ex. 100 : seul un parfum à 100 € ou moins peut être remisé.</span>
          </div>
        </div>
        <div className="f">
          <label>Titre affiché dans le panier</label>
          <input name="upsellTitle" maxLength={80} defaultValue={s.upsellTitle} required />
        </div>
        <div className="f">
          <label>Texte affiché dans le panier</label>
          <input name="upsellText" maxLength={240} defaultValue={s.upsellText} />
        </div>
        <p className="small">
          Exemple avec les réglages actuels : 150 € + 85 € → remise de {formatPrice(Math.round((8500 * s.upsellRate) / 100))} sur le parfum à 85 € (si 85 € ≤ seuil).
        </p>
      </div>

      <div className="panel">
        <h2>Parfums éligibles</h2>
        <p className="small">Décochez les produits qui ne sont pas des parfums (bougies, soins…) ou que vous ne souhaitez pas inclure.</p>
        <div className="checklist">
          {products.map((p) => (
            <label key={p.id} className="f-check">
              <input type="hidden" name="listed" value={p.id} />
              <input type="checkbox" name="eligible" value={p.id} defaultChecked={p.upsellEligible} /> {p.name}
              {p.subtitle ? ` — ${p.subtitle}` : ""} <span className="small">(dès {formatPrice(p.minPrice)}{p.status !== "ACTIVE" ? ", hors ligne" : ""})</span>
            </label>
          ))}
          {products.length === 0 && <p className="small">Aucun produit.</p>}
        </div>
      </div>

      <div className="panel">
        <h2>Moyens de paiement</h2>
        <p className="small">
          Carte bancaire et Apple Pay (Stripe) : {stripeReady ? <strong>activé</strong> : <strong>non configuré — ajoutez les clés Stripe dans Netlify (voir la documentation)</strong>}.
        </p>
        <label className="f-check">
          <input type="checkbox" name="bankTransferEnabled" defaultChecked={s.bankTransferEnabled} /> Proposer le virement bancaire (sinon affiché « Bientôt disponible »)
        </label>
      </div>
      <SubmitButton>Enregistrer</SubmitButton>
    </ActionForm>
  );
}
