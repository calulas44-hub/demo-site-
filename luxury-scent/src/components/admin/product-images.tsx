"use client";

import { ActionForm } from "@/components/action-form";

import { useActionState } from "react";
import { imageAction, uploadProductImagesAction } from "@/lib/admin-actions/catalog";
import type { FormState } from "@/lib/shop-actions";
import { Msg, SubmitButton } from "./ui";

export function ProductImages({ productId, images }: { productId: string; images: { id: string; url: string; alt: string | null; isPrimary: boolean }[] }) {
  const [state, action] = useActionState(uploadProductImagesAction, { ok: false, message: "" } as FormState);
  return (
    <div className="panel">
      <h2>Photographies</h2>
      <Msg state={state} />
      {images.length > 0 && (
        <div className="thumbs" style={{ marginBottom: "1rem" }}>
          {images.map((img, i) => (
            <div key={img.id} className={`thumb-card${img.isPrimary ? " is-primary" : ""}`}>
              <img src={img.url} alt={img.alt ?? ""} />
              <form action={imageAction} className="thumb-card__bar">
                <input type="hidden" name="imageId" value={img.id} />
                {!img.isPrimary && (
                  <button type="submit" name="op" value="primary" title="Définir comme image principale">
                    ★ Principale
                  </button>
                )}
                {i > 0 && (
                  <button type="submit" name="op" value="left" title="Déplacer avant">
                    ←
                  </button>
                )}
                {i < images.length - 1 && (
                  <button type="submit" name="op" value="right" title="Déplacer après">
                    →
                  </button>
                )}
                <button
                  type="submit"
                  name="op"
                  value="delete"
                  title="Supprimer"
                  onClick={(e) => {
                    if (!window.confirm("Supprimer cette image ?")) e.preventDefault();
                  }}
                >
                  Supprimer
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
      <ActionForm action={action}>
        <input type="hidden" name="productId" value={productId} />
        <div className="f">
          <label htmlFor="images">Ajouter des photos (JPEG, PNG, WebP — converties en WebP, 2400 px max)</label>
          <input id="images" name="images" type="file" accept="image/*" multiple required />
          <span className="hint">La première image est l&apos;image principale ; la deuxième apparaît au survol dans le catalogue.</span>
        </div>
        <SubmitButton className="btn-a btn-a--ghost" pendingLabel="Téléversement…">
          Téléverser
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
