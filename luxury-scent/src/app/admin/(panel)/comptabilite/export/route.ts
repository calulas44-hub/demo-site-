import { getAdminSession, canManageFinance } from "@/lib/auth";
import { exportExpensesCsv, exportLedgerCsv, exportSalesCsv, exportWorkbook, periodFromSearch } from "@/lib/accounting";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session || !canManageFinance(session.role)) return new Response("Non autorisé", { status: 401 });
  const url = new URL(request.url);
  const period = periodFromSearch(url.searchParams.get("periode") ?? undefined, url.searchParams.get("du") ?? undefined, url.searchParams.get("au") ?? undefined);
  const format = url.searchParams.get("format") ?? "xlsx";
  const stamp = `${period.from.toISOString().slice(0, 10)}_${period.to.toISOString().slice(0, 10)}`;
  const csv = (body: string, name: string) => new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}-${stamp}.csv"` } });
  if (format === "ventes") return csv(await exportSalesCsv(period), "ventes");
  if (format === "depenses") return csv(await exportExpensesCsv(period), "depenses");
  if (format === "journal") return csv(await exportLedgerCsv(period), "journal");
  const buffer = await exportWorkbook(period);
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="comptabilite-${stamp}.xlsx"` },
  });
}
