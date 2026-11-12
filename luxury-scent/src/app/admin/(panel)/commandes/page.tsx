import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus, type PaymentMethod } from "@/lib/constants";

const PER_PAGE = 30;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; statut?: string; paiement?: string; page?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.OrderWhereInput = {};
  if (q) where.OR = [{ number: { contains: q } }, { email: { contains: q } }, { shipLastName: { contains: q } }, { shipFirstName: { contains: q } }];
  if (sp.statut) where.status = sp.statut;
  if (sp.paiement) where.paymentStatus = sp.paiement;
  const [orders, total, counts] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, include: { items: true }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const pages = Math.ceil(total / PER_PAGE);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Commandes</h1>
          <p>
            {countOf("PENDING_PAYMENT")} en attente de paiement · {countOf("PAID")} à préparer · {countOf("PREPARING")} en préparation · {countOf("SHIPPED")} expédiées
          </p>
        </div>
      </div>
      <form className="filters-bar" method="get">
        <input type="search" name="q" placeholder="N° de commande, nom, e-mail…" defaultValue={q} />
        <select name="statut" defaultValue={sp.statut ?? ""}>
          <option value="">Tous les statuts</option>
          {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="paiement" defaultValue={sp.paiement ?? ""}>
          <option value="">Tout paiement</option>
          {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-a btn-a--ghost btn-a--sm">
          Filtrer
        </button>
      </form>
      <div className="panel">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>N°</th>
                <th>Date</th>
                <th>Client</th>
                <th>Articles</th>
                <th>Paiement</th>
                <th>Statut</th>
                <th className="num">Total TTC</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/commandes/${o.id}`} className="row-link">
                      {o.number}
                    </Link>
                  </td>
                  <td>{o.createdAt.toLocaleDateString("fr-FR")}</td>
                  <td>
                    {o.shipFirstName} {o.shipLastName}
                    <br />
                    <span className="muted small">{o.email}</span>
                  </td>
                  <td>{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td>
                    {PAYMENT_METHOD_LABELS[o.paymentMethod as PaymentMethod]}
                    <br />
                    <span className={`pill pill--${o.paymentStatus}`}>{PAYMENT_STATUS_LABELS[o.paymentStatus as keyof typeof PAYMENT_STATUS_LABELS]}</span>
                  </td>
                  <td>
                    <span className={`pill pill--${o.status}`}>{ORDER_STATUS_LABELS[o.status as OrderStatus]}</span>
                  </td>
                  <td className="num">{formatPrice(o.total)}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    Aucune commande.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <nav className="pager">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) =>
              n === page ? (
                <span key={n} aria-current="page">
                  {n}
                </span>
              ) : (
                <Link key={n} href={`/admin/commandes?${new URLSearchParams({ ...(q ? { q } : {}), ...(sp.statut ? { statut: sp.statut } : {}), ...(sp.paiement ? { paiement: sp.paiement } : {}), page: String(n) })}`}>
                  {n}
                </Link>
              ),
            )}
          </nav>
        )}
      </div>
    </>
  );
}
