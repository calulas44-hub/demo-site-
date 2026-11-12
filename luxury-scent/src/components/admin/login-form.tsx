"use client";

import { ActionForm } from "@/components/action-form";

import { useActionState, useState } from "react";
import { adminLoginAction } from "@/lib/admin-actions/auth";
import type { FormState } from "@/lib/shop-actions";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminLoginAction, { ok: false, message: "" } as FormState);
  const [email, setEmail] = useState("");
  return (
    <ActionForm action={action}>
      {state.message && (
        <p className="msg msg--err" role="alert">
          {state.message}
        </p>
      )}
      <div className="f">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="f">
        <label htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button type="submit" className="btn-a" style={{ width: "100%" }} disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </ActionForm>
  );
}
