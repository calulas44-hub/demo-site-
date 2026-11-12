import sanitizeHtml from "sanitize-html";

/** Nettoie le HTML saisi dans l'administration (descriptions, pages). */
export function cleanHtml(input: string | null | undefined): string | null {
  if (!input) return null;
  const out = sanitizeHtml(input, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "h2", "h3", "h4", "ul", "ol", "li", "a", "blockquote", "img", "hr", "span"],
    allowedAttributes: { a: ["href", "target", "rel"], img: ["src", "alt"], span: [] },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https", "http"] },
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: "noopener" } }),
      img: (tagName, attribs) => ({ tagName, attribs: attribs.src?.startsWith("/uploads/") || /^https?:/.test(attribs.src ?? "") ? attribs : { alt: attribs.alt ?? "" } }),
    },
    allowProtocolRelative: false,
  }).trim();
  return out === "" || out === "<p></p>" || out === "<p><br></p>" ? null : out;
}
