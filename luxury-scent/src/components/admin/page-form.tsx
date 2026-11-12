"use client";

import { ActionForm } from "@/components/action-form";

import { useActionState } from "react";
import { savePageAction } from "@/lib/admin-actions/content";
import type { FormState } from "@/lib/shop-actions";
import { RichEditor } from "./rich-editor";
import { Msg, SubmitButton } from "./ui";

export function PageForm({ page }: { page?: { id: string; title: string; slug: string; content: string; seoTitle: string | null; seoDescription: string | null; showInFooter: boolean; position: number; published: boolean; system: boolean } }) {
  const [state, action] = useActionState(savePageAction, { ok: false, message: "" } as FormState);
  return (
    <ActionForm action={action}>
      <Msg state={state} />
      {page && <input type="hidden" name="id" value={page.id} />}
      <div className="grid-side">
        <div className="panel">
          <div className="f">
            <label>Titre *</label>
            <input name="title" defaultValue={page?.title ?? ""} required />
          </div>
          <RichEditor name="content" label="Contenu" initialHtml={page?.content} hint="Mettez en forme avec la barre d'outils : titres, gras, listes, liens." />
        </div>
        <div>
          <div className="panel">
            <h2>Publication</h2>
            <div className="f">
              <label>Adresse (slug)</label>
              <input name="slug" defaultValue={page?.slug ?? ""} placeholder="automatique" readOnly={page?.system} />
              {page?.system && <span className="hint">Page requise par la boutique : adresse verrouillée.</span>}
            </div>
            <div className="f">
              <label>Ordre dans le pied de page</label>
              <input name="position" type="number" defaultValue={page?.position ?? 0} />
            </div>
            <label className="f-check">
              <input type="checkbox" name="published" defaultChecked={page?.published ?? true} /> Publiée
            </label>
            <label className="f-check">
              <input type="checkbox" name="showInFooter" defaultChecked={page?.showInFooter ?? true} /> Lien dans le pied de page
            </label>
            <div className="f">
              <label>Titre SEO</label>
              <input name="seoTitle" defaultValue={page?.seoTitle ?? ""} />
            </div>
            <div className="f">
              <label>Description SEO</label>
              <textarea name="seoDescription" defaultValue={page?.seoDescription ?? ""} style={{ minHeight: "4rem" }} />
            </div>
            <SubmitButton className="btn-a" style={{ width: "100%" }}>
              {page ? "Enregistrer" : "Créer la page"}
            </SubmitButton>
          </div>
        </div>
      </div>
    </ActionForm>
  );
}
