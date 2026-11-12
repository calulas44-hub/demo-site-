/**
 * Générateur du site vitrine Luxury Scent — aucune dépendance (Node ≥ 18).
 * Lit data/site.json (exporté depuis l'administration avec `npm run vitrine:export`)
 * et produit un site 100 % statique dans dist/, prêt pour Netlify.
 *
 * Usage : node build.mjs
 * L'URL publique (canonical, sitemap) vient de la variable URL fournie par Netlify,
 * ou de SITE_URL, ou d'une valeur par défaut.
 */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "dist");
const data = JSON.parse(readFileSync(path.join(here, "data", "site.json"), "utf8"));
const S = data.settings;
const SITE_URL = (process.env.URL || process.env.SITE_URL || "https://luxury-scent.netlify.app").replace(/\/$/, "");
const BRAND = S.brandName || "Luxury Scent";

// ------------------------------------------------------------------ Utilitaires

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const price = (cents) => euro.format(cents / 100);
const effective = (v) => (v.salePrice !== null && v.salePrice < v.price ? v.salePrice : v.price);
const GENDER = { FEMME: "Femme", HOMME: "Homme", MIXTE: "Mixte" };

/** Convertit les liens de la boutique (Next.js) vers les adresses du site vitrine. */
function mapUrl(url) {
  if (!url) return "/parfums/";
  if (url.startsWith("http") || url.startsWith("#")) return url;
  const m = url.match(/^\/produits\/([^/?#]+)/);
  if (m) return `/parfums/${m[1]}/`;
  if (url === "/pages/notre-maison") return "/la-maison/";
  if (url.startsWith("/pages/")) return `/${url.slice(7)}/`;
  if (url === "/parfums" || url === "/collections") return `${url}/`;
  if (/^\/(collections|categories)\/[^/]+$/.test(url)) return `${url}/`;
  return url.endsWith("/") ? url : `${url}/`;
}

function write(rel, html) {
  const file = path.join(dist, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, html);
}

const icon = (name) => {
  const p = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    truck: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    gift: '<path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13"/><path d="M12 7c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1"/>',
    shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z"/><path d="m9 12 2 2 4-4"/>',
    chat: '<path d="M4 5h16v11H9l-5 4V5Z"/>',
    flask: '<path d="M10 3h4M11 3v5l-5 9a3 3 0 0 0 2.6 4.5h6.8A3 3 0 0 0 18 17l-5-9V3"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    instagram: '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><path d="M16.8 7.2h.01"/>',
    facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.5"/>',
    tiktok: '<path d="M14 4v10a3.5 3.5 0 1 1-3.5-3.5M14 4c.5 2.5 2 4 5 4.2"/>',
  }[name] ?? '<path d="m5 12 5 5 9-10"/>';
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${p}</svg>`;
};

// ------------------------------------------------------------------ Index du contenu

const products = data.products;
const bySlug = new Map(products.map((p) => [p.slug, p]));
const collections = data.collections;
const topCategories = data.categories.filter((c) => !c.parentSlug);
const childrenOf = (slug) => data.categories.filter((c) => c.parentSlug === slug);
const productsInCategory = (slug) => {
  const slugs = new Set([slug, ...childrenOf(slug).map((c) => c.slug)]);
  return products.filter((p) => p.category && slugs.has(p.category.slug));
};
const page = (slug) => data.pages.find((p) => p.slug === slug);

// ------------------------------------------------------------------ Gabarit

function layout({ title, description, urlPath, body, hasHero = false, ogImage = null, jsonLd = null }) {
  const fullTitle = title ? `${title} — ${BRAND}` : S.seoTitle || BRAND;
  const desc = description || S.seoDescription || "";
  const canonical = `${SITE_URL}${urlPath}`;
  const og = ogImage ? `${SITE_URL}${ogImage}` : null;
  return `<!doctype html>
<html lang="fr" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(BRAND)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:locale" content="fr_FR">
${og ? `<meta property="og:image" content="${esc(og)}">\n<meta name="twitter:card" content="summary_large_image">` : ""}
<meta name="theme-color" content="#141210">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#141210"/><text x="32" y="43" font-family="Georgia,serif" font-size="30" fill="#c9a96e" text-anchor="middle">LS</text></svg>')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/site.css">
<script>document.documentElement.classList.replace('no-js','js')</script>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body${hasHero ? ' class="has-hero-page"' : ""}>
<a href="#main" class="skip-link">Aller au contenu</a>
<div${hasHero ? ' class="has-hero"' : ""}>
${announcementBar()}
${header(hasHero)}
<main id="main">
${body}
</main>
${footer()}
</div>
${mobileMenu()}
<script src="/assets/js/site.js" defer></script>
</body>
</html>
`;
}

function announcementBar() {
  const items = [{ text: "Boutique en ligne : ouverture prochaine — inscrivez-vous pour être prévenu·e", url: "/#ouverture" }];
  return `<div class="announce" role="region" aria-label="Annonces">${items
    .map((it, i) => `<div class="announce__item${i === 0 ? " is-active" : ""}"><a href="${it.url}">${esc(it.text)}</a></div>`)
    .join("")}</div>`;
}

function navItems() {
  // « Catalogue » : toutes les catégories principales sauf celle qui porte des sous-catégories de genre,
  // dont les enfants (Femme, Homme, Mixte) forment la colonne « Pour ».
  const genderParent = topCategories.find((c) => childrenOf(c.slug).length > 0);
  const catalogueLinks = [{ label: "Tous les parfums", href: "/parfums/" }, ...topCategories.filter((c) => c !== genderParent).map((c) => ({ label: c.name, href: `/categories/${c.slug}/` }))];
  const columns = [{ title: "Catalogue", links: catalogueLinks }];
  if (genderParent) columns.push({ title: "Pour", links: childrenOf(genderParent.slug).map((ch) => ({ label: ch.name, href: `/categories/${ch.slug}/` })) });
  return [
    { label: "Parfums", href: "/parfums/", columns, visuals: collections.slice(0, 2) },
    { label: "Collections", href: "/collections/", columns: [{ title: "Nos collections", links: [{ label: "Toutes les collections", href: "/collections/" }, ...collections.map((c) => ({ label: c.name, href: `/collections/${c.slug}/` }))] }], visuals: collections.slice(2, 4).length ? collections.slice(2, 4) : collections.slice(0, 2) },
    { label: "La Maison", href: "/la-maison/" },
    { label: "Questions", href: "/faq/" },
    { label: "Contact", href: "/contact/" },
  ];
}

function header(hasHero) {
  const nav = navItems()
    .map((item) => {
      if (!item.columns) return `<div class="nav__item"><a href="${item.href}">${esc(item.label)}</a></div>`;
      const cols = item.columns
        .map((col) => `<div class="mega__col"><h4>${esc(col.title)}</h4><ul>${col.links.map((l) => `<li><a href="${l.href}">${esc(l.label)}</a></li>`).join("")}</ul></div>`)
        .join("");
      const visuals = (item.visuals || [])
        .map((c) => `<a href="/collections/${c.slug}/" class="mega__visual"><figure>${c.imageUrl ? `<img src="${c.imageUrl}" alt="" loading="lazy">` : ""}</figure><figcaption>${esc(c.name)}</figcaption></a>`)
        .join("");
      return `<div class="nav__item"><a href="${item.href}" aria-haspopup="true">${esc(item.label)}</a><div class="mega"><div class="mega__inner"><div class="mega__cols">${cols}</div>${visuals ? `<div class="mega__visuals">${visuals}</div>` : ""}</div></div></div>`;
    })
    .join("");
  return `<header class="site-header${hasHero ? " is-overlay" : ""}" data-header>
<div class="container header__inner">
<div class="header__left">
<button type="button" class="icon-btn mobile-only" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="mobile-menu" data-menu-open>${icon("menu")}</button>
<nav class="nav" aria-label="Navigation principale">${nav}</nav>
</div>
<a href="/" class="logo" aria-label="${esc(BRAND)} — accueil">${S.logoUrl ? `<img class="logo-img" src="${S.logoUrl}" alt="${esc(BRAND)}">` : esc(BRAND)}</a>
<div class="header__right"><a href="/#ouverture" class="header__cta">Être prévenu·e</a></div>
</div>
</header>`;
}

function mobileMenu() {
  const items = navItems()
    .map((item, i) => {
      if (!item.columns) return `<div class="mnav__item"><a href="${item.href}">${esc(item.label)}${icon("chevron")}</a></div>`;
      const links = item.columns.map((col) => `<div>${item.columns.length > 1 ? `<h5>${esc(col.title)}</h5>` : ""}${col.links.map((l) => `<a href="${l.href}">${esc(l.label)}</a>`).join("")}</div>`).join("");
      return `<div class="mnav__item"><button type="button" aria-expanded="false" aria-controls="mnav-${i}" data-mnav>${esc(item.label)}${icon("plus")}</button><div class="mnav__sub" id="mnav-${i}" hidden>${links}</div></div>`;
    })
    .join("");
  return `<div class="drawer" id="mobile-menu" aria-hidden="true" data-menu>
<div class="drawer__backdrop" data-menu-close></div>
<nav class="drawer__panel drawer__panel--left" aria-label="Menu">
<div class="drawer__head"><span class="logo" style="font-size:1.1rem">${esc(BRAND)}</span><button type="button" class="icon-btn" aria-label="Fermer le menu" data-menu-close>${icon("close")}</button></div>
<div class="drawer__body">${items}<div class="mnav__item"><a href="/#ouverture" data-menu-close>Être prévenu·e de l'ouverture${icon("chevron")}</a></div></div>
</nav>
</div>`;
}

function footer() {
  const social = [
    ["instagram", S.instagram],
    ["facebook", S.facebook],
    ["tiktok", S.tiktok],
  ]
    .filter(([, url]) => url)
    .map(([n, url]) => `<a class="icon-btn" href="${esc(url)}" target="_blank" rel="noopener">${icon(n)}<span class="visually-hidden">${n}</span></a>`)
    .join("");
  return `<footer class="footer">
<div class="container footer__grid">
<div>
<div class="footer__brand">${esc(BRAND)}</div>
<p class="footer__about">${esc(S.seoDescription)}</p>
<p class="footer__about small">${S.contactEmail ? `<a href="mailto:${esc(S.contactEmail)}">${esc(S.contactEmail)}</a><br>` : ""}${esc(S.contactPhone)}</p>
${social ? `<div class="footer__social">${social}</div>` : ""}
</div>
<div><h4>Découvrir</h4><ul>
<li><a href="/parfums/">Tous les parfums</a></li>
${topCategories.map((c) => `<li><a href="/categories/${c.slug}/">${esc(c.name)}</a></li>`).join("")}
</ul></div>
<div><h4>La Maison</h4><ul>
<li><a href="/la-maison/">Notre histoire</a></li>
${collections.map((c) => `<li><a href="/collections/${c.slug}/">${esc(c.name)}</a></li>`).join("")}
<li><a href="/faq/">Questions fréquentes</a></li>
<li><a href="/contact/">Contact</a></li>
</ul></div>
<div><h4>Ouverture prochaine</h4>
<p class="footer__about">La boutique en ligne ouvre bientôt. Laissez votre e-mail pour être prévenu·e en premier.</p>
${launchForm("footer", true)}
</div>
</div>
<div class="container footer__bottom">
<span>© ${new Date().getFullYear()} ${esc(BRAND)}. Tous droits réservés.</span>
<ul><li><a href="/mentions-legales/">Mentions légales</a></li><li><a href="/confidentialite/">Confidentialité</a></li></ul>
</div>
</footer>`;
}

// ------------------------------------------------------------------ Formulaires Netlify

const honeypot = `<p class="hp" aria-hidden="true"><label>Ne pas remplir <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>`;

function launchForm(origin, compact = false) {
  return `<form name="ouverture" method="POST" action="/merci/?f=ouverture" data-netlify="true" netlify-honeypot="bot-field" class="newsletter__form"${compact ? ' style="margin-top:.5rem"' : ""}>
<input type="hidden" name="form-name" value="ouverture">
<input type="hidden" name="origine" value="${esc(origin)}">
${honeypot}
<label class="visually-hidden" for="ouverture-${origin}">Adresse e-mail</label>
<input id="ouverture-${origin}" type="email" name="email" placeholder="Votre adresse e-mail" required autocomplete="email">
<button type="submit" class="btn btn--gold">M'inscrire</button>
</form>`;
}

function notifyForm(p) {
  const first = p.variants[0];
  return `<form name="disponibilite" method="POST" action="/merci/?f=disponibilite" data-netlify="true" netlify-honeypot="bot-field" class="notify">
<input type="hidden" name="form-name" value="disponibilite">
<input type="hidden" name="produit" value="${esc(`${p.name}${p.subtitle ? " — " + p.subtitle : ""}`)}">
<input type="hidden" name="contenance" value="${esc(first?.label ?? "")}" data-notify-size>
${honeypot}
<p><strong>Boutique en ligne bientôt ouverte.</strong> Laissez votre e-mail : nous vous prévenons dès que ce parfum est disponible à la commande.</p>
<div class="notify__row">
<label class="visually-hidden" for="notify-email">Adresse e-mail</label>
<input id="notify-email" type="email" name="email" placeholder="Votre adresse e-mail" required autocomplete="email">
<button type="submit" class="btn">Me prévenir</button>
</div>
</form>`;
}

// ------------------------------------------------------------------ Composants

function card(p, eager = false) {
  const prices = p.variants.map(effective);
  const from = Math.min(...prices);
  const cheapest = p.variants.find((v) => effective(v) === from);
  const compare = cheapest && cheapest.salePrice !== null ? cheapest.price : null;
  const hasRange = new Set(prices).size > 1;
  const img = p.images[0]?.url;
  const hover = p.images[1]?.url;
  const href = `/parfums/${p.slug}/`;
  const badges = [p.isNew ? '<span class="badge">Nouveauté</span>' : "", p.isLimited ? '<span class="badge badge--gold">Édition limitée</span>' : "", compare ? '<span class="badge badge--gold">Offre</span>' : ""].join("");
  return `<article class="card" data-families="${esc(p.families.join("|"))}" data-gender="${esc(p.gender)}" data-price="${from}" data-name="${esc(p.name)}" data-new="${p.isNew ? 1 : 0}">
<a href="${href}" class="card__media" tabindex="-1" aria-hidden="true">
${img ? `<img class="card__img card__img--main" src="${img}" alt="" loading="${eager ? "eager" : "lazy"}" width="1200" height="1500">` : '<span class="card__img card__img--main"></span>'}
${hover ? `<img class="card__img card__img--hover" src="${hover}" alt="" loading="lazy" width="1200" height="1500">` : ""}
<div class="card__badges">${badges}</div>
</a>
<div class="card__body">
${p.brand ? `<div class="card__brand">${esc(p.brand)}</div>` : ""}
<h3 class="card__title"><a href="${href}">${esc(p.name)}</a></h3>
${p.subtitle ? `<div class="card__subtitle">${esc(p.subtitle)}</div>` : ""}
${p.families.length ? `<div class="card__families">${esc(p.families.slice(0, 3).join(" · "))}</div>` : ""}
<div class="card__price">${hasRange ? '<span class="card__from">À partir de</span>' : ""}${compare ? `<s>${price(compare)}</s>` : ""}${price(from)}</div>
</div>
</article>`;
}

const grid = (list, cls = "grid") => `<div class="${cls}" data-grid>${list.map((p, i) => `<div class="reveal" data-delay="${i % 4}">${card(p, i < 4)}</div>`).join("")}</div>`;

const tile = (href, img, title, sub) =>
  `<a href="${href}" class="tile reveal">${img ? `<img src="${img}" alt="" loading="lazy">` : ""}<div class="tile__label"><h3>${esc(title)}</h3>${sub ? `<span>${esc(sub)}</span>` : ""}</div></a>`;

function reassurance() {
  const items = (S.reassurance || []).filter((r) => r.title);
  if (!items.length) return "";
  return `<section class="reassurance"><ul class="container reassurance__list">${items
    .map((r) => `<li class="reassurance__item">${icon(r.icon)}<div><strong>${esc(r.title)}</strong><span>${esc(r.text)}</span></div></li>`)
    .join("")}</ul></section>`;
}

// ------------------------------------------------------------------ Pages

function homePage() {
  const body = data.sections
    .map((s, index) => {
      switch (s.type) {
        case "HERO": {
          const align = s.data.align || "left";
          const light = s.data.theme === "light";
          return `<section class="hero${light ? " hero--light" : ""}${index > 0 ? " hero--short" : ""}">
<div class="hero__media">${s.imageUrl ? `<picture>${s.imageMobileUrl ? `<source media="(max-width: 767px)" srcset="${s.imageMobileUrl}">` : ""}<img src="${s.imageUrl}" alt="" fetchpriority="high"></picture>` : ""}</div>
<div class="container"><div class="hero__content hero__content--${align}">
${s.subtitle ? `<p class="eyebrow">${esc(s.subtitle)}</p>` : ""}
${s.title ? `<h1 class="hero__title">${esc(s.title)}</h1>` : ""}
${s.text ? `<p class="hero__text">${esc(s.text)}</p>` : ""}
<div class="hero__actions">
${s.buttonLabel ? `<a href="${mapUrl(s.buttonUrl)}" class="btn${light ? "" : " btn--light"}">${esc(s.buttonLabel)}</a>` : ""}
<a href="#ouverture" class="btn ${light ? "btn--outline" : "btn--ghost-light"}">Être prévenu·e de l'ouverture</a>
</div></div></div></section>`;
        }
        case "REASSURANCE":
          return reassurance();
        case "FEATURED_PRODUCTS": {
          const list = (s.data.productSlugs?.length ? s.data.productSlugs.map((x) => bySlug.get(x)).filter(Boolean) : products.filter((p) => p.featured)).slice(0, 8);
          if (!list.length) return "";
          return `<section class="section container">
<div class="section__head reveal">${s.subtitle ? `<p class="eyebrow">${esc(s.subtitle)}</p>` : ""}${s.title ? `<h2>${esc(s.title)}</h2>` : ""}${s.text ? `<p class="lead">${esc(s.text)}</p>` : ""}</div>
${grid(list)}
${s.buttonLabel ? `<div class="section__foot"><a href="${mapUrl(s.buttonUrl)}" class="btn btn--outline">${esc(s.buttonLabel)}</a></div>` : ""}
</section>`;
        }
        case "COLLECTIONS":
          if (!collections.length) return "";
          return `<section class="section section--alt"><div class="container">
<div class="section__head reveal">${s.subtitle ? `<p class="eyebrow">${esc(s.subtitle)}</p>` : ""}${s.title ? `<h2>${esc(s.title)}</h2>` : ""}</div>
<div class="tiles${collections.length === 3 ? " tiles--3" : ""}">${collections.slice(0, 4).map((c) => tile(`/collections/${c.slug}/`, c.imageUrl || c.heroImageUrl, c.name, c.tagline)).join("")}</div>
</div></section>`;
        case "CATEGORIES": {
          const cats = topCategories.filter((c) => c.imageUrl);
          if (!cats.length) return "";
          return `<section class="section container">
<div class="section__head reveal">${s.subtitle ? `<p class="eyebrow">${esc(s.subtitle)}</p>` : ""}${s.title ? `<h2>${esc(s.title)}</h2>` : ""}</div>
<div class="tiles${cats.length === 3 ? " tiles--3" : ""}">${cats.slice(0, 4).map((c) => tile(`/categories/${c.slug}/`, c.imageUrl, c.name, c.description)).join("")}</div>
</section>`;
        }
        case "EDITORIAL":
          return `<section class="section container"><div class="editorial reveal${s.data.imageSide === "right" ? " editorial--flip" : ""}">
<div class="editorial__media">${s.imageUrl ? `<img src="${s.imageUrl}" alt="" loading="lazy">` : ""}</div>
<div class="editorial__body">${s.subtitle ? `<p class="eyebrow">${esc(s.subtitle)}</p>` : ""}${s.title ? `<h2>${esc(s.title)}</h2>` : ""}${s.text ? `<p class="lead">${esc(s.text)}</p>` : ""}${s.buttonLabel ? `<a href="${mapUrl(s.buttonUrl)}" class="btn btn--outline">${esc(s.buttonLabel)}</a>` : ""}</div>
</div></section>`;
        case "BANNER":
          return `<section class="banner">${s.imageUrl ? `<img src="${s.imageUrl}" alt="" loading="lazy">` : ""}<div class="container"><div class="banner__content reveal">${s.subtitle ? `<p class="eyebrow">${esc(s.subtitle)}</p>` : ""}${s.title ? `<h2>${esc(s.title)}</h2>` : ""}${s.text ? `<p class="lead">${esc(s.text)}</p>` : ""}${s.buttonLabel ? `<a href="${mapUrl(s.buttonUrl)}" class="btn">${esc(s.buttonLabel)}</a>` : ""}</div></div></section>`;
        case "NEWSLETTER":
          return "";
        default:
          return "";
      }
    })
    .join("\n");

  const launch = `<section class="section section--dark newsletter" id="ouverture"><div class="container container--narrow reveal">
<p class="eyebrow">Ouverture prochaine</p>
<h2>Soyez les premiers informés</h2>
<p class="lead" style="color:inherit;opacity:.8">La boutique en ligne ${esc(BRAND)} ouvre bientôt. Inscrivez-vous pour recevoir l'invitation à l'ouverture et nos nouveautés.</p>
${launchForm("accueil")}
<p class="small" style="opacity:.6;margin-top:1rem">Votre adresse sert uniquement à vous prévenir. Désinscription en un clic.</p>
</div></section>`;

  const jsonLd = { "@context": "https://schema.org", "@type": "Organization", name: BRAND, url: SITE_URL, email: S.contactEmail || undefined, telephone: S.contactPhone || undefined };
  const hero = data.sections.find((s) => s.type === "HERO");
  return layout({ title: "", description: S.seoDescription, urlPath: "/", body: body + launch, hasHero: data.sections[0]?.type === "HERO", ogImage: hero?.imageUrl, jsonLd });
}

function filterBar(list) {
  const fams = [...new Set(list.flatMap((p) => p.families))].sort((a, b) => a.localeCompare(b, "fr"));
  const genders = [...new Set(list.map((p) => p.gender))];
  return `<div class="filter-bar" data-filters>
${genders.length > 1 ? `<div class="filter-bar__group" role="group" aria-label="Pour">${genders.map((g) => `<button type="button" class="filter-chip" aria-pressed="false" data-filter-gender="${g}">${GENDER[g] ?? g}</button>`).join("")}</div>` : ""}
${fams.length > 1 ? `<div class="filter-bar__group" role="group" aria-label="Famille olfactive">${fams.map((f) => `<button type="button" class="filter-chip" aria-pressed="false" data-filter-family="${esc(f)}">${esc(f)}</button>`).join("")}</div>` : ""}
<div class="filter-bar__end"><span class="toolbar__count" data-count>${list.length} produit${list.length > 1 ? "s" : ""}</span>
<label class="visually-hidden" for="tri">Trier par</label>
<select id="tri" data-sort><option value="featured">Notre sélection</option><option value="new">Nouveautés</option><option value="price_asc">Prix croissant</option><option value="price_desc">Prix décroissant</option><option value="name">Nom A → Z</option></select></div>
</div>
<p class="empty" data-empty hidden>Aucun parfum ne correspond à cette sélection.</p>`;
}

function listingPage({ urlPath, eyebrow, title, lead, list, heroImg = null, breadcrumb = "" }) {
  const body = `<div class="container">
${heroImg ? `<div class="plp-hero" style="margin-top:1.5rem"><img src="${heroImg}" alt=""></div>` : ""}
<header class="plp-head">${breadcrumb}${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ""}<h1>${esc(title)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ""}</header>
${list.length ? filterBar(list) + grid(list, "grid grid--3") : '<p class="empty">Aucun produit pour le moment.</p>'}
<div style="height:5rem"></div>
</div>`;
  return layout({ title, description: lead, urlPath, body });
}

function productPage(p) {
  const families = p.families;
  const first = p.variants.find((v) => v.available) ?? p.variants[0];
  const related = (p.collection ? products.filter((x) => x.collection?.slug === p.collection.slug && x.slug !== p.slug) : []).concat(products.filter((x) => x.slug !== p.slug && (!p.collection || x.collection?.slug !== p.collection.slug) && x.featured)).slice(0, 4);
  const per100 = (v) => (v.volumeMl ? Math.round((effective(v) / v.volumeMl) * 100) : null);
  const crumbs = `<nav class="breadcrumb" aria-label="Fil d'Ariane" style="justify-content:flex-start;margin:1.5rem 0 0"><a href="/">Accueil</a><span aria-hidden="true">/</span><a href="/parfums/">Parfums</a>${p.category ? `<span aria-hidden="true">/</span><a href="/categories/${p.category.slug}/">${esc(p.category.name)}</a>` : ""}<span aria-hidden="true">/</span><span aria-current="page">${esc(p.name)}</span></nav>`;
  const imgs = p.images.map((im, i) => `<div class="gallery__item"><img src="${im.url}" alt="${esc(im.alt || p.name)}" loading="${i === 0 ? "eager" : "lazy"}"></div>`).join("");
  const sizes =
    p.variants.length > 1
      ? `<fieldset class="sizes" style="border:0;padding:0;margin:0 0 1.5rem"><legend class="sizes__legend">Contenance</legend>${p.variants
          .map(
            (v, i) => `<div class="size${v.available ? "" : " size--soldout"}"><input type="radio" id="v-${i}" name="contenance" value="${esc(v.label)}" data-price="${effective(v)}" data-compare="${v.salePrice !== null ? v.price : ""}" data-per100="${per100(v) ?? ""}"${v === first ? " checked" : ""}><label for="v-${i}"><b>${esc(v.label)}</b><small>${price(effective(v))}</small></label></div>`,
          )
          .join("")}</fieldset>`
      : "";
  const notes = [
    ["Tête", p.notesTop],
    ["Cœur", p.notesHeart],
    ["Fond", p.notesBase],
  ].filter(([, v]) => v);
  const body = `<div class="container">
${crumbs}
<div class="pdp">
<div><div class="gallery gallery--mobile">${imgs}</div><div class="gallery gallery--desktop${p.images.length <= 2 ? " gallery--two" : ""}">${imgs}</div></div>
<div class="pdp__info">
${p.brand ? `<div class="pdp__brand">${esc(p.brand)}</div>` : ""}
<h1 class="pdp__title">${esc(p.name)}</h1>
${p.subtitle ? `<p class="pdp__subtitle">${esc(p.subtitle)}</p>` : ""}
${families.length ? `<div class="pdp__families">${families.map((f) => `<span>${esc(f)}</span>`).join("")}</div>` : ""}
${p.shortDescription ? `<p class="lead">${esc(p.shortDescription)}</p>` : ""}
<div class="pdp__price" aria-live="polite"><s data-compare-out${first.salePrice !== null ? "" : " hidden"}>${first.salePrice !== null ? price(first.price) : ""}</s><span data-price-out>${price(effective(first))}</span></div>
<p class="pdp__per" data-per-out>${per100(first) ? `Soit ${price(per100(first))} les 100 ml · ` : ""}Prix indicatif TTC.</p>
${sizes}
<span class="launch-note">Ouverture prochaine</span>
${notifyForm(p)}
${(S.reassurance || []).length ? `<ul class="perks pdp__perks">${S.reassurance.slice(0, 3).map((r) => `<li>${icon(r.icon)} <strong>${esc(r.title)}</strong>&nbsp;${esc(r.text)}</li>`).join("")}</ul>` : ""}
${notes.length ? `<div class="notes"><p class="caps">Pyramide olfactive</p><dl>${notes.map(([k, v]) => `<div class="notes__row"><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></div>` : ""}
${p.description ? `<details class="accordion" open><summary>Description</summary><div class="accordion__body rte">${p.description}</div></details>` : ""}
<details class="accordion"><summary>Conseils d'utilisation</summary><div class="accordion__body"><p>Vaporisez sur les points de chaleur (poignets, cou) à 15 cm de la peau. Conservez le flacon à l'abri de la lumière et de la chaleur.</p></div></details>
</div>
</div>
${p.inspiration ? `<section class="section"><div class="pdp__story reveal"><div><p class="eyebrow">L'inspiration</p><h2>${esc(p.name)}</h2></div><div class="rte lead">${p.inspiration}</div></div></section>` : ""}
${related.length ? `<section class="section"><div class="section__head reveal"><p class="eyebrow">${p.collection ? `Collection ${esc(p.collection.name)}` : "Vous aimerez aussi"}</p><h2>${p.collection ? "Compléter le rituel" : "Nos suggestions"}</h2></div>${grid(related)}</section>` : ""}
</div>`;
  const jsonLd = { "@context": "https://schema.org", "@type": "Product", name: `${p.name}${p.subtitle ? " — " + p.subtitle : ""}`, image: p.images.map((i) => `${SITE_URL}${i.url}`), description: p.shortDescription || undefined, brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined };
  return layout({ title: [p.name, p.subtitle].filter(Boolean).join(" ⋅ "), description: p.shortDescription, urlPath: `/parfums/${p.slug}/`, body, ogImage: p.images[0]?.url, jsonLd });
}

function collectionPage(c) {
  const list = products.filter((p) => p.collection?.slug === c.slug);
  const others = collections.filter((o) => o.slug !== c.slug);
  const body = `<section class="hero hero--short"><div class="hero__media">${c.heroImageUrl ? `<img src="${c.heroImageUrl}" alt="">` : ""}</div><div class="container"><div class="hero__content hero__content--center"><p class="eyebrow">Collection</p><h1 class="hero__title">${esc(c.name)}</h1>${c.tagline ? `<p class="hero__text">${esc(c.tagline)}</p>` : ""}</div></div></section>
<div class="container">
${c.description ? `<div class="rte container--text" style="margin:3rem auto;text-align:center">${c.description}</div>` : ""}
${list.length ? grid(list, "grid grid--3") : '<p class="empty">Cette collection sera bientôt dévoilée.</p>'}
${others.length ? `<section class="section"><div class="section__head"><p class="eyebrow">Explorer</p><h2>Les autres collections</h2></div><div class="tiles${others.length === 3 ? " tiles--3" : ""}">${others.slice(0, 4).map((o) => tile(`/collections/${o.slug}/`, o.imageUrl || o.heroImageUrl, o.name, o.tagline)).join("")}</div></section>` : ""}
</div>`;
  return layout({ title: `Collection ${c.name}`, description: c.tagline, urlPath: `/collections/${c.slug}/`, body, ogImage: c.heroImageUrl });
}

function collectionsIndex() {
  const body = `<div class="container"><header class="plp-head"><p class="eyebrow">Univers</p><h1>Les collections</h1><p class="lead">Chaque collection explore une inspiration : une matière, une saison, une lumière.</p></header>
<div class="tiles${collections.length % 3 === 0 ? " tiles--3" : ""}" style="margin-bottom:5rem">${collections.map((c) => tile(`/collections/${c.slug}/`, c.imageUrl || c.heroImageUrl, c.name, c.tagline)).join("")}</div></div>`;
  return layout({ title: "Les collections", description: "Les collections Luxury Scent.", urlPath: "/collections/", body });
}

function textPage({ urlPath, title, html, eyebrow = "" }) {
  const body = `<div class="container container--text"><header class="page-title">${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ""}<h1>${esc(title)}</h1></header><div class="rte" style="margin-bottom:5rem">${html}</div></div>`;
  return layout({ title, urlPath, body });
}

function contactPage() {
  const body = `<div class="container"><header class="page-title"><p class="eyebrow">Contact</p><h1>Nous écrire</h1><p class="lead">${esc(S.openingHours)}</p></header>
<div class="auth" style="max-width:36rem;margin-bottom:5rem">
<form name="contact" method="POST" action="/merci/?f=contact" data-netlify="true" netlify-honeypot="bot-field">
<input type="hidden" name="form-name" value="contact">
${honeypot}
<div class="field-row"><div class="field"><label for="name">Nom</label><input id="name" name="nom" required autocomplete="name"></div>
<div class="field"><label for="email">E-mail</label><input id="email" name="email" type="email" required autocomplete="email"></div></div>
<div class="field"><label for="subject">Sujet</label><input id="subject" name="sujet"></div>
<div class="field"><label for="message">Message</label><textarea id="message" name="message" required minlength="10"></textarea></div>
<button type="submit" class="btn btn--block">Envoyer</button>
</form>
<p class="small muted" style="margin-top:2rem;text-align:center;white-space:pre-line">${S.contactEmail ? `<a href="mailto:${esc(S.contactEmail)}">${esc(S.contactEmail)}</a>\n` : ""}${esc(S.contactPhone)}</p>
</div></div>`;
  return layout({ title: "Contact", description: `Une question ? Écrivez à ${BRAND}.`, urlPath: "/contact/", body });
}

function thanksPage() {
  const body = `<div class="container confirmation"><header class="page-title"><p class="eyebrow">Merci</p><h1 data-thanks-title>Votre message est bien reçu</h1><p class="lead" data-thanks-text>Nous revenons vers vous très vite.</p></header>
<p class="prose-center" style="margin-bottom:5rem"><a href="/parfums/" class="btn btn--outline">Découvrir les parfums</a></p></div>`;
  return layout({ title: "Merci", urlPath: "/merci/", body }).replace("<head>", '<head>\n<meta name="robots" content="noindex">');
}

function notFoundPage() {
  const body = `<div class="container notfound"><p class="eyebrow">Erreur 404</p><h1>Cette page est introuvable</h1><p class="lead">Le lien est peut-être incorrect ou la page a été déplacée.</p><a href="/" class="btn" style="margin-top:1rem">Retour à l'accueil</a></div>`;
  return layout({ title: "Page introuvable", urlPath: "/404.html", body });
}

// ------------------------------------------------------------------ Construction

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(path.join(here, "assets"), path.join(dist, "assets"), { recursive: true });

const urls = [];
const emit = (urlPath, html) => {
  write(urlPath.endsWith("/") ? `${urlPath}index.html` : urlPath, html);
  if (!urlPath.endsWith(".html")) urls.push(urlPath);
};

emit("/", homePage());
emit("/parfums/", listingPage({ urlPath: "/parfums/", eyebrow: "Catalogue", title: "Tous les parfums", lead: "Eaux de parfum, extraits, colognes et coffrets.", list: products }));
for (const p of products) emit(`/parfums/${p.slug}/`, productPage(p));
emit("/collections/", collectionsIndex());
for (const c of collections) emit(`/collections/${c.slug}/`, collectionPage(c));
for (const c of data.categories) {
  const list = productsInCategory(c.slug);
  const parent = data.categories.find((x) => x.slug === c.parentSlug);
  const crumbs = `<nav class="breadcrumb" aria-label="Fil d'Ariane"><a href="/">Accueil</a><span aria-hidden="true">/</span>${parent ? `<a href="/categories/${parent.slug}/">${esc(parent.name)}</a><span aria-hidden="true">/</span>` : ""}<span aria-current="page">${esc(c.name)}</span></nav>`;
  emit(`/categories/${c.slug}/`, listingPage({ urlPath: `/categories/${c.slug}/`, title: parent ? `${parent.name} ${c.name.toLowerCase()}` : c.name, lead: c.description, list, heroImg: parent ? null : c.imageUrl, breadcrumb: crumbs }));
}
const maison = page("notre-maison");
emit("/la-maison/", textPage({ urlPath: "/la-maison/", title: maison?.title ?? "Notre Maison", eyebrow: "La Maison", html: maison?.content ?? "" }));
const faq = page("faq");
emit("/faq/", textPage({ urlPath: "/faq/", title: faq?.title ?? "Questions fréquentes", html: faq?.content ?? "" }));
const ml = page("mentions-legales");
emit("/mentions-legales/", textPage({ urlPath: "/mentions-legales/", title: ml?.title ?? "Mentions légales", html: ml?.content ?? "<p>À compléter.</p>" }));
const conf = page("politique-de-confidentialite");
emit("/confidentialite/", textPage({ urlPath: "/confidentialite/", title: conf?.title ?? "Confidentialité", html: (conf?.content ?? "") + "<p>Les formulaires de ce site (ouverture, disponibilité, contact) sont traités par notre hébergeur Netlify et servent uniquement à vous répondre ou à vous prévenir de l'ouverture.</p>" }));
emit("/contact/", contactPage());
write("/merci/index.html", thanksPage());
write("/404.html", notFoundPage());

write(
  "/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc></url>`).join("\n")}\n</urlset>\n`,
);
write("/robots.txt", `User-agent: *\nAllow: /\nDisallow: /merci/\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`Site vitrine généré dans dist/ : ${urls.length} pages (URL publique : ${SITE_URL}).`);
