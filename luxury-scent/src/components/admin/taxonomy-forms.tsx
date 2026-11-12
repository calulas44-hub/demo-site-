"use client";

import { ActionForm } from "@/components/action-form";

import { useActionState } from "react";
import { saveBrandAction, saveCategoryAction, saveCollectionAction } from "@/lib/admin-actions/catalog";
import type { FormState } from "@/lib/shop-actions";
import { RichEditor } from "./rich-editor";
import { Msg, SubmitButton } from "./ui";

const init: FormState = { ok: false, message: "" };

export function CategoryForm({ category, parents }: { category?: { id: string; name: string; slug: string; description: string | null; parentId: string | null; position: number; active: boolean; showInMenu: boolean; imageUrl: string | null; seoTitle: string | null; seoDescription: string | null }; parents: { id: string; name: string }[] }) {
  const [state, action] = useActionState(saveCategoryAction, init);
  return (
    <ActionForm action={action} className="panel">
      <h2>{category ? `Modifier « ${category.name} »` : "Nouvelle catégorie"}</h2>
      <Msg state={state} />
      {category && <input type="hidden" name="id" value={category.id} />}
      <div className="f-row">
        <div className="f">
          <label>Nom *</label>
          <input name="name" defaultValue={category?.name ?? ""} required />
        </div>
        <div className="f">
          <label>Catégorie parente</label>
          <select name="parentId" defaultValue={category?.parentId ?? ""}>
            <option value="">— Aucune (niveau principal)</option>
            {parents
              .filter((p) => p.id !== category?.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div className="f">
        <label>Description (texte d&apos;introduction de la page)</label>
        <textarea name="description" defaultValue={category?.description ?? ""} style={{ minHeight: "4rem" }} />
      </div>
      <div className="f">
        <label>Image (bandeau et tuile d&apos;accueil)</label>
        {category?.imageUrl && (
          <div className="img-preview">
            <img src={category.imageUrl} alt="" />
          </div>
        )}
        <input type="file" name="image" accept="image/*" />
      </div>
      <div className="f-row f-row--3">
        <div className="f">
          <label>Ordre</label>
          <input name="position" type="number" defaultValue={category?.position ?? 0} />
        </div>
        <div className="f">
          <label>Slug</label>
          <input name="slug" defaultValue={category?.slug ?? ""} placeholder="automatique" />
        </div>
        <div className="f">
          <label>Titre SEO</label>
          <input name="seoTitle" defaultValue={category?.seoTitle ?? ""} />
        </div>
      </div>
      <div className="f">
        <label>Description SEO</label>
        <input name="seoDescription" defaultValue={category?.seoDescription ?? ""} />
      </div>
      <label className="f-check">
        <input type="checkbox" name="active" defaultChecked={category?.active ?? true} /> Active
      </label>
      <label className="f-check">
        <input type="checkbox" name="showInMenu" defaultChecked={category?.showInMenu ?? true} /> Afficher dans le menu
      </label>
      <SubmitButton>{category ? "Enregistrer" : "Créer la catégorie"}</SubmitButton>
    </ActionForm>
  );
}

export function BrandForm({ brand }: { brand?: { id: string; name: string; slug: string; description: string | null; position: number; active: boolean } }) {
  const [state, action] = useActionState(saveBrandAction, init);
  return (
    <ActionForm action={action} className="panel">
      <h2>{brand ? `Modifier « ${brand.name} »` : "Nouvelle marque"}</h2>
      <Msg state={state} />
      {brand && <input type="hidden" name="id" value={brand.id} />}
      <div className="f-row">
        <div className="f">
          <label>Nom *</label>
          <input name="name" defaultValue={brand?.name ?? ""} required />
        </div>
        <div className="f">
          <label>Slug</label>
          <input name="slug" defaultValue={brand?.slug ?? ""} placeholder="automatique" />
        </div>
      </div>
      <div className="f">
        <label>Description</label>
        <textarea name="description" defaultValue={brand?.description ?? ""} style={{ minHeight: "4rem" }} />
      </div>
      <div className="f">
        <label>Ordre</label>
        <input name="position" type="number" defaultValue={brand?.position ?? 0} />
      </div>
      <label className="f-check">
        <input type="checkbox" name="active" defaultChecked={brand?.active ?? true} /> Active
      </label>
      <SubmitButton>{brand ? "Enregistrer" : "Créer la marque"}</SubmitButton>
    </ActionForm>
  );
}

export function CollectionForm({ collection }: { collection?: { id: string; name: string; slug: string; tagline: string | null; description: string | null; position: number; active: boolean; imageUrl: string | null; heroImageUrl: string | null } }) {
  const [state, action] = useActionState(saveCollectionAction, init);
  return (
    <ActionForm action={action} className="panel">
      <h2>{collection ? `Modifier « ${collection.name} »` : "Nouvelle collection"}</h2>
      <Msg state={state} />
      {collection && <input type="hidden" name="id" value={collection.id} />}
      <div className="f-row">
        <div className="f">
          <label>Nom *</label>
          <input name="name" defaultValue={collection?.name ?? ""} required />
        </div>
        <div className="f">
          <label>Accroche (sous le nom)</label>
          <input name="tagline" defaultValue={collection?.tagline ?? ""} />
        </div>
      </div>
      <RichEditor name="description" label="Texte de présentation" initialHtml={collection?.description} />
      <div className="f-row">
        <div className="f">
          <label>Image de tuile (carrée ou portrait)</label>
          {collection?.imageUrl && (
            <div className="img-preview">
              <img src={collection.imageUrl} alt="" />
            </div>
          )}
          <input type="file" name="image" accept="image/*" />
        </div>
        <div className="f">
          <label>Image de bandeau (large)</label>
          {collection?.heroImageUrl && (
            <div className="img-preview">
              <img src={collection.heroImageUrl} alt="" />
            </div>
          )}
          <input type="file" name="heroImage" accept="image/*" />
        </div>
      </div>
      <div className="f-row">
        <div className="f">
          <label>Ordre</label>
          <input name="position" type="number" defaultValue={collection?.position ?? 0} />
        </div>
        <div className="f">
          <label>Slug</label>
          <input name="slug" defaultValue={collection?.slug ?? ""} placeholder="automatique" />
        </div>
      </div>
      <label className="f-check">
        <input type="checkbox" name="active" defaultChecked={collection?.active ?? true} /> Active
      </label>
      <SubmitButton>{collection ? "Enregistrer" : "Créer la collection"}</SubmitButton>
    </ActionForm>
  );
}
