"use client";

import { ActionForm } from "@/components/action-form";

import { useActionState } from "react";
import { saveAdminUserAction } from "@/lib/admin-actions/settings";
import type { FormState } from "@/lib/shop-actions";
import { ADMIN_ROLE_LABELS } from "@/lib/constants";
import { Msg, SubmitButton } from "./ui";

export function AdminUserForm({ user }: { user?: { id: string; email: string; name: string; role: string; active: boolean } }) {
  const [state, action] = useActionState(saveAdminUserAction, { ok: false, message: "" } as FormState);
  return (
    <ActionForm action={action} className="panel" autoComplete="off">
      <h2>{user ? `Modifier ${user.name}` : "Nouvel utilisateur"}</h2>
      <Msg state={state} />
      {user && <input type="hidden" name="id" value={user.id} />}
      <div className="f">
        <label>Nom *</label>
        <input name="name" defaultValue={user?.name ?? ""} required />
      </div>
      <div className="f">
        <label>E-mail *</label>
        <input name="email" type="email" defaultValue={user?.email ?? ""} required autoComplete="off" />
      </div>
      <div className="f">
        <label>Rôle</label>
        <select name="role" defaultValue={user?.role ?? "STAFF"}>
          {Object.entries(ADMIN_ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <span className="hint">Propriétaire : tout, dont la banque et les utilisateurs. Administrateur : tout sauf banque et utilisateurs. Collaborateur : catalogue, contenu et commandes.</span>
      </div>
      <div className="f">
        <label>{user ? "Nouveau mot de passe (laisser vide pour conserver)" : "Mot de passe *"}</label>
        <input name="password" type="password" minLength={10} autoComplete="new-password" required={!user} />
      </div>
      <label className="f-check">
        <input type="checkbox" name="active" defaultChecked={user?.active ?? true} /> Compte actif
      </label>
      <SubmitButton>{user ? "Enregistrer" : "Créer l'utilisateur"}</SubmitButton>
    </ActionForm>
  );
}
