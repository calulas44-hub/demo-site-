import { NextResponse } from "next/server";
import { listProducts } from "@/lib/catalog";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });
  const { items } = await listProducts({ q, perPage: 6, page: 1 });
  return NextResponse.json(
    {
      results: items.map((p) => ({ name: p.name, slug: p.slug, subtitle: p.subtitle, brand: p.brand, image: p.image, priceFrom: p.priceFrom })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
