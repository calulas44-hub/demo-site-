import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { PRODUCT_STATUS_LABELS, type ProductStatus } from "@/lib/constants";
import { effectivePrice } from "@/lib/catalog";
import { ConfirmButton } from "@/components/admin/ui";
import { deleteDemoProductsAction } from "@/lib/admin-actions/promotions";

const PER_PAGE = 25;

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; statut?: string; categorie?: string; page?: string; deleted?: string }> }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.ProductWhereInput = {};
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { subtitle: { contains: q, mode: "insensitive" } }, { brand: { name: { contains: q, mode: "insensitive" } } }, { variants: { some: { sku: { contains: q, mode: "insensitive" } } } }];
  if (sp.statut) where.status = sp.statut;
  if (sp.categorie) where.categoryId = sp.categorie;
  const [products, total, categories, demoCount] = await Promise.all([
    prisma.product.findMany({ where, include: { brand: true, category: true, images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }], take: 1 }, variants: true }, orderBy: [{ position: "asc" }, { createdAt: "desc" }], skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    prisma.product.count({ where }),
    prisma.category.findMany({ orderBy: { position: "asc" } }),
    prisma.product.count({ where: { isDemo: true } }),
  ]);
  const pages = Math.ceil(total / PER_PAGE);

  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Produits</h1>
          <p>{total} produit(s)</p>
        </div>
        <Link href="/admin/produits/nouveau" className="btn-a">
          + Nouveau parfum
        </Link>
      </div>
      {sp.deleted && <p className="msg msg--ok">Produit supprimé.</p>}
      {demoCount > 0 && (
        <form action={deleteDemoProductsAction} className="panel" style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <p style={{ margin: 0, flex: 1 }}>
            <strong>{demoCount} produit(s) de démonstration</strong> sont présents pour tester la boutique. Supprimez-les quand vos vrais produits sont prêts (les commandes passées restent dans l&apos;historique).
          </p>
          <ConfirmButton message={`Supprimer définitivement les ${demoCount} produits de démonstration et leurs images ?`}>Supprimer les produits de démo</ConfirmButton>
        </form>
      )}
      <form className="filters-bar" method="get">
        <input type="search" name="q" placeholder="Nom, marque, référence…" defaultValue={q} />
        <select name="statut" defaultValue={sp.statut ?? ""}>
          <option value="">Tous les statuts</option>
          {Object.entries(PRODUCT_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="categorie" defaultValue={sp.categorie ?? ""}>
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.parentId ? "— " : ""}
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-a btn-a--ghost btn-a--sm">
          Filtrer
        </button>
      </form>
      <div className="panel">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th></th>
                <th>Produit</th>
                <th>Catégorie</th>
                <th>Contenances</th>
                <th className="num">Prix</th>
                <th className="num">Stock</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const stock = p.variants.reduce((s, v) => s + v.stock, 0);
                const prices = p.variants.filter((v) => v.active).map(effectivePrice);
                return (
                  <tr key={p.id}>
                    <td>{p.images[0] ? <img className="thumb" src={p.images[0].url} alt="" /> : <span className="thumb" />}</td>
                    <td>
                      <Link href={`/admin/produits/${p.id}`} className="row-link">
                        {p.name}
                      </Link>
                      <br />
                      <span className="muted small">
                        {p.brand?.name}
                        {p.subtitle ? ` · ${p.subtitle}` : ""}
                      </span>
                      {p.featured && <span className="pill pill--gold" style={{ marginLeft: ".5rem" }}>Accueil</span>}
                    </td>
                    <td>{p.category?.name ?? <span className="muted">—</span>}</td>
                    <td>{p.variants.map((v) => v.label).join(", ")}</td>
                    <td className="num">{prices.length ? (prices.length > 1 ? `dès ${formatPrice(Math.min(...prices))}` : formatPrice(prices[0])) : "—"}</td>
                    <td className="num">{stock === 0 ? <span className="pill pill--err">0</span> : stock}</td>
                    <td>
                      <span className={`pill pill--${p.status}`}>{PRODUCT_STATUS_LABELS[p.status as ProductStatus]}</span>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    Aucun produit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <nav className="pager">
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) =>
              n === page ? (
                <span key={n} aria-current="page">
                  {n}
                </span>
              ) : (
                <Link key={n} href={`/admin/produits?${new URLSearchParams({ ...(q ? { q } : {}), ...(sp.statut ? { statut: sp.statut } : {}), ...(sp.categorie ? { categorie: sp.categorie } : {}), page: String(n) }).toString()}`}>
                  {n}
                </Link>
              ),
            )}
          </nav>
        )}
      </div>
    </>
  );
}
