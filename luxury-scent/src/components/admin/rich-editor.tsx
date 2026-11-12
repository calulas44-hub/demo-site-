"use client";

import { useEffect, useRef, useState } from "react";

/** Éditeur de texte riche minimal (gras, italique, titres, listes, liens), sans dépendance. */
export function RichEditor({ name, initialHtml = "", label, hint }: { name: string; initialHtml?: string | null; label: string; hint?: string }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(initialHtml ?? "");

  useEffect(() => {
    if (areaRef.current && areaRef.current.innerHTML !== (initialHtml ?? "")) areaRef.current.innerHTML = initialHtml ?? "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (command: string, value?: string) => {
    areaRef.current?.focus();
    document.execCommand(command, false, value);
    setHtml(areaRef.current?.innerHTML ?? "");
  };
  const link = () => {
    const url = window.prompt("Adresse du lien (https://…)");
    if (url) exec("createLink", url);
  };

  return (
    <div className="f">
      <label>{label}</label>
      <div className="rte-editor">
        <div className="rte-toolbar" role="toolbar" aria-label="Mise en forme">
          <button type="button" onClick={() => exec("formatBlock", "<p>")} title="Paragraphe">
            ¶
          </button>
          <button type="button" onClick={() => exec("formatBlock", "<h2>")} title="Titre">
            H2
          </button>
          <button type="button" onClick={() => exec("formatBlock", "<h3>")} title="Sous-titre">
            H3
          </button>
          <button type="button" onClick={() => exec("bold")} title="Gras">
            <b>G</b>
          </button>
          <button type="button" onClick={() => exec("italic")} title="Italique">
            <i>I</i>
          </button>
          <button type="button" onClick={() => exec("insertUnorderedList")} title="Liste à puces">
            • Liste
          </button>
          <button type="button" onClick={() => exec("insertOrderedList")} title="Liste numérotée">
            1. Liste
          </button>
          <button type="button" onClick={link} title="Lien">
            Lien
          </button>
          <button type="button" onClick={() => exec("removeFormat")} title="Effacer la mise en forme">
            ✕ format
          </button>
        </div>
        <div ref={areaRef} className="rte-area" contentEditable suppressContentEditableWarning onInput={(e) => setHtml((e.target as HTMLDivElement).innerHTML)} onBlur={(e) => setHtml((e.target as HTMLDivElement).innerHTML)} />
      </div>
      <textarea name={name} value={html} readOnly hidden />
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
