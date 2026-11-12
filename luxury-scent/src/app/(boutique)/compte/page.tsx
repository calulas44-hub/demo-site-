import type { Metadata } from "next";
import Link from "next/link";
import { requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";

export const metadata: Metadata = { title: "Mon compte", robots: { index: false } };

export default async function AccountPage() {
  const session = await requireCustomer();
  const orders = await prisma.order.findMany({ where: { customerId: session.id }, orderBy: { createdAt: "desc" }, include: { items: true, invoice: true } });
  return (
    <div>
      <h2 style={{ marginBottom: "1.2rem" }}>Mes commandes</h2>
      {orders.length === 0 ? (
        <p className="muted">
          Vous n&apos;avez pas encore de commande.{" "}
          <Link href="/parfums" style={{ textDecoration: "underline" }}>
            Découvrir les parfums
          </Link>
        </p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Commande</th>
              <th>Date</th>
              <th>Statut</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/compte/commandes/${o.number}`} style={{ textDecoration: "underline" }}>
                    {o.number}
                  </Link>
                  <br />
                  <span className="muted small">
                    {o.items.length} article{o.items.length > 1 ? "s" : ""}
                  </span>
                </td>
                <td>{o.createdAt.toLocaleDateString("fr-FR")}</td>
                <td>
                  <span className={`status status--${o.status}`}>{ORDER_STATUS_LABELS[o.status as OrderStatus]}</span>
                </td>
                <td>{formatPrice(o.total)}</td>
                <td>{o.invoice && <a href={`/compte/commandes/${o.number}/facture`}>Facture</a>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
