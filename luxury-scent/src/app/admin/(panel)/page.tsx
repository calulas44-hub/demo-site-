import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { getFinanceOverview, periodFromSearch } from "@/lib/accounting";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";
import { isSmtpConfigured } from "@/lib/email";
import { isStripeConfigured } from "@/lib/stripe";

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const period = periodFromSearch("month");
  const [overview, recentOrders, lowStock, pendingTransfer, bankCount, productsCount] = await Promise.all([
    getFinanceOverview(period),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { items: true } }),
    prisma.productVariant.findMany({ where: { active: true, product: { status: "ACTIVE" } }, include: { product: { select: { name: true, id: true } } }, orderBy: { stock: "asc" }, take: 50 }),
    prisma.order.count({ where: { paymentMethod: "BANK_TRANSFER", paymentStatus: "PENDING", status: "PENDING_PAYMENT" } }),
    prisma.bankAccount.count({ where: { isActive: true } }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
  ]);
  const low = lowStock.filter((v) => v.stock <= v.lowStockThreshold);

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Tableau de bord</h1>
          <p>Activité du mois en cours.</p>
        </div>
        <div className="adm-actions">
          <Link href="/admin/produits/nouveau" className="btn-a">
            + Nouveau parfum
          </Link>
          <Link href="/admin/commandes" className="btn-a btn-a--ghost">
            Commandes
          </Link>
        </div>
      </div>

      {sp.error === "forbidden" && <p className="msg msg--err">Vous n&apos;avez pas les droits nécessaires pour cette section.</p>}

      {(!isSmtpConfigured() || !isStripeConfigured() || bankCount === 0) && (
        <div className="panel panel--warn">
          <h3>Configuration à terminer</h3>
          <ul style={{ paddingLeft: "1.2rem", listStyle: "disc", fontSize: ".88rem" }}>
            {!isStripeConfigured() && (
              <li>
                <strong>Paiement par carte</strong> : non activé (clés Stripe absentes). Le virement bancaire est proposé aux clients. Voir <code>docs/03-deploiement.md</code>.
              </li>
            )}
            {!isSmtpConfigured() && (
              <li>
                <strong>E-mails</strong> : SMTP non configuré. Les e-mails sont journalisés dans « E-mails envoyés » mais ne partent pas.
              </li>
            )}
            {bankCount === 0 && (
              <li>
                <strong>Coordonnées bancaires</strong> : aucun compte actif. <Link href="/admin/banque">Ajouter un IBAN</Link> pour le paiement par virement.
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="kpis">
        <div className="kpi">
          <div className="kpi__label">Chiffre d&apos;affaires TTC</div>
          <div className="kpi__value">{formatPrice(overview.revenueTtc)}</div>
          <div className="kpi__sub">{formatPrice(overview.revenueHt)} HT · {overview.invoicesCount} facture(s)</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Commandes payées</div>
          <div className="kpi__value">{overview.ordersCount}</div>
          <div className="kpi__sub">Panier moyen {formatPrice(overview.averageBasket)}</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">À traiter</div>
          <div className="kpi__value">{overview.pendingOrders}</div>
          <div className="kpi__sub">{pendingTransfer} virement(s) attendu(s)</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Catalogue</div>
          <div className="kpi__value">{productsCount}</div>
          <div className="kpi__sub">{low.length} référence(s) en stock bas</div>
        </div>
      </div>

      <div className="grid-side">
        <div className="panel">
          <h2>Dernières commandes</h2>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Aucune commande pour le moment.
                    </td>
                  </tr>
                )}
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/commandes/${o.id}`} className="row-link">
                        {o.number}
                      </Link>
                    </td>
                    <td>
                      {o.shipFirstName} {o.shipLastName}
                      <br />
                      <span className="muted small">{o.email}</span>
                    </td>
                    <td>{o.createdAt.toLocaleDateString("fr-FR")}</td>
                    <td>
                      <span className={`pill pill--${o.status}`}>{ORDER_STATUS_LABELS[o.status as OrderStatus]}</span>
                    </td>
                    <td className="num">{formatPrice(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <h2>Stock bas</h2>
          {low.length === 0 ? (
            <p className="muted">Tous les stocks sont au-dessus du seuil d&apos;alerte.</p>
          ) : (
            <table className="tbl">
              <tbody>
                {low.slice(0, 10).map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/admin/produits/${v.product.id}`} className="row-link">
                        {v.product.name}
                      </Link>
                      <br />
                      <span className="muted small">{v.label}</span>
                    </td>
                    <td className="num">
                      <span className={`pill ${v.stock === 0 ? "pill--err" : "pill--warn"}`}>{v.stock === 0 ? "Épuisé" : `${v.stock} restant(s)`}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
