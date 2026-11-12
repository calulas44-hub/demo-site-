import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const customers = await prisma.customer.findMany({
    where: q ? { OR: [{ email: { contains: q } }, { firstName: { contains: q } }, { lastName: { contains: q } }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { orders: { select: { total: true, paymentStatus: true } } },
  });
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Clients</h1>
          <p>{customers.length} client(s)</p>
        </div>
      </div>
      <form className="filters-bar" method="get">
        <input type="search" name="q" placeholder="Nom, e-mail…" defaultValue={q} />
        <button type="submit" className="btn-a btn-a--ghost btn-a--sm">
          Rechercher
        </button>
      </form>
      <div className="panel">
        <table className="tbl">
          <thead>
            <tr>
              <th>Client</th>
              <th>Inscription</th>
              <th>Compte</th>
              <th className="num">Commandes</th>
              <th className="num">Total payé</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const paid = c.orders.filter((o) => o.paymentStatus === "PAID" || o.paymentStatus === "PARTIALLY_REFUNDED");
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/clients/${c.id}`} className="row-link">
                      {c.firstName} {c.lastName}
                    </Link>
                    <br />
                    <span className="muted small">{c.email}</span>
                  </td>
                  <td>{c.createdAt.toLocaleDateString("fr-FR")}</td>
                  <td>{c.passwordHash ? "Oui" : <span className="muted">Invité</span>}</td>
                  <td className="num">{c.orders.length}</td>
                  <td className="num">{formatPrice(paid.reduce((s, o) => s + o.total, 0))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
