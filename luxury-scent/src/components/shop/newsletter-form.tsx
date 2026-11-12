"use client";

import { ActionForm } from "@/components/action-form";

import { useActionState } from "react";
import { subscribeNewsletterAction, type FormState } from "@/lib/shop-actions";

const initial: FormState = { ok: false, message: "" };

export function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const [state, action, pending] = useActionState(subscribeNewsletterAction, initial);
  return (
    <ActionForm action={action} className="newsletter__form" style={compact ? { marginTop: ".5rem" } : undefined}>
      <label className="visually-hidden" htmlFor={`nl-${compact ? "c" : "f"}`}>
        Adresse e-mail
      </label>
      <input id={`nl-${compact ? "c" : "f"}`} type="email" name="email" placeholder="Votre adresse e-mail" required autoComplete="email" />
      <button type="submit" className={`btn${compact ? " btn--gold" : " btn--gold"}`} disabled={pending}>
        {pending ? "…" : "S'inscrire"}
      </button>
      {state.message && (
        <p className={`small ${state.ok ? "" : "muted"}`} style={{ width: "100%", margin: ".4rem 0 0" }} role="status">
          {state.message}
        </p>
      )}
    </ActionForm>
  );
}
