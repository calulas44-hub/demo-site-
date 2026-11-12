import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function PagesAdminPage() {
  const pages = await prisma.page.findMany({ orderBy: [{ position: "asc" }, { title: "asc" }] });
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Pages</h1>
          <p>Conditions générales, mentions légales, livraison, FAQ, histoire de la Maison…</p>
        </div>
        <Link href="/admin/pages/nouvelle" className="btn-a">
          + Nouvelle page
        </Link>
      </div>
      <div className="panel">
        <table className="tbl">
          <thead>
            <tr>
              <th>Titre</th>
              <th>Adresse</th>
              <th>Pied de page</th>
              <th>Statut</th>
              <th>Modifiée</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/pages/${p.id}`} className="row-link">
                    {p.title}
                  </Link>
                  {p.system && <span className="pill" style={{ marginLeft: ".5rem" }}>Requise</span>}
                </td>
                <td className="muted">/pages/{p.slug}</td>
                <td>{p.showInFooter ? "Oui" : "Non"}</td>
                <td>
                  <span className={`pill ${p.published ? "pill--ok" : "pill--warn"}`}>{p.published ? "Publiée" : "Brouillon"}</span>
                </td>
                <td>{p.updatedAt.toLocaleDateString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
