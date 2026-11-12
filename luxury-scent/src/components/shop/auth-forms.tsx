"use client";

import { ActionForm } from "@/components/action-form";

import Link from "next/link";
import { useActionState, useState } from "react";
import { changePasswordAction, customerLoginAction, customerRegisterAction, saveAddressAction, updateProfileAction } from "@/lib/customer-actions";
import type { FormState } from "@/lib/shop-actions";
import { COUNTRIES } from "@/lib/constants";

const initial: FormState = { ok: false, message: "" };

function Status({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p className={`alert ${state.ok ? "alert--success" : "alert--error"}`} role={state.ok ? "status" : "alert"}>
      {state.message}
    </p>
  );
}

export function LoginForm({ retour }: { retour?: string }) {
  const [state, action, pending] = useActionState(customerLoginAction, initial);
  const [email, setEmail] = useState("");
  return (
    <ActionForm action={action} className="auth">
      <Status state={state} />
      {retour && <input type="hidden" name="retour" value={retour} />}
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button type="submit" className="btn btn--block" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
      <p className="auth__alt">
        Pas encore de compte ? <Link href={`/compte/inscription${retour ? `?retour=${encodeURIComponent(retour)}` : ""}`}>Créer un compte</Link>
      </p>
    </ActionForm>
  );
}

export function RegisterForm({ retour }: { retour?: string }) {
  const [state, action, pending] = useActionState(customerRegisterAction, initial);
  return (
    <ActionForm action={action} className="auth">
      <Status state={state} />
      {retour && <input type="hidden" name="retour" value={retour} />}
      <div className="field-row">
        <div className="field">
          <label htmlFor="firstName">Prénom</label>
          <input id="firstName" name="firstName" autoComplete="given-name" required />
        </div>
        <div className="field">
          <label htmlFor="lastName">Nom</label>
          <input id="lastName" name="lastName" autoComplete="family-name" required />
        </div>
      </div>
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        <span className="hint">10 caractères minimum.</span>
      </div>
      <label className="check">
        <input type="checkbox" name="newsletter" />
        <span>Je souhaite recevoir la newsletter</span>
      </label>
      <button type="submit" className="btn btn--block" disabled={pending}>
        {pending ? "Création…" : "Créer mon compte"}
      </button>
      <p className="auth__alt">
        Déjà un compte ? <Link href="/compte/connexion">Se connecter</Link>
      </p>
    </ActionForm>
  );
}

export function ProfileForm({ customer }: { customer: { firstName: string; lastName: string; email: string; phone: string | null; newsletter: boolean } }) {
  const [state, action, pending] = useActionState(updateProfileAction, initial);
  return (
    <ActionForm action={action}>
      <Status state={state} />
      <div className="field-row">
        <div className="field">
          <label htmlFor="firstName">Prénom</label>
          <input id="firstName" name="firstName" defaultValue={customer.firstName} required />
        </div>
        <div className="field">
          <label htmlFor="lastName">Nom</label>
          <input id="lastName" name="lastName" defaultValue={customer.lastName} required />
        </div>
      </div>
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" value={customer.email} readOnly />
      </div>
      <div className="field">
        <label htmlFor="phone">Téléphone</label>
        <input id="phone" name="phone" type="tel" defaultValue={customer.phone ?? ""} />
      </div>
      <label className="check">
        <input type="checkbox" name="newsletter" defaultChecked={customer.newsletter} />
        <span>Recevoir la newsletter</span>
      </label>
      <button type="submit" className="btn" style={{ marginTop: "1rem" }} disabled={pending}>
        Enregistrer
      </button>
    </ActionForm>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initial);
  return (
    <ActionForm action={action}>
      <Status state={state} />
      <div className="field">
        <label htmlFor="current">Mot de passe actuel</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="newpass">Nouveau mot de passe</label>
        <input id="newpass" name="password" type="password" autoComplete="new-password" minLength={10} required />
      </div>
      <button type="submit" className="btn btn--outline" disabled={pending}>
        Modifier le mot de passe
      </button>
    </ActionForm>
  );
}

export function AddressForm({ address }: { address?: { id: string; label: string | null; firstName: string; lastName: string; company: string | null; line1: string; line2: string | null; postalCode: string; city: string; country: string; phone: string | null; isDefault: boolean } }) {
  const [state, action, pending] = useActionState(saveAddressAction, initial);
  return (
    <ActionForm action={action}>
      <Status state={state} />
      {address && <input type="hidden" name="id" value={address.id} />}
      <div className="field">
        <label htmlFor="label">Nom de l&apos;adresse (ex. Domicile)</label>
        <input id="label" name="label" defaultValue={address?.label ?? ""} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="a-firstName">Prénom</label>
          <input id="a-firstName" name="firstName" defaultValue={address?.firstName ?? ""} required />
        </div>
        <div className="field">
          <label htmlFor="a-lastName">Nom</label>
          <input id="a-lastName" name="lastName" defaultValue={address?.lastName ?? ""} required />
        </div>
      </div>
      <div className="field">
        <label htmlFor="company">Société</label>
        <input id="company" name="company" defaultValue={address?.company ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="line1">Adresse</label>
        <input id="line1" name="line1" defaultValue={address?.line1 ?? ""} required />
      </div>
      <div className="field">
        <label htmlFor="line2">Complément</label>
        <input id="line2" name="line2" defaultValue={address?.line2 ?? ""} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="postalCode">Code postal</label>
          <input id="postalCode" name="postalCode" defaultValue={address?.postalCode ?? ""} required />
        </div>
        <div className="field">
          <label htmlFor="city">Ville</label>
          <input id="city" name="city" defaultValue={address?.city ?? ""} required />
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="country">Pays</label>
          <select id="country" name="country" defaultValue={address?.country ?? "FR"}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="phone">Téléphone</label>
          <input id="phone" name="phone" type="tel" defaultValue={address?.phone ?? ""} />
        </div>
      </div>
      <label className="check">
        <input type="checkbox" name="isDefault" defaultChecked={address?.isDefault ?? false} />
        <span>Adresse par défaut</span>
      </label>
      <button type="submit" className="btn" style={{ marginTop: "1rem" }} disabled={pending}>
        Enregistrer l&apos;adresse
      </button>
    </ActionForm>
  );
}
