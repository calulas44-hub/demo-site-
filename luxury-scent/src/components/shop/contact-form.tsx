"use client";

import { ActionForm } from "@/components/action-form";

import { useActionState } from "react";
import { contactAction, type FormState } from "@/lib/shop-actions";

const initial: FormState = { ok: false, message: "" };

export function ContactForm() {
  const [state, action, pending] = useActionState(contactAction, initial);
  if (state.ok) {
    return (
      <p className="alert alert--success" role="status">
        {state.message}
      </p>
    );
  }
  return (
    <ActionForm action={action}>
      {state.message && (
        <p className="alert alert--error" role="alert">
          {state.message}
        </p>
      )}
      <div className="field-row">
        <div className="field">
          <label htmlFor="name">Nom</label>
          <input id="name" name="name" required autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="subject">Sujet</label>
        <input id="subject" name="subject" />
      </div>
      <div className="field">
        <label htmlFor="message">Message</label>
        <textarea id="message" name="message" required minLength={10} />
      </div>
      <button type="submit" className="btn btn--block" disabled={pending}>
        {pending ? "Envoi…" : "Envoyer"}
      </button>
    </ActionForm>
  );
}
