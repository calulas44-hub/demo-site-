import type { Metadata } from "next";
import { findOrderForCustomerView } from "@/lib/orders";
import { formatPrice } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";
import { OrderTimeline } from "@/components/shop/order-timeline";

export const metadata: Metadata = { title: "Suivre ma commande", robots: { index: false } };

export default async function TrackingPage({ searchParams }: { searchParams: Promise<{ n?: string; e?: string }> }) {
  const sp = await searchParams;
  const n = sp.n?.trim() ?? "";
  const e = sp.e?.trim() ?? "";
  const order = n && e ? await findOrderForCustomerView(n, e) : null;
  return (
    <div className="container confirmation">
      <header className="page-title">
        <p className="eyebrow">Service client</p>
        <h1>Suivre ma commande</h1>
        <p className="lead">Indiquez votre numéro de commande et l&apos;adresse e-mail utilisée lors de l&apos;achat.</p>
      </header>
      <form method="get" className="auth" style={{ marginBottom: "2rem" }}>
        <div className="field">
          <label htmlFor="n">Numéro de commande</label>
          <input id="n" name="n" defaultValue={n} placeholder="LS-2026-00001" required />
        </div>
        <div className="field">
          <label htmlFor="e">Adresse e-mail</label>
          <input id="e" name="e" type="email" defaultValue={e} required />
        </div>
        <button type="submit" className="btn btn--block">
          Consulter
        </button>
      </form>
      {n && e && !order && <p className="alert alert--error prose-center">Aucune commande ne correspond à ces informations.</p>}
      {order && (
        <div className="confirmation__box">
          <p className="caps">Commande {order.number}</p>
          <p>
            <span className={`status status--${order.status}`}>{ORDER_STATUS_LABELS[order.status as OrderStatus]}</span>
          </p>
          {order.trackingNumber && (
            <p>
              Transporteur : {order.carrier ?? "—"} · Numéro de suivi : <strong>{order.trackingNumber}</strong>
            </p>
          )}
          <ul>
            {order.items.map((it) => (
              <li key={it.id} className="summary__row">
                <span>
                  {it.name} · {it.variantLabel} × {it.quantity}
                </span>
                <span>{formatPrice(it.total)}</span>
              </li>
            ))}
          </ul>
          <div className="summary__row summary__row--total">
            <span>Total TTC</span>
            <strong>{formatPrice(order.total)}</strong>
          </div>
          <OrderTimeline history={order.statusHistory.map((h) => ({ status: h.status, note: h.note, createdAt: h.createdAt.toISOString() }))} />
        </div>
      )}
    </div>
  );
}
