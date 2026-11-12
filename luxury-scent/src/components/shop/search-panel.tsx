"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { formatPrice } from "@/lib/money";

interface Result {
  name: string;
  slug: string;
  subtitle: string | null;
  brand: string | null;
  image: string | null;
  priceFrom: number;
}

const SUGGESTIONS = ["Ambre", "Oud", "Rose", "Iris", "Coffret", "Extrait"];

export function SearchPanel({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) setResults(((await res.json()) as { results: Result[] }).results);
      } catch {
        /* requête annulée */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  return (
    <div className="search-panel" role="dialog" aria-modal="true" aria-label="Recherche">
      <div className="search-panel__inner container">
        <form className="search-panel__form" action="/recherche" method="get" role="search">
          <Icon name="search" />
          <input ref={inputRef} type="search" name="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Un parfum, une note, une marque…" autoComplete="off" aria-label="Rechercher" />
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer la recherche">
            <Icon name="close" />
          </button>
        </form>

        {results === null ? (
          <div>
            <p className="caps muted" style={{ marginTop: "1.5rem" }}>
              Suggestions
            </p>
            <div className="search-suggest">
              {SUGGESTIONS.map((s) => (
                <a key={s} href={`/recherche?q=${encodeURIComponent(s)}`}>
                  {s}
                </a>
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          <p className="muted" style={{ marginTop: "1.5rem" }}>
            {loading ? "Recherche…" : `Aucun résultat pour « ${q} ».`}
          </p>
        ) : (
          <>
            <div className="search-results">
              {results.map((r) => (
                <Link key={r.slug} href={`/produits/${r.slug}`} className="card" onClick={onClose}>
                  <span className="card__media">{r.image && <img className="card__img" src={r.image} alt="" />}</span>
                  <span className="card__body">
                    {r.brand && <span className="card__brand">{r.brand}</span>}
                    <span className="card__title">{r.name}</span>
                    {r.subtitle && <span className="card__subtitle">{r.subtitle}</span>}
                    <span className="card__price">{formatPrice(r.priceFrom)}</span>
                  </span>
                </Link>
              ))}
            </div>
            <p style={{ marginTop: "1.5rem" }}>
              <Link href={`/recherche?q=${encodeURIComponent(q)}`} className="link-line" onClick={onClose}>
                Voir tous les résultats
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
