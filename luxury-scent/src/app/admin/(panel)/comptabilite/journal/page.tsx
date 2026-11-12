import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { periodFromSearch } from "@/lib/accounting";
import { PeriodBar } from "@/components/admin/period-bar";

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ periode?: string; du?: string; au?: string; journal?: string }> }) {
  await requireAdmin(["OWNER", "ADMIN"]);
  const sp = await searchParams;
  const period = periodFromSearch(sp.periode, sp.du, sp.au);
  const entries = await prisma.ledgerEntry.findMany({ where: { date: { gte: period.from, lte: period.to }, ...(sp.journal ? { journal: sp.journal } : {}) }, orderBy: [{ date: "asc" }, { createdAt: "asc" }], take: 2000 });
  const debit = entries.reduce((s, e) => s + e.debit, 0);
  const credit = entries.reduce((s, e) => s + e.credit, 0);
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Journal</h1>
          <p>
            <Link href="/admin/comptabilite">← Comptabilité</Link> · {entries.length} écriture(s) · Débit {formatPrice(debit)} · Crédit {formatPrice(credit)}
            {debit !== credit && <span className="pill pill--err" style={{ marginLeft: ".5rem" }}>Déséquilibre</span>}
          </p>
        </div>
        <a href={`/admin/comptabilite/export?format=journal&periode=${period.preset}&du=${period.from.toISOString().slice(0, 10)}&au=${period.to.toISOString().slice(0, 10)}`} className="btn-a">
          Export CSV
        </a>
      </div>
      <PeriodBar basePath="/admin/comptabilite/journal" preset={period.preset} from={period.from} to={period.to} />
      <div className="filters-bar">
        {["", "VENTES", "ACHATS", "BANQUE"].map((j) => (
          <a key={j} href={`/admin/comptabilite/journal?periode=${period.preset}${j ? `&journal=${j}` : ""}`} className={`btn-a btn-a--sm ${(sp.journal ?? "") === j ? "" : "btn-a--ghost"}`}>
            {j || "Tous"}
          </a>
        ))}
      </div>
      <div className="panel">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Journal</th>
                <th>Compte</th>
                <th>Libellé</th>
                <th>Pièce</th>
                <th className="num">Débit</th>
                <th className="num">Crédit</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{e.date.toLocaleDateString("fr-FR")}</td>
                  <td>{e.journal}</td>
                  <td className="mono">{e.account}</td>
                  <td>{e.label}</td>
                  <td className="mono">{e.reference ?? ""}</td>
                  <td className="num">{e.debit ? formatPrice(e.debit) : ""}</td>
                  <td className="num">{e.credit ? formatPrice(e.credit) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
