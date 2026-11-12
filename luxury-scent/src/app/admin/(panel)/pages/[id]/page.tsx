import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageForm } from "@/components/admin/page-form";
import { ConfirmButton } from "@/components/admin/ui";
import { deletePageAction } from "@/lib/admin-actions/content";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await prisma.page.findUnique({ where: { id } });
  if (!page) notFound();
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>{page.title}</h1>
          <p>
            <Link href="/admin/pages">← Retour aux pages</Link> ·{" "}
            <Link href={`/pages/${page.slug}`} target="_blank" rel="noopener">
              Voir sur le site ↗
            </Link>
          </p>
        </div>
        {!page.system && (
          <form action={deletePageAction}>
            <input type="hidden" name="id" value={page.id} />
            <ConfirmButton message={`Supprimer la page « ${page.title} » ?`} className="btn-a btn-a--danger">
              Supprimer
            </ConfirmButton>
          </form>
        )}
      </div>
      <PageForm page={page} />
    </>
  );
}
