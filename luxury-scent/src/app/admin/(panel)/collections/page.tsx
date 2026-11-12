import Link from "next/link";
import { prisma } from "@/lib/db";
import { CollectionForm } from "@/components/admin/taxonomy-forms";
import { ConfirmButton } from "@/components/admin/ui";
import { deleteCollectionAction } from "@/lib/admin-actions/catalog";

export default async function CollectionsAdminPage({ searchParams }: { searchParams: Promise<{ modifier?: string; ok?: string }> }) {
  const sp = await searchParams;
  const collections = await prisma.collection.findMany({ orderBy: [{ position: "asc" }], include: { _count: { select: { products: true } } } });
  const editing = sp.modifier ? collections.find((c) => c.id === sp.modifier) : undefined;
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Collections</h1>
          <p>Univers éditoriaux : page dédiée avec bandeau, texte et produits.</p>
        </div>
      </div>
      {sp.ok && <p className="msg msg--ok">Collection enregistrée.</p>}
      <div className="grid-side">
        <div className="panel">
          <table className="tbl">
            <thead>
              <tr>
                <th></th>
                <th>Nom</th>
                <th>Produits</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {collections.map((c) => (
                <tr key={c.id}>
                  <td>{c.imageUrl ? <img className="thumb" src={c.imageUrl} alt="" /> : <span className="thumb" />}</td>
                  <td>
                    <Link href={`/admin/collections?modifier=${c.id}`} className="row-link">
                      {c.name}
                    </Link>
                    <br />
                    <span className="muted small">{c.tagline}</span>
                  </td>
                  <td>{c._count.products}</td>
                  <td>
                    <span className={`pill ${c.active ? "pill--ok" : "pill--err"}`}>{c.active ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="ta-r">
                    <form action={deleteCollectionAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <ConfirmButton message={`Supprimer la collection « ${c.name} » ?`}>Supprimer</ConfirmButton>
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
              <Link href="/admin/collections" className="btn-a btn-a--ghost btn-a--sm">
                + Nouvelle collection
              </Link>
            </p>
          )}
          <CollectionForm key={editing?.id ?? "new"} collection={editing} />
        </div>
      </div>
    </>
  );
}
