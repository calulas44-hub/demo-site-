"use client";

import { ActionForm } from "@/components/action-form";

import { useActionState, useState } from "react";
import { saveAnnouncementAction, saveHomeSectionAction } from "@/lib/admin-actions/content";
import type { FormState } from "@/lib/shop-actions";
import { HOME_SECTION_LABELS, HOME_SECTION_TYPES, type HomeSectionType } from "@/lib/constants";
import { Msg, SubmitButton } from "./ui";

const init: FormState = { ok: false, message: "" };

export interface SectionData {
  id: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  text: string | null;
  imageUrl: string | null;
  imageMobileUrl: string | null;
  buttonLabel: string | null;
  buttonUrl: string | null;
  position: number;
  active: boolean;
  data: Record<string, unknown>;
}

export function HomeSectionForm({ section, products }: { section?: SectionData; products: { id: string; name: string; subtitle: string | null }[] }) {
  const [state, action] = useActionState(saveHomeSectionAction, init);
  const [type, setType] = useState<HomeSectionType>((section?.type as HomeSectionType) ?? "HERO");
  const hasImage = ["HERO", "BANNER", "EDITORIAL"].includes(type);
  const hasText = type !== "REASSURANCE";
  const hasButton = ["HERO", "BANNER", "EDITORIAL", "FEATURED_PRODUCTS"].includes(type);
  const selected = new Set((section?.data.productIds as string[] | undefined) ?? []);
  return (
    <ActionForm action={action} className="panel">
      <h2>{section ? "Modifier la section" : "Ajouter une section"}</h2>
      <Msg state={state} />
      {section && <input type="hidden" name="id" value={section.id} />}
      <div className="f">
        <label>Type de section</label>
        <select name="type" value={type} onChange={(e) => setType(e.target.value as HomeSectionType)}>
          {HOME_SECTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {HOME_SECTION_LABELS[t]}
            </option>
          ))}
        </select>
        {type === "REASSURANCE" && <span className="hint">Les arguments de réassurance se modifient dans Paramètres.</span>}
        {type === "COLLECTIONS" && <span className="hint">Affiche les collections actives (4 premières).</span>}
        {type === "CATEGORIES" && <span className="hint">Affiche les catégories principales ayant une image.</span>}
      </div>
      {hasText && (
        <>
          <div className="f-row">
            <div className="f">
              <label>Sur-titre</label>
              <input name="subtitle" defaultValue={section?.subtitle ?? ""} />
            </div>
            <div className="f">
              <label>Titre</label>
              <input name="title" defaultValue={section?.title ?? ""} />
            </div>
          </div>
          <div className="f">
            <label>Texte</label>
            <textarea name="text" defaultValue={section?.text ?? ""} style={{ minHeight: "4.5rem" }} />
          </div>
        </>
      )}
      {hasImage && (
        <div className="f-row">
          <div className="f">
            <label>Image {type === "HERO" ? "(plein écran, 2400 px conseillés)" : ""}</label>
            {section?.imageUrl && (
              <div className="img-preview">
                <img src={section.imageUrl} alt="" />
                <label className="f-check" style={{ margin: 0 }}>
                  <input type="checkbox" name="removeImage" /> Retirer
                </label>
              </div>
            )}
            <input type="file" name="image" accept="image/*" />
          </div>
          {type === "HERO" && (
            <div className="f">
              <label>Image mobile (portrait, facultatif)</label>
              {section?.imageMobileUrl && (
                <div className="img-preview">
                  <img src={section.imageMobileUrl} alt="" />
                </div>
              )}
              <input type="file" name="imageMobile" accept="image/*" />
            </div>
          )}
        </div>
      )}
      {type === "HERO" && (
        <div className="f-row">
          <div className="f">
            <label>Position du texte</label>
            <select name="align" defaultValue={(section?.data.align as string) ?? "left"}>
              <option value="left">À gauche</option>
              <option value="center">Centré</option>
              <option value="right">À droite</option>
            </select>
          </div>
          <div className="f">
            <label>Couleur du texte</label>
            <select name="theme" defaultValue={(section?.data.theme as string) ?? "dark"}>
              <option value="dark">Blanc sur image sombre</option>
              <option value="light">Noir sur image claire</option>
            </select>
          </div>
        </div>
      )}
      {type === "EDITORIAL" && (
        <div className="f">
          <label>Côté de l&apos;image</label>
          <select name="imageSide" defaultValue={(section?.data.imageSide as string) ?? "left"}>
            <option value="left">Image à gauche</option>
            <option value="right">Image à droite</option>
          </select>
        </div>
      )}
      {type === "FEATURED_PRODUCTS" && (
        <div className="f">
          <label>Produits à afficher (vide = produits « mis en avant »)</label>
          <div style={{ maxHeight: "14rem", overflow: "auto", border: "1px solid var(--a-line)", borderRadius: 4, padding: ".5rem .7rem" }}>
            {products.map((p) => (
              <label key={p.id} className="f-check" style={{ marginBottom: ".3rem" }}>
                <input type="checkbox" name="productIds" value={p.id} defaultChecked={selected.has(p.id)} /> {p.name}
                {p.subtitle ? <span className="muted"> · {p.subtitle}</span> : null}
              </label>
            ))}
          </div>
        </div>
      )}
      {hasButton && (
        <div className="f-row">
          <div className="f">
            <label>Texte du bouton</label>
            <input name="buttonLabel" defaultValue={section?.buttonLabel ?? ""} />
          </div>
          <div className="f">
            <label>Lien du bouton</label>
            <input name="buttonUrl" defaultValue={section?.buttonUrl ?? ""} placeholder="/parfums" />
          </div>
        </div>
      )}
      <div className="f-row">
        <div className="f">
          <label>Ordre</label>
          <input name="position" type="number" defaultValue={section?.position ?? 0} />
        </div>
        <div className="f" style={{ justifyContent: "flex-end" }}>
          <label className="f-check">
            <input type="checkbox" name="active" defaultChecked={section?.active ?? true} /> Visible sur le site
          </label>
        </div>
      </div>
      <SubmitButton>{section ? "Enregistrer" : "Ajouter la section"}</SubmitButton>
    </ActionForm>
  );
}

