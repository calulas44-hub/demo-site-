import Link from "next/link";
import { prisma } from "@/lib/db";
import { ProductForm } from "@/components/admin/product-form";

export default async function NewProductPage() {
  const [brands, categories, collections] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: [{ position: "asc" }], include: { children: { orderBy: { position: "asc" } } }, where: { parentId: null } }),
    prisma.collection.findMany({ orderBy: { position: "asc" } }),
  ]);
  const catOptions = categories.flatMap((c) => [{ id: c.id, name: c.name }, ...c.children.map((ch) => ({ id: ch.id, name: ch.name, indent: true }))]);
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Nouveau parfum</h1>
          <p>
            <Link href="/admin/produits">← Retour aux produits</Link>
          </p>
        </div>
      </div>
      <p className="msg msg--info">Enregistrez d&apos;abord le produit, puis ajoutez ses photographies.</p>
      <ProductForm brands={brands} categories={catOptions} collections={collections} />
    </>
  );
}
