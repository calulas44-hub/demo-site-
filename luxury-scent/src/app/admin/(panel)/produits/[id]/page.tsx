import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProductForm } from "@/components/admin/product-form";
import { ProductImages } from "@/components/admin/product-images";
import { ConfirmButton } from "@/components/admin/ui";
import { deleteProductAction, duplicateProductAction } from "@/lib/admin-actions/catalog";

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [product, brands, categories, collections] = await Promise.all([
    prisma.product.findUnique({ where: { id }, include: { variants: { orderBy: { position: "asc" } }, images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] } } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: [{ position: "asc" }], include: { children: { orderBy: { position: "asc" } } }, where: { parentId: null } }),
    prisma.collection.findMany({ orderBy: { position: "asc" } }),
  ]);
  if (!product) notFound();
  const catOptions = categories.flatMap((c) => [{ id: c.id, name: c.name }, ...c.children.map((ch) => ({ id: ch.id, name: ch.name, indent: true }))]);
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>{product.name}</h1>
          <p>
            <Link href="/admin/produits">← Retour aux produits</Link>
            {product.status === "ACTIVE" && (
              <>
                {" · "}
                <Link href={`/produits/${product.slug}`} target="_blank" rel="noopener">
                  Voir sur le site ↗
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="adm-actions">
          <form action={duplicateProductAction}>
            <input type="hidden" name="id" value={product.id} />
            <button type="submit" className="btn-a btn-a--ghost">
              Dupliquer
            </button>
          </form>
          <form action={deleteProductAction}>
            <input type="hidden" name="id" value={product.id} />
            <ConfirmButton message={`Supprimer définitivement « ${product.name} » et ses images ?`} className="btn-a btn-a--danger">
              Supprimer
            </ConfirmButton>
          </form>
        </div>
      </div>
      {sp.ok && <p className="msg msg--ok">Produit créé. Vous pouvez maintenant ajouter ses photographies.</p>}
      <ProductImages productId={product.id} images={product.images} />
      <ProductForm
        product={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          subtitle: product.subtitle,
          brandId: product.brandId,
          categoryId: product.categoryId,
          collectionId: product.collectionId,
          shortDescription: product.shortDescription,
          description: product.description,
          inspiration: product.inspiration,
          notesTop: product.notesTop,
          notesHeart: product.notesHeart,
          notesBase: product.notesBase,
          families: product.families,
          gender: product.gender,
          status: product.status,
          featured: product.featured,
          isNew: product.isNew,
          isLimited: product.isLimited,
          vatRate: product.vatRate,
          position: product.position,
          seoTitle: product.seoTitle,
          seoDescription: product.seoDescription,
          variants: product.variants.map((v) => ({ id: v.id, label: v.label, volumeMl: v.volumeMl, sku: v.sku, price: v.price, salePrice: v.salePrice, costPrice: v.costPrice, stock: v.stock, lowStockThreshold: v.lowStockThreshold, active: v.active })),
        }}
        brands={brands}
        categories={catOptions}
        collections={collections}
      />
    </>
  );
}
