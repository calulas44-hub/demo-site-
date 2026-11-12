import Link from "next/link";
import { prisma } from "@/lib/db";
import { CategoryForm } from "@/components/admin/taxonomy-forms";
import { ConfirmButton } from "@/components/admin/ui";
import { deleteCategoryAction } from "@/lib/admin-actions/catalog";

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ modifier?: string; ok?: string }> }) {
  const sp = await searchParams;
  const categories = await prisma.category.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], include: { parent: true, _count: { select: { products: true } } } });
  const editing = sp.modifier ? categories.find((c) => c.id === sp.modifier) : undefined;
  const parents = categories.filter((c) => !c.parentId).map((c) => ({ id: c.id, name: c.name }));
  const ordered = [...categories.filter((c) => !c.parentId).flatMap((p) => [p, ...categories.filter((c) => c.parentId === p.id)]), ...categories.filter((c) => c.parentId && !categories.some((p) => p.id === c.parentId))];
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Catégories</h1>
          <p>Organisent le catalogue et le menu principal.</p>
        </div>
      </div>
      {sp.ok && <p className="msg msg--ok">Catégorie enregistrée.</p>}
      <div className="grid-side">
        <div className="panel">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Produits</th>
                <th>Menu</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.parentId ? <span className="muted">— </span> : null}
                    <Link href={`/admin/categories?modifier=${c.id}`} className="row-link">
                      {c.name}
                    </Link>
                    <br />
                    <span className="muted small">/categories/{c.slug}</span>
                  </td>
                  <td>{c._count.products}</td>
                  <td>{c.showInMenu ? "Oui" : "Non"}</td>
                  <td>
                    <span className={`pill ${c.active ? "pill--ok" : "pill--err"}`}>{c.active ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="ta-r">
                    <form action={deleteCategoryAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <ConfirmButton message={`Supprimer la catégorie « ${c.name} » ? Les produits ne seront pas supprimés.`}>Supprimer</ConfirmButton>
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
              <Link href="/admin/categories" className="btn-a btn-a--ghost btn-a--sm">
                + Nouvelle catégorie
              </Link>
            </p>
          )}
          <CategoryForm key={editing?.id ?? "new"} category={editing} parents={parents} />
        </div>
      </div>
    </>
  );
}
