"use client";

import { ActionForm } from "@/components/action-form";

import { useActionState } from "react";
import { saveSettingsAction } from "@/lib/admin-actions/settings";
import type { FormState } from "@/lib/shop-actions";
import type { SiteSettings } from "@/lib/settings";
import { centsToEurosInput } from "@/lib/money";
import { Msg, SubmitButton } from "./ui";

const ICONS = [
  ["truck", "Livraison"],
  ["gift", "Cadeau"],
  ["shield", "Sécurité"],
  ["chat", "Conseil"],
  ["flask", "Flacon"],
  ["heart", "Cœur"],
  ["check", "Coche"],
  ["lock", "Cadenas"],
];

export function SettingsForm({ s }: { s: SiteSettings }) {
  const [state, action] = useActionState(saveSettingsAction, { ok: false, message: "" } as FormState);
  const reassurance = [...s.reassurance, { icon: "check", title: "", text: "" }, { icon: "check", title: "", text: "" }, { icon: "check", title: "", text: "" }, { icon: "check", title: "", text: "" }].slice(0, 4);
  return (
    <ActionForm action={action}>
      <Msg state={state} />
      <div className="grid-2">
        <div className="panel">
          <h2>Identité</h2>
          <div className="f">
            <label>Nom commercial *</label>
            <input name="brandName" defaultValue={s.brandName} required />
          </div>
          <div className="f">
            <label>Signature (sous le nom, sur les factures)</label>
            <input name="tagline" defaultValue={s.tagline} />
          </div>
          <div className="f">
            <label>Logo (PNG ou SVG converti, fond transparent conseillé)</label>
            {s.logoUrl && (
              <div className="img-preview">
                <img src={s.logoUrl} alt="" />
                <label className="f-check" style={{ margin: 0 }}>
                  <input type="checkbox" name="removeLogo" /> Retirer (le nom en toutes lettres sera affiché)
                </label>
              </div>
            )}
            <input type="file" name="logo" accept="image/*" />
          </div>
          <div className="f">
            <label>Favicon (carré)</label>
            <input type="file" name="favicon" accept="image/*" />
          </div>
          <div className="f-row f-row--3">
            <div className="f">
              <label>Instagram</label>
              <input name="instagram" defaultValue={s.instagram} placeholder="https://instagram.com/…" />
            </div>
            <div className="f">
              <label>Facebook</label>
              <input name="facebook" defaultValue={s.facebook} />
            </div>
            <div className="f">
              <label>TikTok</label>
              <input name="tiktok" defaultValue={s.tiktok} />
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>Coordonnées</h2>
          <div className="f-row">
            <div className="f">
              <label>E-mail de contact *</label>
              <input name="contactEmail" type="email" defaultValue={s.contactEmail} required />
            </div>
            <div className="f">
              <label>Téléphone</label>
              <input name="contactPhone" defaultValue={s.contactPhone} />
            </div>
          </div>
          <div className="f">
            <label>Adresse de l&apos;entreprise</label>
            <textarea name="address" defaultValue={s.address} style={{ minHeight: "4.5rem" }} />
          </div>
          <div className="f">
            <label>Horaires</label>
            <input name="openingHours" defaultValue={s.openingHours} />
          </div>
        </div>

        <div className="panel">
          <h2>Informations légales et fiscales</h2>
          <div className="f-row">
            <div className="f">
              <label>Raison sociale</label>
              <input name="companyLegalName" defaultValue={s.companyLegalName} />
            </div>
            <div className="f">
              <label>Forme juridique</label>
              <input name="companyForm" defaultValue={s.companyForm} placeholder="SAS, SARL, EI…" />
            </div>
          </div>
          <div className="f-row">
            <div className="f">
              <label>SIRET</label>
              <input name="siret" defaultValue={s.siret} />
            </div>
            <div className="f">
              <label>N° TVA intracommunautaire</label>
              <input name="vatNumber" defaultValue={s.vatNumber} />
            </div>
          </div>
          <div className="f-row">
            <div className="f">
              <label>Capital social</label>
              <input name="shareCapital" defaultValue={s.shareCapital} placeholder="10 000 €" />
            </div>
            <div className="f">
              <label>RCS</label>
              <input name="rcs" defaultValue={s.rcs} placeholder="Paris 123 456 789" />
            </div>
          </div>
          <div className="f-row">
            <div className="f">
              <label>Taux de TVA par défaut (%) *</label>
              <input name="vatRate" inputMode="decimal" defaultValue={s.vatRate} required />
              <span className="hint">Appliqué aux produits sans taux spécifique et aux frais de port.</span>
            </div>
            <div className="f">
              <label>Mention en bas de facture</label>
              <input name="invoiceFooter" defaultValue={s.invoiceFooter} />
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>Livraison et réassurance</h2>
          <div className="f">
            <label>Texte « Livraison » affiché sur les fiches produit</label>
            <textarea name="shippingInfo" defaultValue={s.shippingInfo} style={{ minHeight: "4rem" }} />
          </div>
          <div className="f">
            <label>Seuil de livraison offerte (€, vide = aucun message)</label>
            <input name="freeShippingThreshold" inputMode="decimal" defaultValue={centsToEurosInput(s.freeShippingThreshold)} />
            <span className="hint">Affiche la barre de progression dans le panier. Les frais réels se règlent dans « Livraison ».</span>
          </div>
          <h3>Arguments de réassurance (accueil, fiche produit)</h3>
          {reassurance.map((r, i) => (
            <div key={i} className="f-row f-row--3">
              <div className="f">
                <label>Icône</label>
                <select name={`reassurance[${i}][icon]`} defaultValue={r.icon}>
                  {ICONS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="f">
                <label>Titre</label>
                <input name={`reassurance[${i}][title]`} defaultValue={r.title} />
              </div>
              <div className="f">
                <label>Texte</label>
                <input name={`reassurance[${i}][text]`} defaultValue={r.text} />
              </div>
            </div>
          ))}
        </div>

        <div className="panel span-2">
          <h2>Référencement</h2>
          <div className="f">
            <label>Titre du site (onglet, moteurs de recherche)</label>
            <input name="seoTitle" defaultValue={s.seoTitle} />
          </div>
          <div className="f">
            <label>Description du site</label>
            <textarea name="seoDescription" defaultValue={s.seoDescription} style={{ minHeight: "3.5rem" }} />
          </div>
          <SubmitButton>Enregistrer les paramètres</SubmitButton>
        </div>
      </div>
    </ActionForm>
  );
}
