"use client";

import { ActionForm } from "@/components/action-form";

import { useActionState } from "react";
import { bankAccountOpAction, saveBankAccountAction } from "@/lib/admin-actions/finance";
import type { FormState } from "@/lib/shop-actions";
import { Msg, SubmitButton } from "./ui";

const init: FormState = { ok: false, message: "" };

export function BankAccountForm({ account }: { account?: { id: string; label: string; holderName: string; bankName: string | null; showOnInvoice: boolean } }) {
  const [state, action] = useActionState(saveBankAccountAction, init);
  return (
    <ActionForm action={action} className="panel" autoComplete="off">
      <h2>{account ? `Modifier « ${account.label} »` : "Ajouter un compte bancaire"}</h2>
      <Msg state={state} />
      {account && <input type="hidden" name="id" value={account.id} />}
      <div className="f-row">
        <div className="f">
          <label>Libellé interne *</label>
          <input name="label" defaultValue={account?.label ?? ""} required placeholder="Compte principal" />
        </div>
        <div className="f">
          <label>Titulaire du compte *</label>
          <input name="holderName" defaultValue={account?.holderName ?? ""} required />
        </div>
      </div>
      <div className="f">
        <label>Banque</label>
        <input name="bankName" defaultValue={account?.bankName ?? ""} />
      </div>
      <div className="f-row">
        <div className="f">
          <label>IBAN *</label>
          <input name="iban" className="mono" required placeholder={account ? "Ressaisir l'IBAN complet" : "FR76 …"} autoComplete="off" />
          <span className="hint">{account ? "Pour des raisons de sécurité, l'IBAN n'est pas pré-rempli : saisissez-le à nouveau, même s'il ne change pas." : "Vérifié par clé de contrôle avant enregistrement."}</span>
        </div>
        <div className="f">
          <label>BIC</label>
          <input name="bic" className="mono" placeholder="BNPAFRPP" autoComplete="off" />
        </div>
      </div>
      <label className="f-check">
        <input type="checkbox" name="showOnInvoice" defaultChecked={account?.showOnInvoice ?? true} /> Afficher sur les factures
      </label>
      <div className="f">
        <label>Votre mot de passe (confirmation) *</label>
        <input type="password" name="confirmPassword" required autoComplete="current-password" />
      </div>
      <SubmitButton>{account ? "Enregistrer les modifications" : "Enregistrer le compte"}</SubmitButton>
    </ActionForm>
  );
}

export function BankOpForm({ id, op, label, className, confirmMessage }: { id: string; op: "activate" | "delete" | "reveal"; label: string; className?: string; confirmMessage?: string }) {
  const [state, action] = useActionState(bankAccountOpAction, init);
  return (
    <div>
      <form
        action={action}
        className="f-inline"
        onSubmit={(e) => {
          if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="op" value={op} />
        <input type="password" name="confirmPassword" placeholder="Mot de passe" required autoComplete="current-password" style={{ width: "9rem" }} />
        <SubmitButton className={className ?? "btn-a btn-a--ghost btn-a--sm"} pendingLabel="…">
          {label}
        </SubmitButton>
      </form>
      {state.message && (
        <p className={`msg ${state.ok ? "msg--ok" : "msg--err"} small mono`} style={{ marginTop: ".4rem" }}>
          {state.message}
        </p>
      )}
    </div>
  );
}
