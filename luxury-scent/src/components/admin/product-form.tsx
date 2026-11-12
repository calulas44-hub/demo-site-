"use client";

import { ActionForm } from "@/components/action-form";

import { useActionState, useState } from "react";
import { saveProductAction } from "@/lib/admin-actions/catalog";
import type { FormState } from "@/lib/shop-actions";
import { GENDER_LABELS, PRODUCT_STATUS_LABELS } from "@/lib/constants";
import { centsToEurosInput } from "@/lib/money";
import { RichEditor } from "./rich-editor";
import { Msg, SubmitButton } from "./ui";

export interface VariantRow {
  id?: string;
  label: string;
  volumeMl: number | null;
  sku: string | null;
  price: number;
  salePrice: number | null;
  costPrice: number | null;
  stock: number;
  lowStockThreshold: number;
  active: boolean;
}

export interface ProductFormData {
  id?: string;
  name: string;
  slug: string;
  subtitle: string | null;
  brandId: string | null;
  categoryId: string | null;
  collectionId: string | null;
  shortDescription: string | null;
  description: string | null;
  inspiration: string | null;
  notesTop: string | null;
  notesHeart: string | null;
  notesBase: string | null;
  families: string | null;
  gender: string;
  status: string;
  featured: boolean;
  isNew: boolean;
  isLimited: boolean;
  vatRate: number | null;
  position: number;
  seoTitle: string | null;
  seoDescription: string | null;
  variants: VariantRow[];
}

interface Option {
  id: string;
  name: string;
  indent?: boolean;
}

const EMPTY_VARIANT: VariantRow = { label: "", volumeMl: null, sku: null, price: 0, salePrice: null, costPrice: null, stock: 0, lowStockThreshold: 3, active: true };

