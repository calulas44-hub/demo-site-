import Link from "next/link";
import { prisma } from "@/lib/db";
import { isSmtpConfigured } from "@/lib/email";

export default async function EmailsPage() {
  const logs = await prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { order: { select: { id: true, number: true } } } });
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>E-mails envoyés</h1>
          <p>Journal des e-mails transactionnels (confirmations, expéditions, bienvenue, contact).</p>
        </div>
      </div>
      {!isSmtpConfigured() && <p className="msg msg--info">SMTP non configuré : les e-mails sont journalisés avec le statut « Non envoyé ». Renseignez SMTP_HOST, SMTP_USER, SMTP_PASS et SMTP_FROM dans l&apos;environnement.</p>}
      <div className="panel">
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Destinataire</th>
              <th>Sujet</th>
              <th>Commande</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.createdAt.toLocaleString("fr-FR")}</td>
                <td>{l.to}</td>
                <td>{l.subject}</td>
                <td>{l.order ? <Link href={`/admin/commandes/${l.order.id}`}>{l.order.number}</Link> : "—"}</td>
                <td>
                  <span className={`pill pill--${l.status}`}>{l.status === "SENT" ? "Envoyé" : l.status === "SKIPPED" ? "Non envoyé" : "Échec"}</span>
                  {l.error && <div className="muted small">{l.error}</div>}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Aucun e-mail pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
