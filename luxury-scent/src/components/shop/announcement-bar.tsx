"use client";

import { useEffect, useState } from "react";

export function AnnouncementBar({ items }: { items: { id: string; text: string; url: string | null }[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 4500);
    return () => clearInterval(t);
  }, [items.length]);
  if (items.length === 0) return null;
  return (
    <div className="announce" role="region" aria-label="Annonces">
      {items.map((it, i) => (
        <div key={it.id} className={`announce__item${i === index ? " is-active" : ""}`} aria-hidden={i !== index}>
          {it.url ? <a href={it.url}>{it.text}</a> : <span>{it.text}</span>}
        </div>
      ))}
    </div>
  );
}
