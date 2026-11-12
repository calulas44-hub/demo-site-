"use client";

import { ActionForm } from "@/components/action-form";

import { useActionState } from "react";
import { saveShippingMethodAction } from "@/lib/admin-actions/settings";
import type { FormState } from "@/lib/shop-actions";
import { centsToEurosInput } from "@/lib/money";
import { Msg, SubmitButton } from "./ui";

export function ShippingForm({ method }: { method?: { id: string; name: string; description: string | null; price: number; freeAbove: number | null; estimatedDays: string | null; countries: string; position: number; active: boolean } }) {
  const [state, action] = useActionState(saveShippingMethodAction, { ok: false, message: "" } as FormState);
  return (
    <ActionForm action={action} className="panel">
      <h2>{method ? `Modifier « ${method.name} »` : "Nouveau mode de livraison"}</h2>
      <Msg state={state} />
      {method && <input type="hidden" name="id" value={method.id} />}
      <div className="f">
        <label>Nom *</label>
        <input name="name" defaultValue={method?.name ?? ""} required placeholder="Colissimo suivi" />
      </div>
      <div className="f">
        <label>Description</label>
        <input name="description" defaultValue={method?.description ?? ""} placeholder="Livraison à domicile en 2 à 3 jours ouvrés" />
      </div>
      <div className="f-row f-row--3">
        <div className="f">
          <label>Prix TTC (€) *</label>
          <input name="price" inputMode="decimal" defaultValue={method ? centsToEurosInput(method.price) : ""} required />
        </div>
        <div className="f">
          <label>Offert dès (€)</label>
          <input name="freeAbove" inputMode="decimal" defaultValue={centsToEurosInput(method?.freeAbove)} placeholder="vide = jamais" />
        </div>
        <div className="f">
          <label>Délai annoncé</label>
          <input name="estimatedDays" defaultValue={method?.estimatedDays ?? ""} placeholder="2 à 3 jours ouvrés" />
        </div>
      </div>
      <div className="f-row">
        <div className="f">
          <label>Pays desservis (codes séparés par des virgules, * pour tous)</label>
          <input name="countries" defaultValue={method?.countries ?? "FR"} placeholder="FR,BE,LU" />
        </div>
        <div className="f">
          <label>Ordre</label>
          <input name="position" type="number" defaultValue={method?.position ?? 0} />
        </div>
      </div>
      <label className="f-check">
        <input type="checkbox" name="active" defaultChecked={method?.active ?? true} /> Proposé aux clients
      </label>
      <SubmitButton>{method ? "Enregistrer" : "Ajouter"}</SubmitButton>
    </ActionForm>
  );
}