export function AnnouncementForm({ announcement }: { announcement?: { id: string; text: string; url: string | null; position: number; active: boolean; startsAt: Date | null; endsAt: Date | null } }) {
  const [state, action] = useActionState(saveAnnouncementAction, init);
  const toInput = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
  return (
    <ActionForm action={action} className="panel" id="annonces">
      <h2>{announcement ? "Modifier l'annonce" : "Nouvelle annonce"}</h2>
      <Msg state={state} />
      {announcement && <input type="hidden" name="id" value={announcement.id} />}
      <div className="f">
        <label>Texte *</label>
        <input name="text" defaultValue={announcement?.text ?? ""} required maxLength={200} />
      </div>
      <div className="f-row">
        <div className="f">
          <label>Lien (facultatif)</label>
          <input name="url" defaultValue={announcement?.url ?? ""} placeholder="/produits/…" />
        </div>
        <div className="f">
          <label>Ordre</label>
          <input name="position" type="number" defaultValue={announcement?.position ?? 0} />
        </div>
      </div>
      <div className="f-row">
        <div className="f">
          <label>Afficher à partir du</label>
          <input name="startsAt" type="datetime-local" defaultValue={toInput(announcement?.startsAt ?? null)} />
        </div>
        <div className="f">
          <label>Jusqu&apos;au</label>
          <input name="endsAt" type="datetime-local" defaultValue={toInput(announcement?.endsAt ?? null)} />
        </div>
      </div>
      <label className="f-check">
        <input type="checkbox" name="active" defaultChecked={announcement?.active ?? true} /> Active
      </label>
      <SubmitButton>{announcement ? "Enregistrer" : "Ajouter"}</SubmitButton>
    </ActionForm>
  );
}
