"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";

/** Formulaire de filtres : soumission automatique à chaque changement, panneau repliable sur mobile. */
export function FiltersForm({ basePath, children }: { basePath: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    let timer: ReturnType<typeof setTimeout>;
    const submit = () => form.requestSubmit();
    const onChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      clearTimeout(timer);
      timer = setTimeout(submit, target.type === "number" ? 700 : 0);
    };
    form.addEventListener("change", onChange);
    // Tri : soumission automatique du formulaire de la barre d'outils.
    const sortForms = document.querySelectorAll<HTMLFormElement>("form[data-autosubmit]");
    const onSort = (e: Event) => (e.currentTarget as HTMLFormElement).requestSubmit();
    sortForms.forEach((f) => f.addEventListener("change", onSort));
    return () => {
      form.removeEventListener("change", onChange);
      sortForms.forEach((f) => f.removeEventListener("change", onSort));
      clearTimeout(timer);
    };
  }, []);

  return (
    <aside>
      <button type="button" className="btn btn--outline btn--sm filters-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ marginBottom: "1rem" }}>
        <Icon name="filter" /> Filtres
      </button>
      <form ref={formRef} method="get" action={basePath} className={`filters${open ? " is-open" : ""}`}>
        {children}
        <div className="filters__actions">
          <button type="submit" className="btn btn--sm">
            Appliquer
          </button>
        </div>
      </form>
    </aside>
  );
}
