import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.customer.findUnique({ where: { id }, include: { addresses: true, orders: { orderBy: { createdAt: "desc" } } } });
  if (!c) notFound();
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>
            {c.firstName} {c.lastName}
          </h1>
          <p>
            <Link href="/admin/clients">← Clients</Link> · <a href={`mailto:${c.email}`}>{c.email}</a>
            {c.phone ? ` · ${c.phone}` : ""} · inscrit le {c.createdAt.toLocaleDateString("fr-FR")}
            {c.newsletter ? " · abonné à la newsletter" : ""}
          </p>
        </div>
      </div>
      <div className="grid-side">
        <div className="panel">
          <h2>Commandes</h2>
          <table className="tbl">
            <thead>
              <tr>
                <th>N°</th>
                <th>Date</th>
                <th>Statut</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {c.orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/commandes/${o.id}`} className="row-link">
                      {o.number}
                    </Link>
                  </td>
                  <td>{o.createdAt.toLocaleDateString("fr-FR")}</td>
                  <td>
                    <span className={`pill pill--${o.status}`}>{ORDER_STATUS_LABELS[o.status as OrderStatus]}</span>
                  </td>
                  <td className="num">{formatPrice(o.total)}</td>
                </tr>
              ))}
              {c.orders.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Aucune commande.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3>Adresses</h3>
          {c.addresses.length === 0 && <p className="muted">Aucune adresse enregistrée.</p>}
          {c.addresses.map((a) => (
            <p key={a.id} className="small">
              <strong>{a.label ?? "Adresse"}</strong>
              {a.isDefault ? " (par défaut)" : ""}
              <br />
              {a.firstName} {a.lastName}
              <br />
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ""}
              <br />
              {a.postalCode} {a.city}, {a.country}
            </p>
          ))}
        </div>
      </div>
    </>
  );
}
