import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { ShippingForm } from "@/components/admin/shipping-form";
import { ConfirmButton } from "@/components/admin/ui";
import { deleteShippingMethodAction } from "@/lib/admin-actions/settings";

export default async function ShippingPage({ searchParams }: { searchParams: Promise<{ modifier?: string; ok?: string }> }) {
  await requireAdmin(["OWNER", "ADMIN"]);
  const sp = await searchParams;
  const methods = await prisma.shippingMethod.findMany({ orderBy: { position: "asc" } });
  const editing = sp.modifier ? methods.find((m) => m.id === sp.modifier) : undefined;
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Modes de livraison</h1>
          <p>Tarifs, seuils de gratuité et pays desservis, proposés à l&apos;étape « Livraison » de la commande.</p>
        </div>
      </div>
      {sp.ok && <p className="msg msg--ok">Mode de livraison enregistré.</p>}
      <div className="grid-side">
        <div className="panel">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Pays</th>
                <th className="num">Prix</th>
                <th>Offert dès</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/admin/livraison?modifier=${m.id}`} className="row-link">
                      {m.name}
                    </Link>
                    <br />
                    <span className="muted small">{m.description}</span>
                  </td>
                  <td className="mono small">{m.countries}</td>
                  <td className="num">{formatPrice(m.price)}</td>
                  <td>{m.freeAbove !== null ? formatPrice(m.freeAbove) : "—"}</td>
                  <td>
                    <span className={`pill ${m.active ? "pill--ok" : "pill--err"}`}>{m.active ? "Actif" : "Inactif"}</span>
                  </td>
                  <td className="ta-r">
                    <form action={deleteShippingMethodAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <ConfirmButton message={`Supprimer « ${m.name} » ?`}>Supprimer</ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          {editing && (
            <p>
              <Link href="/admin/livraison" className="btn-a btn-a--ghost btn-a--sm">
                + Nouveau mode
              </Link>
            </p>
          )}
          <ShippingForm key={editing?.id ?? "new"} method={editing} />
        </div>
      </div>
    </>
  );
}
