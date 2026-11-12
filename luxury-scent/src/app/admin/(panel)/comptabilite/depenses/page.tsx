import { receiptHref } from "@/lib/media-url";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatPrice } from "@/lib/money";
import { periodFromSearch } from "@/lib/accounting";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/constants";
import { ExpenseForm } from "@/components/admin/expense-form";
import { PeriodBar } from "@/components/admin/period-bar";
import { ConfirmButton } from "@/components/admin/ui";
import { deleteExpenseAction } from "@/lib/admin-actions/finance";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ periode?: string; du?: string; au?: string; modifier?: string; ok?: string }> }) {
  await requireAdmin(["OWNER", "ADMIN"]);
  const sp = await searchParams;
  const period = periodFromSearch(sp.periode ?? "year", sp.du, sp.au);
  const [expenses, settings] = await Promise.all([prisma.expense.findMany({ where: { date: { gte: period.from, lte: period.to } }, orderBy: { date: "desc" } }), getSettings()]);
  const editing = sp.modifier ? await prisma.expense.findUnique({ where: { id: sp.modifier } }) : null;
  const totals = expenses.reduce((a, e) => ({ ht: a.ht + e.amountHt, tva: a.tva + e.vatAmount, ttc: a.ttc + e.amountTtc }), { ht: 0, tva: 0, ttc: 0 });
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Dépenses et achats</h1>
          <p>
            <Link href="/admin/comptabilite">← Comptabilité</Link> · {expenses.length} dépense(s) · {formatPrice(totals.ht)} HT · {formatPrice(totals.ttc)} TTC
          </p>
        </div>
      </div>
      {sp.ok && <p className="msg msg--ok">Dépense enregistrée.</p>}
      <PeriodBar basePath="/admin/comptabilite/depenses" preset={period.preset} from={period.from} to={period.to} />
      <div className="grid-side">
        <div className="panel">
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Libellé</th>
                  <th>Catégorie</th>
                  <th className="num">HT</th>
                  <th className="num">TVA</th>
                  <th className="num">TTC</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td>{e.date.toLocaleDateString("fr-FR")}</td>
                    <td>
                      <Link href={`/admin/comptabilite/depenses?modifier=${e.id}&periode=${period.preset}`} className="row-link">
                        {e.label}
                      </Link>
                      <br />
                      <span className="muted small">
                        {e.supplier ?? ""}
                        {e.invoiceNumber ? ` · ${e.invoiceNumber}` : ""}
                        {e.receiptUrl && (
                          <>
                            {" · "}
                            <a href={receiptHref(e.receiptUrl)} target="_blank" rel="noopener">
                              justificatif
                            </a>
                          </>
                        )}
                      </span>
                    </td>
                    <td>{EXPENSE_CATEGORY_LABELS[e.category as ExpenseCategory] ?? e.category}</td>
                    <td className="num">{formatPrice(e.amountHt)}</td>
                    <td className="num">{formatPrice(e.vatAmount)}</td>
                    <td className="num">{formatPrice(e.amountTtc)}</td>
                    <td className="ta-r">
                      <form action={deleteExpenseAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <ConfirmButton message="Supprimer cette dépense et ses écritures ?">×</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="muted">
                      Aucune dépense sur la période.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          {editing && (
            <p>
              <Link href="/admin/comptabilite/depenses" className="btn-a btn-a--ghost btn-a--sm">
                + Nouvelle dépense
              </Link>
            </p>
          )}
          <ExpenseForm key={editing?.id ?? "new"} expense={editing ?? undefined} defaultVat={settings.vatRate} />
        </div>
      </div>
    </>
  );
}
