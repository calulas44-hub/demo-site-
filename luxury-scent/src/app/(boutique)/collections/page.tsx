import type { Metadata } from "next";
import Link from "next/link";
import { getActiveCollections } from "@/lib/catalog";
import { Reveal } from "@/components/shop/reveal";

export const metadata: Metadata = { title: "Les collections", description: "Chaque collection Luxury Scent explore un univers olfactif." };

export default async function CollectionsPage() {
  const collections = await getActiveCollections();
  return (
    <div className="container">
      <header className="plp-head">
        <p className="eyebrow">Univers</p>
        <h1>Les collections</h1>
        <p className="lead">Chaque collection explore une inspiration : une matière, une saison, une lumière.</p>
      </header>
      <div className={`tiles${collections.length % 3 === 0 ? " tiles--3" : ""}`} style={{ marginBottom: "5rem" }}>
        {collections.map((c, i) => (
          <Reveal key={c.id} delay={(i % 4) as 0 | 1 | 2 | 3}>
            <Link href={`/collections/${c.slug}`} className="tile">
              {(c.imageUrl ?? c.heroImageUrl) && <img src={c.imageUrl ?? c.heroImageUrl ?? ""} alt="" loading="lazy" />}
              <div className="tile__label">
                <h3>{c.name}</h3>
                {c.tagline && <span>{c.tagline}</span>}
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