export function ProductForm({ product, brands, categories, collections }: { product?: ProductFormData; brands: Option[]; categories: Option[]; collections: Option[] }) {
  const [state, action] = useActionState(saveProductAction, { ok: false, message: "" } as FormState);
  const [variants, setVariants] = useState<VariantRow[]>(product?.variants.length ? product.variants : [{ ...EMPTY_VARIANT, label: "50 ml", volumeMl: 50 }]);
  const p = product;

  return (
    <ActionForm action={action}>
      {p?.id && <input type="hidden" name="id" value={p.id} />}
      <Msg state={state} />
      <div className="grid-side">
        <div>
          <div className="panel">
            <h2>Informations</h2>
            <div className="f-row">
              <div className="f">
                <label htmlFor="name">Nom du parfum *</label>
                <input id="name" name="name" defaultValue={p?.name ?? ""} required />
              </div>
              <div className="f">
                <label htmlFor="subtitle">Type (eau de parfum, extrait…)</label>
                <input id="subtitle" name="subtitle" defaultValue={p?.subtitle ?? ""} placeholder="Eau de parfum" />
              </div>
            </div>
            <div className="f-row f-row--3">
              <div className="f">
                <label htmlFor="brandId">Marque</label>
                <select id="brandId" name="brandId" defaultValue={p?.brandId ?? ""}>
                  <option value="">—</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="f">
                <label htmlFor="categoryId">Catégorie</label>
                <select id="categoryId" name="categoryId" defaultValue={p?.categoryId ?? ""}>
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.indent ? "— " : ""}
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="f">
                <label htmlFor="collectionId">Collection</label>
                <select id="collectionId" name="collectionId" defaultValue={p?.collectionId ?? ""}>
                  <option value="">—</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="f">
              <label htmlFor="shortDescription">Accroche (une phrase, affichée sous le nom)</label>
              <input id="shortDescription" name="shortDescription" defaultValue={p?.shortDescription ?? ""} maxLength={300} />
            </div>
            <RichEditor name="description" label="Description" initialHtml={p?.description} />
            <RichEditor name="inspiration" label="L'inspiration (texte éditorial, facultatif)" initialHtml={p?.inspiration} />
          </div>

          <div className="panel">
            <h2>Olfactif</h2>
            <div className="f">
              <label htmlFor="families">Familles olfactives (séparées par des virgules)</label>
              <input id="families" name="families" defaultValue={p?.families ?? ""} placeholder="Ambrée, Boisée, Florale" />
              <span className="hint">Utilisées pour les filtres du catalogue et affichées sur les cartes.</span>
            </div>
            <div className="f-row f-row--3">
              <div className="f">
                <label htmlFor="notesTop">Notes de tête</label>
                <input id="notesTop" name="notesTop" defaultValue={p?.notesTop ?? ""} />
              </div>
              <div className="f">
                <label htmlFor="notesHeart">Notes de cœur</label>
                <input id="notesHeart" name="notesHeart" defaultValue={p?.notesHeart ?? ""} />
              </div>
              <div className="f">
                <label htmlFor="notesBase">Notes de fond</label>
                <input id="notesBase" name="notesBase" defaultValue={p?.notesBase ?? ""} />
              </div>
            </div>
            <div className="f">
              <label htmlFor="gender">Pour</label>
              <select id="gender" name="gender" defaultValue={p?.gender ?? "MIXTE"}>
                {Object.entries(GENDER_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="panel">
            <h2>Contenances, prix et stock</h2>
            <p className="muted small">Prix TTC en euros. Le prix promotionnel remplace le prix s&apos;il est renseigné et inférieur. Le coût d&apos;achat (HT) sert au calcul des marges.</p>
            <div className="tbl-wrap">
              <table className="variants">
                <thead>
                  <tr>
                    <th>Contenance *</th>
                    <th>ml</th>
                    <th>Référence</th>
                    <th>Prix *</th>
                    <th>Promo</th>
                    <th>Coût HT</th>
                    <th>Stock</th>
                    <th>Alerte</th>
                    <th>Actif</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v, i) => (
                    <tr key={v.id ?? `new-${i}`}>
                      <td>
                        {v.id && <input type="hidden" name={`variants[${i}][id]`} value={v.id} />}
                        <input name={`variants[${i}][label]`} defaultValue={v.label} placeholder="50 ml" required />
                      </td>
                      <td>
                        <input name={`variants[${i}][volumeMl]`} defaultValue={v.volumeMl ?? ""} inputMode="decimal" style={{ minWidth: "3.5rem" }} />
                      </td>
                      <td>
                        <input name={`variants[${i}][sku]`} defaultValue={v.sku ?? ""} />
                      </td>
                      <td>
                        <input name={`variants[${i}][price]`} defaultValue={v.id ? centsToEurosInput(v.price) : ""} inputMode="decimal" required />
                      </td>
                      <td>
                        <input name={`variants[${i}][salePrice]`} defaultValue={centsToEurosInput(v.salePrice)} inputMode="decimal" />
                      </td>
                      <td>
                        <input name={`variants[${i}][costPrice]`} defaultValue={centsToEurosInput(v.costPrice)} inputMode="decimal" />
                      </td>
                      <td>
                        <input name={`variants[${i}][stock]`} type="number" min={0} defaultValue={v.stock} style={{ minWidth: "3.5rem" }} />
                      </td>
                      <td>
                        <input name={`variants[${i}][lowStockThreshold]`} type="number" min={0} defaultValue={v.lowStockThreshold} style={{ minWidth: "3.5rem" }} />
                      </td>
                      <td>
                        <input type="checkbox" name={`variants[${i}][active]`} defaultChecked={v.active} />
                      </td>
                      <td>
                        <button type="button" className="btn-a btn-a--danger btn-a--sm" onClick={() => setVariants((list) => list.filter((_, j) => j !== i))} aria-label="Retirer cette contenance">
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn-a btn-a--ghost btn-a--sm mt" onClick={() => setVariants((list) => [...list, { ...EMPTY_VARIANT }])}>
              + Ajouter une contenance
            </button>
          </div>

          <div className="panel">
            <h2>Référencement</h2>
            <div className="f">
              <label htmlFor="slug">Adresse de la page (slug)</label>
              <input id="slug" name="slug" defaultValue={p?.slug ?? ""} placeholder="généré automatiquement" />
            </div>
            <div className="f">
              <label htmlFor="seoTitle">Titre pour les moteurs de recherche</label>
              <input id="seoTitle" name="seoTitle" defaultValue={p?.seoTitle ?? ""} maxLength={120} />
            </div>
            <div className="f">
              <label htmlFor="seoDescription">Description pour les moteurs de recherche</label>
              <textarea id="seoDescription" name="seoDescription" defaultValue={p?.seoDescription ?? ""} maxLength={300} style={{ minHeight: "4rem" }} />
            </div>
          </div>
        </div>

        <div>
          <div className="panel">
            <h2>Publication</h2>
            <div className="f">
              <label htmlFor="status">Statut</label>
              <select id="status" name="status" defaultValue={p?.status ?? "DRAFT"}>
                {Object.entries(PRODUCT_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <span className="hint">Seuls les produits « En ligne » sont visibles sur le site.</span>
            </div>
            <label className="f-check">
              <input type="checkbox" name="featured" defaultChecked={p?.featured ?? false} /> Mettre en avant sur l&apos;accueil
            </label>
            <label className="f-check">
              <input type="checkbox" name="isNew" defaultChecked={p?.isNew ?? false} /> Badge « Nouveauté »
            </label>
            <label className="f-check">
              <input type="checkbox" name="isLimited" defaultChecked={p?.isLimited ?? false} /> Badge « Édition limitée »
            </label>
            <div className="f-row">
              <div className="f">
                <label htmlFor="position">Ordre d&apos;affichage</label>
                <input id="position" name="position" type="number" defaultValue={p?.position ?? 0} />
              </div>
              <div className="f">
                <label htmlFor="vatRate">TVA (%) — vide = taux global</label>
                <input id="vatRate" name="vatRate" defaultValue={p?.vatRate ?? ""} inputMode="decimal" />
              </div>
            </div>
            <SubmitButton className="btn-a" style={{ width: "100%" }}>
              {p?.id ? "Enregistrer les modifications" : "Créer le produit"}
            </SubmitButton>
          </div>
        </div>
      </div>
    </ActionForm>
  );
}
