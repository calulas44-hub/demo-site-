"use client";

import Link from "next/link";

/** Bouton qui apparaît au survol d'une carte : renvoie vers la fiche pour choisir la contenance. */
export function QuickAdd({ slug, singleSize }: { slug: string; singleSize: boolean }) {
  return (
    <Link href={`/produits/${slug}`} className="btn btn--light btn--block btn--sm">
      {singleSize ? "Ajouter au panier" : "Choisir la contenance"}
    </Link>
  );
}
