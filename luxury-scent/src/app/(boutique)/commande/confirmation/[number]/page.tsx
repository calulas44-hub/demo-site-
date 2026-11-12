import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCustomerSession } from "@/lib/auth";
import { getActiveBankDetails } from "@/lib/bank";
import { formatPrice } from "@/lib/money";
import { LAST_ORDER_COOKIE, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";
import { OrderTimeline } from "@/components/shop/order-timeline";

export const metadata: Metadata = { title: "Confirmation de commande", robots: { index: false } };

export default async function ConfirmationPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ paiement?: string }> }) {
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const order = await prisma.order.findUnique({ where: { number: decodeURIComponent(number) }, include: { items: true, statusHistory: { orderBy: { createdAt: "asc" } } } });
  if (!order) notFound();
  const session = await getCustomerSession();
  const lastOrder = (await cookies()).get(LAST_ORDER_COOKIE)?.value;
  const allowed = lastOrder === order.number || (session && order.customerId === session.id);
  if (!allowed) notFound();

  const bank = order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "PENDING" ? await getActiveBankDetails() : null;
  const cancelled = sp.paiement === "annule";

  return (
    <div className="container confirmation">
      <header className="page-title">
        <p className="eyebrow">Commande {order.number}</p>
        <h1>{cancelled ? "Paiement interrompu" : "Merci pour votre commande"}</h1>
        <p className="lead">
          {cancelled
            ? "Votre commande est enregistrée mais n'a pas été réglée. Vous pouvez reprendre le paiement en nous contactant ou régler par virement."
            : order.paymentMethod === "BANK_TRANSFER"
              ? "Votre commande est enregistrée. Elle sera préparée dès réception de votre virement."
              : order.paymentStatus === "PAID"
                ? "Votre paiement est confirmé. Nous préparons votre colis avec soin."
                : "Votre paiement est en cours de confirmation. Vous recevrez un e-mail dès validation."}
        </p>
        <span className={`status status--${order.status}`}>{ORDER_STATUS_LABELS[order.status as OrderStatus]}</span>
      </header>

      {bank && (
        <div className="bank-box">
          <p className="caps" style={{ marginBottom: ".2rem" }}>
            Règlement par virement
          </p>
          <p className="small">
            Merci d&apos;effectuer un virement de <strong>{formatPrice(order.total)}</strong> avec la référence <strong>{order.number}</strong>.
          </p>
          <dl>
            <dt>Titulaire</dt>
            <dd>{bank.holderName}</dd>
            <dt>IBAN</dt>
            <dd>{bank.iban}</dd>
            {bank.bic && (
              <>
                <dt>BIC</dt>
                <dd>{bank.bic}</dd>
              </>
            )}
            {bank.bankName && (
              <>
                <dt>Banque</dt>
                <dd>{bank.bankName}</dd>
              </>
            )}
            <dt>Référence</dt>
            <dd>{order.number}</dd>
          </dl>
        </div>
      )}
      {order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "PENDING" && !bank && (
        <p className="alert alert--info">Nos coordonnées bancaires vous seront communiquées par e-mail par notre service client.</p>
      )}

      <div className="confirmation__box">
        <div className="mini-lines">
          {order.items.map((it) => (
            <div key={it.id} className="mini-line">
              {it.imageUrl ? <img src={it.imageUrl} alt="" /> : <span />}
              <span>
                {it.name}
                <br />
                <span className="muted small">
                  {it.variantLabel} × {it.quantity}
                </span>
              </span>
              <span>{formatPrice(it.total)}</span>
            </div>
          ))}
        </div>
        {order.discount > 0 && (
          <div className="summary__row summary__row--discount">
            <span>{order.discountLabel ?? "Remise"}</span>
            <span>− {formatPrice(order.discount)}</span>
          </div>
        )}
        <div className="summary__row">
          <span>Livraison ({order.shippingMethodName})</span>
          <span>{order.shippingPrice === 0 ? "Offerte" : formatPrice(order.shippingPrice)}</span>
        </div>
        <div className="summary__row summary__row--total">
          <span>Total TTC</span>
          <strong>{formatPrice(order.total)}</strong>
        </div>
        <p className="small muted" style={{ marginTop: "1rem" }}>
          Livraison à {order.shipFirstName} {order.shipLastName}, {order.shipLine1}
          {order.shipLine2 ? `, ${order.shipLine2}` : ""}, {order.shipPostalCode} {order.shipCity} ({order.shipCountry}).
        </p>
      </div>

      <OrderTimeline history={order.statusHistory.map((h) => ({ status: h.status, note: h.note, createdAt: h.createdAt.toISOString() }))} />

      <p className="prose-center" style={{ margin: "2.5rem 0 5rem" }}>
        <Link href={`/suivi?n=${encodeURIComponent(order.number)}&e=${encodeURIComponent(order.email)}`} className="btn btn--outline">
          Suivre ma commande
        </Link>
      </p>
    </div>
  );
}
