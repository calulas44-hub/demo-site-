import Link from "next/link";
import { getFilterOptions, listProducts, type CatalogFilters } from "@/lib/catalog";
import { GENDER_LABELS } from "@/lib/constants";
import { ProductCard } from "./product-card";
import { FiltersForm } from "./filters-form";
import { Reveal } from "./reveal";

export type SearchParams = Record<string, string | string[] | undefined>;

function list(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : v.split(",")).map((s) => s.trim()).filter(Boolean);
}

export function parseCatalogParams(sp: SearchParams): CatalogFilters {
  const sortRaw = typeof sp.tri === "string" ? sp.tri : "featured";
  const sort = ["featured", "price_asc", "price_desc", "newest", "name"].includes(sortRaw) ? (sortRaw as CatalogFilters["sort"]) : "featured";
  const toCents = (v: unknown) => {
    const n = Number(typeof v === "string" ? v.replace(",", ".") : NaN);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
  };
  return {
    brands: list(sp.marque),
    families: list(sp.famille),
    genders: list(sp.genre).filter((g) => ["FEMME", "HOMME", "MIXTE"].includes(g)),
    priceMin: toCents(sp.prix_min),
    priceMax: toCents(sp.prix_max),
    sort,
    page: Math.max(1, Number(sp.page) || 1),
    onlyAvailable: sp.dispo === "1",
  };
}

interface Props {
  basePath: string;
  filters: CatalogFilters;
  searchParams: SearchParams;
  hideGender?: boolean;
}

export async function CatalogList({ basePath, filters, searchParams, hideGender = false }: Props) {
  const [result, options] = await Promise.all([listProducts(filters), getFilterOptions()]);
  const sp = searchParams;

  const activeChips: { label: string; param: string; value: string }[] = [];
  for (const b of filters.brands ?? []) activeChips.push({ label: options.brands.find((x) => x.slug === b)?.name ?? b, param: "marque", value: b });
  for (const f of filters.families ?? []) activeChips.push({ label: f, param: "famille", value: f });
  for (const g of filters.genders ?? []) activeChips.push({ label: GENDER_LABELS[g as keyof typeof GENDER_LABELS] ?? g, param: "genre", value: g });
  if (filters.priceMin != null || filters.priceMax != null) activeChips.push({ label: "Prix", param: "prix", value: "" });
  if (filters.onlyAvailable) activeChips.push({ label: "En stock", param: "dispo", value: "1" });

  const buildUrl = (overrides: Record<string, string | string[] | null>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string | string[] | undefined | null> = { ...sp, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v === null || v === undefined || v === "") continue;
      if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
      else params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const removeChip = (chip: { param: string; value: string }) => {
    if (chip.param === "prix") return buildUrl({ prix_min: null, prix_max: null, page: null });
    const current = list(sp[chip.param]).filter((v) => v !== chip.value);
    return buildUrl({ [chip.param]: current.length ? current : null, page: null });
  };

  return (
    <div className="plp">
      <FiltersForm basePath={basePath}>
        {!hideGender && options.genders.length > 1 && (
          <fieldset className="filters__group">
            <legend>Pour</legend>
            {options.genders.map((g) => (
              <label className="check" key={g.value}>
                <input type="checkbox" name="genre" value={g.value} defaultChecked={filters.genders?.includes(g.value)} />
                <span>
                  {GENDER_LABELS[g.value as keyof typeof GENDER_LABELS] ?? g.value}
                  <small>({g.count})</small>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {options.families.length > 0 && (
          <fieldset className="filters__group">
            <legend>Famille olfactive</legend>
            {options.families.map((f) => (
              <label className="check" key={f.name}>
                <input type="checkbox" name="famille" value={f.name} defaultChecked={filters.families?.includes(f.name)} />
                <span>
                  {f.name}
                  <small>({f.count})</small>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {options.brands.length > 1 && (
          <fieldset className="filters__group">
            <legend>Marque</legend>
            {options.brands.map((b) => (
              <label className="check" key={b.slug}>
                <input type="checkbox" name="marque" value={b.slug} defaultChecked={filters.brands?.includes(b.slug)} />
                <span>{b.name}</span>
              </label>
            ))}
          </fieldset>
        )}
        <fieldset className="filters__group">
          <legend>Prix</legend>
          <div className="filters__price">
            <label>
              <span className="visually-hidden">Prix minimum</span>
              <input type="number" name="prix_min" min={0} step="1" placeholder="Min" defaultValue={filters.priceMin != null ? filters.priceMin / 100 : ""} />
            </label>
            <span aria-hidden="true">–</span>
            <label>
              <span className="visually-hidden">Prix maximum</span>
              <input type="number" name="prix_max" min={0} step="1" placeholder="Max" defaultValue={filters.priceMax != null ? filters.priceMax / 100 : ""} />
            </label>
          </div>
        </fieldset>
        <fieldset className="filters__group">
          <label className="check">
            <input type="checkbox" name="dispo" value="1" defaultChecked={filters.onlyAvailable} />
            <span>En stock uniquement</span>
          </label>
        </fieldset>
        <input type="hidden" name="tri" value={filters.sort} />
      </FiltersForm>

      <div>
        <div className="toolbar">
          <span className="toolbar__count">
            {result.total} produit{result.total > 1 ? "s" : ""}
          </span>
          <form method="get" action={basePath} className="toolbar__sort" data-autosubmit>
            {Object.entries(sp).map(([k, v]) =>
              k === "tri" || k === "page" || v === undefined ? null : Array.isArray(v) ? v.map((x) => <input key={k + x} type="hidden" name={k} value={x} />) : <input key={k} type="hidden" name={k} value={v} />,
            )}
            <label className="visually-hidden" htmlFor="tri">
              Trier par
            </label>
            <select id="tri" name="tri" defaultValue={filters.sort}>
              <option value="featured">Notre sélection</option>
              <option value="newest">Nouveautés</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
              <option value="name">Nom A → Z</option>
            </select>
          </form>
        </div>

        {activeChips.length > 0 && (
          <div className="active-filters">
            {activeChips.map((c) => (
              <Link key={c.param + c.value} href={removeChip(c)} className="chip">
                {c.label} <span aria-hidden="true">×</span>
                <span className="visually-hidden">Retirer</span>
              </Link>
            ))}
            <Link href={basePath} className="chip">
              Tout effacer
            </Link>
          </div>
        )}

        {result.items.length === 0 ? (
          <p className="empty">Aucun produit ne correspond à votre sélection.</p>
        ) : (
          <div className="grid grid--3">
            {result.items.map((p, i) => (
              <Reveal key={p.id} delay={(i % 3) as 0 | 1 | 2}>
                <ProductCard product={p} priority={i < 3} />
              </Reveal>
            ))}
          </div>
        )}

        {result.pages > 1 && (
          <nav className="pagination" aria-label="Pagination">
            {result.page > 1 && (
              <Link href={buildUrl({ page: String(result.page - 1) })} aria-label="Page précédente">
                ←
              </Link>
            )}
            {Array.from({ length: result.pages }, (_, i) => i + 1).map((n) =>
              n === result.page ? (
                <span key={n} aria-current="page">
                  {n}
                </span>
              ) : (
                <Link key={n} href={buildUrl({ page: n === 1 ? null : String(n) })}>
                  {n}
                </Link>
              ),
            )}
            {result.page < result.pages && (
              <Link href={buildUrl({ page: String(result.page + 1) })} aria-label="Page suivante">
                →
              </Link>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
