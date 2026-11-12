import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getBankAudits, listBankAccounts } from "@/lib/bank";
import { BankAccountForm, BankOpForm } from "@/components/admin/bank-forms";

export default async function BankPage({ searchParams }: { searchParams: Promise<{ modifier?: string; ok?: string }> }) {
  await requireAdmin(["OWNER"]);
  const sp = await searchParams;
  const [accounts, audits] = await Promise.all([listBankAccounts(), getBankAudits(40)]);
  const editing = sp.modifier ? accounts.find((a) => a.id === sp.modifier) : undefined;
  const keyOk = /^[0-9a-fA-F]{64}$/.test(process.env.BANK_ENCRYPTION_KEY ?? "");
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Coordonnées bancaires</h1>
          <p>IBAN et BIC utilisés pour les paiements par virement et imprimés sur les factures. Chiffrés en base, accès réservé au propriétaire, chaque action est tracée.</p>
        </div>
      </div>
      {!keyOk && <p className="msg msg--err">BANK_ENCRYPTION_KEY est absente ou invalide : impossible de chiffrer ou lire les IBAN. Générez-la avec <code>openssl rand -hex 32</code> et ajoutez-la à l&apos;environnement.</p>}
      {sp.ok && <p className="msg msg--ok">Coordonnées enregistrées.</p>}
      <div className="grid-side">
        <div>
          <div className="panel">
            <h2>Comptes enregistrés</h2>
            {accounts.length === 0 && <p className="muted">Aucun compte. Ajoutez votre IBAN pour proposer le paiement par virement.</p>}
            {accounts.map((a) => (
              <div key={a.id} style={{ padding: "1rem 0", borderBottom: "1px solid var(--a-line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div>
                    <strong>{a.label}</strong> {a.isActive && <span className="pill pill--ok">Actif</span>}
                    <br />
                    <span className="small">
                      {a.holderName}
                      {a.bankName ? ` · ${a.bankName}` : ""}
                    </span>
                    <br />
                    <span className="mono small">{a.ibanMasked}</span>
                    {a.hasBic ? <span className="muted small"> · BIC enregistré</span> : null}
                    <br />
                    <span className="muted small">
                      {a.showOnInvoice ? "Affiché sur les factures" : "Non affiché sur les factures"} · modifié le {a.updatedAt.toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  <Link href={`/admin/banque?modifier=${a.id}`} className="btn-a btn-a--ghost btn-a--sm">
                    Modifier
                  </Link>
                </div>
                <div style={{ display: "grid", gap: ".5rem", marginTop: ".8rem" }}>
                  <BankOpForm id={a.id} op="reveal" label="Afficher l'IBAN complet" />
                  {!a.isActive && <BankOpForm id={a.id} op="activate" label="Définir comme compte actif" className="btn-a btn-a--sm" />}
                  {!a.isActive && <BankOpForm id={a.id} op="delete" label="Supprimer" className="btn-a btn-a--danger btn-a--sm" confirmMessage={`Supprimer le compte « ${a.label} » ?`} />}
                </div>
              </div>
            ))}
          </div>
          <div className="panel">
            <h2>Historique des accès et modifications</h2>
            <table className="tbl">
              <tbody>
                {audits.map((x) => (
                  <tr key={x.id}>
                    <td className="small">{x.createdAt.toLocaleString("fr-FR")}</td>
                    <td className="small">{x.adminUser?.name ?? "—"}</td>
                    <td>
                      <span className="pill">{x.action}</span>
                    </td>
                    <td className="small">
                      {x.bankAccount?.label ?? ""}
                      {x.details && <div className="muted mono" style={{ fontSize: ".7rem", wordBreak: "break-all" }}>{x.details}</div>}
                    </td>
                  </tr>
                ))}
                {audits.length === 0 && (
                  <tr>
                    <td className="muted">Aucune action enregistrée.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          {editing && (
            <p>
              <Link href="/admin/banque" className="btn-a btn-a--ghost btn-a--sm">
                + Ajouter un autre compte
              </Link>
            </p>
          )}
          <BankAccountForm key={editing?.id ?? "new"} account={editing} />
        </div>
      </div>
    </>
  );
}
