import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants";

export function OrderTimeline({ history }: { history: { status: string; note: string | null; createdAt: string }[] }) {
  if (history.length === 0) return null;
  return (
    <div>
      <p className="caps" style={{ marginTop: "2rem" }}>
        Suivi
      </p>
      <ol className="timeline">
        {history.map((h, i) => (
          <li key={i}>
            <time dateTime={h.createdAt}>{new Date(h.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</time>
            <span>
              <strong>{ORDER_STATUS_LABELS[h.status as OrderStatus] ?? h.status}</strong>
              {h.note ? <span className="muted"> — {h.note}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
