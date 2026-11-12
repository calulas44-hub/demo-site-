export function PeriodBar({ basePath, preset, from, to }: { basePath: string; preset: string; from: Date; to: Date }) {
  const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const presets: [string, string][] = [
    ["today", "Aujourd'hui"],
    ["7d", "7 jours"],
    ["month", "Ce mois"],
    ["last_month", "Mois dernier"],
    ["year", "Cette année"],
  ];
  return (
    <form method="get" action={basePath} className="filters-bar">
      {presets.map(([k, label]) => (
        <a key={k} href={`${basePath}?periode=${k}`} className={`btn-a btn-a--sm ${preset === k ? "" : "btn-a--ghost"}`}>
          {label}
        </a>
      ))}
      <input type="hidden" name="periode" value="custom" />
      <input type="date" name="du" defaultValue={iso(from)} className="f-input" style={{ width: "auto" }} />
      <input type="date" name="au" defaultValue={iso(to)} className="f-input" style={{ width: "auto" }} />
      <button type="submit" className="btn-a btn-a--ghost btn-a--sm">
        Appliquer
      </button>
    </form>
  );
}
