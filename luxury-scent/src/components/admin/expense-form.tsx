"use client";

import { ActionForm } from "@/components/action-form";

import { useActionState } from "react";
import { saveExpenseAction } from "@/lib/admin-actions/finance";
import type { FormState } from "@/lib/shop-actions";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { centsToEurosInput } from "@/lib/money";
import { Msg, SubmitButton } from "./ui";

export function ExpenseForm({ expense, defaultVat }: { expense?: { id: string; date: Date; label: string; supplier: string | null; category: string; amountHt: number; vatRate: number; paymentMethod: string | null; invoiceNumber: string | null; receiptUrl: string | null; notes: string | null }; defaultVat: number }) {
  const [state, action] = useActionState(saveExpenseAction, { ok: false, message: "" } as FormState);
  const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return (
    <ActionForm action={action} className="panel">
      <h2>{expense ? "Modifier la dépense" : "Nouvelle dépense"}</h2>
      <Msg state={state} />
      {expense && <input type="hidden" name="id" value={expense.id} />}
      <div className="f-row">
        <div className="f">
          <label>Date *</label>
          <input type="date" name="date" defaultValue={expense ? iso(expense.date) : iso(new Date())} required />
        </div>
        <div className="f">
          <label>Catégorie</label>
          <select name="category" defaultValue={expense?.category ?? "ACHAT_MARCHANDISES"}>
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="f">
        <label>Libellé *</label>
        <input name="label" defaultValue={expense?.label ?? ""} required placeholder="Achat de flacons 50 ml" />
      </div>
      <div className="f-row">
        <div className="f">
          <label>Fournisseur</label>
          <input name="supplier" defaultValue={expense?.supplier ?? ""} />
        </div>
        <div className="f">
          <label>N° de facture fournisseur</label>
          <input name="invoiceNumber" defaultValue={expense?.invoiceNumber ?? ""} />
        </div>
      </div>
      <div className="f-row f-row--3">
        <div className="f">
          <label>Montant HT (€) *</label>
          <input name="amountHt" inputMode="decimal" defaultValue={expense ? centsToEurosInput(expense.amountHt) : ""} required />
        </div>
        <div className="f">
          <label>Taux de TVA (%)</label>
          <input name="vatRate" inputMode="decimal" defaultValue={expense?.vatRate ?? defaultVat} />
          <span className="hint">TVA et TTC calculés automatiquement.</span>
        </div>
        <div className="f">
          <label>Moyen de paiement</label>
          <select name="paymentMethod" defaultValue={expense?.paymentMethod ?? "Virement"}>
            <option>Virement</option>
            <option>Carte</option>
            <option>Prélèvement</option>
            <option>Espèces</option>
            <option>Chèque</option>
          </select>
        </div>
      </div>
      <div className="f">
        <label>Justificatif (PDF ou image)</label>
        {expense?.receiptUrl && (
          <p className="small">
            <a href={expense.receiptUrl} target="_blank" rel="noopener">
              Voir le justificatif actuel
            </a>
          </p>
        )}
        <input type="file" name="receipt" accept="application/pdf,image/*" />
      </div>
      <div className="f">
        <label>Notes</label>
        <textarea name="notes" defaultValue={expense?.notes ?? ""} style={{ minHeight: "3.5rem" }} />
      </div>
      <SubmitButton>{expense ? "Enregistrer" : "Ajouter la dépense"}</SubmitButton>
    </ActionForm>
  );
}
