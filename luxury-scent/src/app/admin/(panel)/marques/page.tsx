import Link from "next/link";
import { prisma } from "@/lib/db";
import { BrandForm } from "@/components/admin/taxonomy-forms";
import { ConfirmButton } from "@/components/admin/ui";
import { deleteBrandAction } from "@/lib/admin-actions/catalog";

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ modifier?: string; ok?: string }> }) {
  const sp = await searchParams;
  const brands = await prisma.brand.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });
  const editing = sp.modifier ? brands.find((b) => b.id === sp.modifier) : undefined;
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Marques</h1>
          <p>Filtre « Marque » du catalogue et pages /marques/…</p>
        </div>
      </div>
      {sp.ok && <p className="msg msg--ok">Marque enregistrée.</p>}
      <div className="grid-side">
        <div className="panel">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Produits</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link href={`/admin/marques?modifier=${b.id}`} className="row-link">
                      {b.name}
                    </Link>
                  </td>
                  <td>{b._count.products}</td>
                  <td>
                    <span className={`pill ${b.active ? "pill--ok" : "pill--err"}`}>{b.active ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="ta-r">
                    <form action={deleteBrandAction}>
                      <input type="hidden" name="id" value={b.id} />
                      <ConfirmButton message={`Supprimer la marque « ${b.name} » ?`}>Supprimer</ConfirmButton>
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
              <Link href="/admin/marques" className="btn-a btn-a--ghost btn-a--sm">
                + Nouvelle marque
              </Link>
            </p>
          )}
          <BrandForm key={editing?.id ?? "new"} brand={editing} />
        </div>
      </div>
    </>
  );
}
