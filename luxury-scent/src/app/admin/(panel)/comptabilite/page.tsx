import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getFinanceOverview, periodFromSearch } from "@/lib/accounting";
import { formatPrice } from "@/lib/money";
import { PeriodBar } from "@/components/admin/period-bar";
import { rebuildLedgerAction } from "@/lib/admin-actions/finance";

export default async function AccountingPage({ searchParams }: { searchParams: Promise<{ periode?: string; du?: string; au?: string }> }) {
  await requireAdmin(["OWNER", "ADMIN"]);
  const sp = await searchParams;
  const period = periodFromSearch(sp.periode, sp.du, sp.au);
  const o = await getFinanceOverview(period);
  const qs = `periode=${period.preset}&du=${period.from.toISOString().slice(0, 10)}&au=${period.to.toISOString().slice(0, 10)}`;
  const maxSeries = Math.max(1, ...o.series.map((s) => s.total));
  const maxExp = Math.max(1, ...o.expensesByCategory.map((e) => e.amountHt));

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Comptabilité et finances</h1>
          <p>
            Suivi de gestion interne : du {period.from.toLocaleDateString("fr-FR")} au {period.to.toLocaleDateString("fr-FR")}.
          </p>
        </div>
        <div className="adm-actions">
          <Link href="/admin/comptabilite/depenses" className="btn-a btn-a--ghost">
            Dépenses
          </Link>
          <Link href="/admin/comptabilite/journal" className="btn-a btn-a--ghost">
            Journal
          </Link>
          <a href={`/admin/comptabilite/export?format=xlsx&${qs}`} className="btn-a">
            Export Excel
          </a>
        </div>
      </div>
      <PeriodBar basePath="/admin/comptabilite" preset={period.preset} from={period.from} to={period.to} />

      <div className="kpis">
        <div className="kpi">
          <div className="kpi__label">Ventes TTC</div>
          <div className="kpi__value">{formatPrice(o.revenueTtc)}</div>
          <div className="kpi__sub">{formatPrice(o.revenueHt)} HT · {o.invoicesCount} facture(s)</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Dépenses HT</div>
          <div className="kpi__value">{formatPrice(o.expensesHt)}</div>
          <div className="kpi__sub">{formatPrice(o.expensesTtc)} TTC</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Marge brute</div>
          <div className="kpi__value">{formatPrice(o.grossMargin)}</div>
          <div className="kpi__sub">{o.grossMarginRate.toFixed(1)} % des ventes HT (coûts d&apos;achat renseignés)</div>
        </div>
        <div className="kpi">
          <div className="kpi__label">Résultat de gestion</div>
          <div className="kpi__value" style={{ color: o.result < 0 ? "var(--a-danger)" : undefined }}>
            {formatPrice(o.result)}
          </div>
          <div className="kpi__sub">Ventes HT − avoirs HT − dépenses HT</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <h2>Ventes encaissées par jour</h2>
          {o.series.length === 0 ? (
            <p className="muted">Aucune vente encaissée sur la période.</p>
          ) : (
            <div className="chart" aria-label="Ventes par jour">
              {o.series.map((s) => (
                <span key={s.date} style={{ height: `${Math.max(3, (s.total / maxSeries) * 100)}%` }} data-label={`${new Date(s.date).toLocaleDateString("fr-FR")} : ${formatPrice(s.total)}`} />
              ))}
            </div>
          )}
          <div className="grid-3 mt small">
            <div>
              <div className="muted">Commandes payées</div>
              <strong>{o.ordersCount}</strong>
            </div>
            <div>
              <div className="muted">Panier moyen</div>
              <strong>{formatPrice(o.averageBasket)}</strong>
            </div>
            <div>
              <div className="muted">En attente de paiement</div>
              <strong>{o.pendingOrders}</strong>
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>TVA</h2>
          <table className="tbl">
            <tbody>
              <tr>
                <td>TVA collectée (ventes)</td>
                <td className="num">{formatPrice(o.vatCollected)}</td>
              </tr>
              <tr>
                <td>TVA sur avoirs</td>
                <td className="num">− {formatPrice(o.creditTva)}</td>
              </tr>
              <tr>
                <td>TVA déductible (dépenses)</td>
                <td className="num">− {formatPrice(o.vatDeductible)}</td>
              </tr>
              <tr>
                <td>
                  <strong>TVA nette à reverser</strong>
                </td>
                <td className="num">
                  <strong>{formatPrice(o.vatBalance)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
          <h3 className="mt">Avoirs et remboursements</h3>
          <p className="small">
            {formatPrice(o.creditTtc)} TTC ({formatPrice(o.creditHt)} HT)
          </p>
        </div>

        <div className="panel">
          <h2>Dépenses par catégorie (HT)</h2>
          {o.expensesByCategory.length === 0 ? (
            <p className="muted">Aucune dépense enregistrée sur la période.</p>
          ) : (
            <div className="bars">
              {o.expensesByCategory
                .sort((a, b) => b.amountHt - a.amountHt)
                .map((e) => (
                  <div className="bar" key={e.category}>
                    <span className="small">{e.label}</span>
                    <span className="bar__track">
                      <span className="bar__fill" style={{ width: `${(e.amountHt / maxExp) * 100}%` }} />
                    </span>
                    <span className="num small">{formatPrice(e.amountHt)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Marges par produit</h2>
          {o.topProducts.length === 0 ? (
            <p className="muted">Aucune vente payée sur la période.</p>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th className="num">Qté</th>
                  <th className="num">Ventes HT</th>
                  <th className="num">Marge</th>
                </tr>
              </thead>
              <tbody>
                {o.topProducts.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td className="num">{p.quantity}</td>
                    <td className="num">{formatPrice(p.revenueHt)}</td>
                    <td className="num">
                      {formatPrice(p.margin)} <span className="muted small">({p.marginRate.toFixed(0)} %)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel">
        <h2>Exports</h2>
        <p className="small muted">Les exports portent sur la période sélectionnée. Le journal est au format « pièce / compte / débit / crédit », exploitable par un logiciel comptable ou un expert-comptable.</p>
        <div className="adm-actions">
          <a href={`/admin/comptabilite/export?format=xlsx&${qs}`} className="btn-a">
            Classeur Excel complet
          </a>
          <a href={`/admin/comptabilite/export?format=ventes&${qs}`} className="btn-a btn-a--ghost">
            Ventes (CSV)
          </a>
          <a href={`/admin/comptabilite/export?format=depenses&${qs}`} className="btn-a btn-a--ghost">
            Dépenses (CSV)
          </a>
          <a href={`/admin/comptabilite/export?format=journal&${qs}`} className="btn-a btn-a--ghost">
            Journal (CSV)
          </a>
          <form action={rebuildLedgerAction}>
            <button type="submit" className="btn-a btn-a--ghost">
              Recalculer le journal
            </button>
          </form>
        </div>
      </div>
      <p className="muted small">
        Ce module est un outil de suivi de gestion. Il ne remplace pas une comptabilité tenue par un logiciel certifié ou un expert-comptable ; il est conçu pour alimenter l&apos;un ou l&apos;autre par ses exports.
      </p>
    </>
  );
}
