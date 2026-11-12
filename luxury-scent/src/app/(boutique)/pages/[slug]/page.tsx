import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await prisma.page.findFirst({ where: { slug, published: true } });
  return page ? { title: page.seoTitle ?? page.title, description: page.seoDescription ?? undefined } : {};
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params;
  const page = await prisma.page.findFirst({ where: { slug, published: true } });
  if (!page) notFound();
  return (
    <div className="container container--text">
      <header className="page-title">
        <h1>{page.title}</h1>
      </header>
      <div className="rte" style={{ marginBottom: "5rem" }} dangerouslySetInnerHTML={{ __html: page.content }} />
    </div>
  );
}
