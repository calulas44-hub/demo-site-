import { prisma } from "@/lib/db";
import { ConfirmButton } from "@/components/admin/ui";
import { deleteSubscriberAction } from "@/lib/admin-actions/content";

export default async function NewsletterPage() {
  const subs = await prisma.newsletterSubscriber.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Newsletter</h1>
          <p>{subs.length} abonné(s). Exportez la liste pour votre outil d&apos;e-mailing.</p>
        </div>
        <a href="/admin/newsletter/export" className="btn-a btn-a--ghost">
          Exporter en CSV
        </a>
      </div>
      <div className="panel">
        <table className="tbl">
          <thead>
            <tr>
              <th>E-mail</th>
              <th>Inscription</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id}>
                <td>{s.email}</td>
                <td>{s.createdAt.toLocaleDateString("fr-FR")}</td>
                <td className="ta-r">
                  <form action={deleteSubscriberAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <ConfirmButton message="Désinscrire cette adresse ?">Désinscrire</ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
