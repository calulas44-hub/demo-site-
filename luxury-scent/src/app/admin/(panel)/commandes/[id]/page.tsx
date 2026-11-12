import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAdminSession, canManageFinance } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { orderTaxBreakdown } from "@/lib/accounting";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus, type PaymentMethod } from "@/lib/constants";
import { RefundForm, StatusForm } from "@/components/admin/order-forms";
import { saveOrderNoteAction, saveTrackingAction } from "@/lib/admin-actions/orders";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, session] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: { items: true, statusHistory: { orderBy: { createdAt: "asc" }, include: { adminUser: { select: { name: true } } } }, invoice: true, creditNotes: { orderBy: { issuedAt: "asc" } }, refunds: true, emails: { orderBy: { createdAt: "desc" } }, customer: true },
    }),
    getAdminSession(),
  ]);
  if (!order || !session) notFound();
  const b = orderTaxBreakdown(order);
  const refunded = order.refunds.reduce((s, r) => s + r.amount, 0);
  const canRefund = canManageFinance(session.role) && (order.paymentStatus === "PAID" || order.paymentStatus === "PARTIALLY_REFUNDED") && refunded < order.total;

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Commande {order.number}</h1>
          <p>
            <Link href="/admin/commandes">← Toutes les commandes</Link> · passée le {order.createdAt.toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="adm-actions">
          <span className={`pill pill--${order.status}`} style={{ alignSelf: "center" }}>
            {ORDER_STATUS_LABELS[order.status as OrderStatus]}
          </span>
          {order.invoice && (
            <a href={`/admin/commandes/${order.id}/facture`} className="btn-a btn-a--ghost" target="_blank" rel="noopener">
              Facture {order.invoice.number} (PDF)
            </a>
          )}
        </div>
      </div>

      <div className="grid-side">
        <div>
          <div className="panel">
            <h2>Articles</h2>
            <table className="tbl">
              <thead>
                <tr>
                  <th></th>
                  <th>Produit</th>
                  <th>Réf.</th>
                  <th className="num">PU TTC</th>
                  <th className="num">Qté</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.imageUrl ? <img className="thumb" src={it.imageUrl} alt="" /> : null}</td>
                    <td>
                      {it.productId ? (
                        <Link href={`/admin/produits/${it.productId}`} className="row-link">
                          {it.name}
                        </Link>
                      ) : (
                        it.name
                      )}
                      <br />
                      <span className="muted small">{it.variantLabel}</span>
                    </td>
                    <td className="mono">{it.sku ?? "—"}</td>
                    <td className="num">{formatPrice(it.unitPrice)}</td>
                    <td className="num">{it.quantity}</td>
                    <td className="num">{formatPrice(it.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="ta-r muted">
                    Sous-total articles
                  </td>
                  <td className="num">{formatPrice(order.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan={5} className="ta-r muted">
                    Livraison ({order.shippingMethodName})
                  </td>
                  <td className="num">{formatPrice(order.shippingPrice)}</td>
                </tr>
                <tr>
                  <td colSpan={5} className="ta-r muted">
                    dont TVA
                  </td>
                  <td className="num">{formatPrice(b.totalTva)}</td>
                </tr>
                <tr>
                  <td colSpan={5} className="ta-r">
                    <strong>Total TTC</strong>
                  </td>
                  <td className="num">
                    <strong>{formatPrice(order.total)}</strong>
                  </td>
                </tr>
                {refunded > 0 && (
                  <tr>
                    <td colSpan={5} className="ta-r muted">
                      Remboursé
                    </td>
                    <td className="num">− {formatPrice(refunded)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          <div className="grid-2">
            <div className="panel">
              <h3>Client</h3>
              <p>
                <strong>
                  {order.billFirstName} {order.billLastName}
                </strong>
                <br />
                <a href={`mailto:${order.email}`}>{order.email}</a>
                {order.shipPhone && (
                  <>
                    <br />
                    {order.shipPhone}
                  </>
                )}
                {order.customer && (
                  <>
                    <br />
                    <Link href={`/admin/clients/${order.customer.id}`} className="small">
                      Voir la fiche client →
                    </Link>
                  </>
                )}
              </p>
              {order.customerNote && (
                <p className="msg msg--info small">
                  <strong>Message du client :</strong> {order.customerNote}
                </p>
              )}
            </div>
            <div className="panel">
              <h3>Livraison</h3>
              <p>
                {order.shipFirstName} {order.shipLastName}
                {order.shipCompany && (
                  <>
                    <br />
                    {order.shipCompany}
                  </>
                )}
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
              </p>
              <h3 style={{ marginTop: "1rem" }}>Facturation</h3>
              <p className="small">
                {order.billFirstName} {order.billLastName}
                <br />
                {order.billLine1}, {order.billPostalCode} {order.billCity}, {order.billCountry}
              </p>
            </div>
          </div>

          <div className="panel">
            <h2>Historique</h2>
            <ul className="timeline-a">
              {order.statusHistory.map((h) => (
                <li key={h.id}>
                  <time>{h.createdAt.toLocaleString("fr-FR")}</time>
                  <span>
                    <strong>{ORDER_STATUS_LABELS[h.status as OrderStatus] ?? h.status}</strong>
                    {h.note ? ` — ${h.note}` : ""}
                    {h.adminUser ? <span className="muted"> ({h.adminUser.name})</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {(order.creditNotes.length > 0 || order.emails.length > 0) && (
            <div className="grid-2">
              {order.creditNotes.length > 0 && (
                <div className="panel">
                  <h3>Avoirs</h3>
                  <table className="tbl">
                    <tbody>
                      {order.creditNotes.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <a href={`/admin/commandes/${order.id}/avoir/${c.id}`} target="_blank" rel="noopener" className="row-link">
                              {c.number}
                            </a>
                            <br />
                            <span className="muted small">{c.issuedAt.toLocaleDateString("fr-FR")} · {c.reason ?? "—"}</span>
                          </td>
                          <td className="num">{formatPrice(c.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {order.emails.length > 0 && (
                <div className="panel">
                  <h3>E-mails</h3>
                  <table className="tbl">
                    <tbody>
                      {order.emails.map((e) => (
                        <tr key={e.id}>
                          <td>
                            {e.subject}
                            <br />
                            <span className="muted small">{e.createdAt.toLocaleString("fr-FR")}</span>
                          </td>
                          <td>
                            <span className={`pill pill--${e.status}`}>{e.status === "SENT" ? "Envoyé" : e.status === "SKIPPED" ? "Non envoyé" : "Échec"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="panel">
            <h3>Paiement</h3>
            <p>
              {PAYMENT_METHOD_LABELS[order.paymentMethod as PaymentMethod]} ·{" "}
              <span className={`pill pill--${order.paymentStatus}`}>{PAYMENT_STATUS_LABELS[order.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS]}</span>
              {order.paidAt && (
                <>
                  <br />
                  <span className="muted small">Payée le {order.paidAt.toLocaleString("fr-FR")}</span>
                </>
              )}
              {order.paymentRef && (
                <>
                  <br />
                  <span className="mono small">{order.paymentRef}</span>
                </>
              )}
            </p>
            {order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "PENDING" && <p className="msg msg--info small">Virement attendu : vérifiez votre compte bancaire (référence {order.number}), puis passez la commande en « Payée ».</p>}
          </div>
          <div className="panel">
            <h3>Changer le statut</h3>
            <StatusForm orderId={order.id} current={order.status} carrier={order.carrier} trackingNumber={order.trackingNumber} />
          </div>
          <div className="panel">
            <h3>Suivi colis</h3>
            <form action={saveTrackingAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <div className="f">
                <label>Transporteur</label>
                <input name="carrier" defaultValue={order.carrier ?? ""} />
              </div>
              <div className="f">
                <label>Numéro de suivi</label>
                <input name="trackingNumber" defaultValue={order.trackingNumber ?? ""} />
              </div>
              <button type="submit" className="btn-a btn-a--ghost btn-a--sm">
                Enregistrer
              </button>
            </form>
          </div>
          <div className="panel">
            <h3>Note interne</h3>
            <form action={saveOrderNoteAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <div className="f">
                <textarea name="adminNote" defaultValue={order.adminNote ?? ""} style={{ minHeight: "5rem" }} placeholder="Visible uniquement par l'équipe" />
              </div>
              <button type="submit" className="btn-a btn-a--ghost btn-a--sm">
                Enregistrer
              </button>
            </form>
          </div>
          {canRefund && (
            <div className="panel panel--danger">
              <h3>Remboursement</h3>
              <RefundForm orderId={order.id} maxAmount={order.total - refunded} paymentMethod={order.paymentMethod} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
