import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, type OrderStatus, type PaymentMethod } from "@/lib/constants";
import { OrderTimeline } from "@/components/shop/order-timeline";

export const metadata: Metadata = { title: "Détail de la commande", robots: { index: false } };

export default async function CustomerOrderPage({ params }: { params: Promise<{ number: string }> }) {
  const session = await requireCustomer();
  const { number } = await params;
  const order = await prisma.order.findFirst({ where: { number, customerId: session.id }, include: { items: true, statusHistory: { orderBy: { createdAt: "asc" } }, invoice: true } });
  if (!order) notFound();
  return (
    <div>
      <h2>Commande {order.number}</h2>
      <p>
        <span className={`status status--${order.status}`}>{ORDER_STATUS_LABELS[order.status as OrderStatus]}</span> · {order.createdAt.toLocaleDateString("fr-FR")} ·{" "}
        {PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod]}
      </p>
      {order.trackingNumber && (
        <p>
          Suivi {order.carrier ?? ""} : <strong>{order.trackingNumber}</strong>
        </p>
      )}
      <div className="confirmation__box">
        {order.items.map((it) => (
          <div key={it.id} className="summary__row">
            <span>
              {it.name} · {it.variantLabel} × {it.quantity}
            </span>
            <span>{formatPrice(it.total)}</span>
          </div>
        ))}
        {order.discount > 0 && (
          <div className="summary__row summary__row--discount">
            <span>{order.discountLabel ?? "Remise"}</span>
            <span>− {formatPrice(order.discount)}</span>
          </div>
        )}
        <div className="summary__row">
          <span>Livraison ({order.shippingMethodName})</span>
          <span>{formatPrice(order.shippingPrice)}</span>
        </div>
        <div className="summary__row summary__row--total">
          <span>Total TTC</span>
          <strong>{formatPrice(order.total)}</strong>
        </div>
      </div>
      <div className="cards-grid">
        <div className="address-card">
          <p className="caps">Livraison</p>
          {order.shipFirstName} {order.shipLastName}
          <br />
          {order.shipLine1}
          {order.shipLine2 && (
            <>
              <br />
              {order.shipLine2}
            </>
          )}
          <br />
          {order.shipPostalCode} {order.shipCity}, {order.shipCountry}
        </div>
        <div className="address-card">
          <p className="caps">Facturation</p>
          {order.billFirstName} {order.billLastName}
          <br />
          {order.billLine1}
          <br />
          {order.billPostalCode} {order.billCity}, {order.billCountry}
        </div>
      </div>
      {order.invoice && (
        <p style={{ marginTop: "1.5rem" }}>
          <a href={`/compte/commandes/${order.number}/facture`} className="btn btn--outline btn--sm">
            Télécharger la facture {order.invoice.number}
          </a>
        </p>
      )}
      <OrderTimeline history={order.statusHistory.map((h) => ({ status: h.status, note: h.note, createdAt: h.createdAt.toISOString() }))} />
    </div>
  );
}
