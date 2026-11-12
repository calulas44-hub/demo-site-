"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { setupOwnerAction } from "@/lib/admin-actions/auth";
import type { FormState } from "@/lib/shop-actions";

export function AdminSetupForm() {
  const [state, action, pending] = useActionState(setupOwnerAction, { ok: false, message: "" } as FormState);
  return (
    <ActionForm action={action}>
      {state.message && (
        <p className="msg msg--err" role="alert">
          {state.message}
        </p>
      )}
      <div className="f">
        <label htmlFor="code">Code d&apos;installation</label>
        <input id="code" name="code" required autoComplete="off" placeholder="XXXX-XXXX-XXXX" autoCapitalize="characters" />
      </div>
      <div className="f">
        <label htmlFor="name">Votre nom</label>
        <input id="name" name="name" autoComplete="name" />
      </div>
      <div className="f">
        <label htmlFor="email">E-mail de connexion</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="f">
        <label htmlFor="password">Mot de passe (10 caractères minimum)</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <div className="f">
        <label htmlFor="confirm">Confirmez le mot de passe</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <button type="submit" className="btn-a" style={{ width: "100%" }} disabled={pending}>
        {pending ? "Création…" : "Créer mon compte administrateur"}
      </button>
    </ActionForm>
  );
}
