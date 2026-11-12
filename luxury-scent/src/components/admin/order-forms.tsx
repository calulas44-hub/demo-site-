"use client";

import { ActionForm } from "@/components/action-form";

import { useActionState, useState } from "react";
import { changeOrderStatusAction, refundOrderAction } from "@/lib/admin-actions/orders";
import type { FormState } from "@/lib/shop-actions";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";
import { Msg, SubmitButton } from "./ui";

const init: FormState = { ok: false, message: "" };

export function StatusForm({ orderId, current, carrier, trackingNumber }: { orderId: string; current: string; carrier: string | null; trackingNumber: string | null }) {
  const [state, action] = useActionState(changeOrderStatusAction, init);
  const [status, setStatus] = useState<OrderStatus>(current as OrderStatus);
  const transitions: Record<string, OrderStatus[]> = {
    PENDING_PAYMENT: ["PAID", "CANCELLED"],
    PAID: ["PREPARING", "SHIPPED", "CANCELLED"],
    PREPARING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
    REFUNDED: [],
  };
  const options = transitions[current] ?? [];
  if (options.length === 0) return <p className="muted small">Aucune transition disponible depuis ce statut.</p>;
  return (
    <ActionForm action={action}>
      <Msg state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <div className="f">
        <label>Nouveau statut</label>
        <select name="status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
          <option value={current} disabled>
            {ORDER_STATUS_LABELS[current as OrderStatus]} (actuel)
          </option>
          {options.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {status === "PAID" && <span className="hint">Génère la facture, les écritures de vente et envoie l&apos;e-mail de confirmation de paiement.</span>}
        {status === "CANCELLED" && <span className="hint">Les articles sont remis en stock.</span>}
      </div>
      {status === "SHIPPED" && (
        <div className="f-row">
          <div className="f">
            <label>Transporteur</label>
            <input name="carrier" defaultValue={carrier ?? ""} placeholder="Colissimo, Chronopost…" />
          </div>
          <div className="f">
            <label>Numéro de suivi</label>
            <input name="trackingNumber" defaultValue={trackingNumber ?? ""} />
          </div>
        </div>
      )}
      <div className="f">
        <label>Note (visible dans l&apos;historique)</label>
        <input name="note" placeholder="Facultatif" />
      </div>
      {status !== "PAID" && status !== current && (
        <label className="f-check">
          <input type="checkbox" name="notify" defaultChecked /> Prévenir le client par e-mail
        </label>
      )}
      <SubmitButton disabled={status === current}>Appliquer</SubmitButton>
    </ActionForm>
  );
}

export function RefundForm({ orderId, maxAmount, paymentMethod }: { orderId: string; maxAmount: number; paymentMethod: string }) {
  const [state, action] = useActionState(refundOrderAction, init);
  return (
    <ActionForm action={action}>
      <Msg state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <div className="f-row">
        <div className="f">
          <label>Montant TTC (max {(maxAmount / 100).toFixed(2).replace(".", ",")} €)</label>
          <input name="amount" inputMode="decimal" defaultValue={(maxAmount / 100).toFixed(2).replace(".", ",")} required />
        </div>
        <div className="f">
          <label>Mode</label>
          <select name="method" defaultValue={paymentMethod === "CARD" ? "CARD" : "BANK_TRANSFER"}>
            <option value="BANK_TRANSFER">Virement</option>
            <option value="CARD">Carte (via le prestataire)</option>
          </select>
        </div>
      </div>
      <div className="f">
        <label>Motif</label>
        <input name="reason" placeholder="Retour produit, geste commercial…" />
      </div>
      <SubmitButton className="btn-a btn-a--danger" pendingLabel="Émission…">
        Émettre un avoir et rembourser
      </SubmitButton>
      <p className="hint" style={{ marginTop: ".5rem" }}>
        L&apos;avoir est numéroté et comptabilisé. Le mouvement d&apos;argent lui-même reste à effectuer depuis votre banque ou votre prestataire.
      </p>
    </ActionForm>
  );
}
