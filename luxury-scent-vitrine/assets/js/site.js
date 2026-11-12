/* Luxury Scent — site vitrine. JavaScript sans dépendance. */
(function () {
  "use strict";
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
  var price = function (cents) { return euro.format(cents / 100); };

  /* En-tête transparent au-dessus de la bannière d'accueil */
  var header = $("[data-header]");
  if (header && document.body.classList.contains("has-hero-page")) {
    var onScroll = function () { header.classList.toggle("is-overlay", window.scrollY < 40); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Menu mobile */
  var menu = $("[data-menu]");
  var opener = $("[data-menu-open]");
  function setMenu(open) {
    if (!menu) return;
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    if (opener) opener.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
    if (open) { var f = $("button, a", menu.querySelector(".drawer__panel")); if (f) f.focus(); } else if (opener) opener.focus();
  }
  if (opener) opener.addEventListener("click", function () { setMenu(true); });
  $$("[data-menu-close]").forEach(function (el) { el.addEventListener("click", function () { setMenu(false); }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu && menu.classList.contains("is-open")) setMenu(false); });
  $$("[data-mnav]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var sub = document.getElementById(btn.getAttribute("aria-controls"));
      var open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      if (sub) sub.hidden = !open;
    });
  });

  /* Apparitions au défilement */
  var reveals = $$(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* Fiche produit : choix de la contenance */
  var sizeInputs = $$('.sizes input[type="radio"]');
  if (sizeInputs.length) {
    var priceEl = $("[data-price-out]");
    var compareEl = $("[data-compare-out]");
    var perEl = $("[data-per-out]");
    var notifySize = $("[data-notify-size]");
    var update = function (input) {
      if (priceEl) priceEl.textContent = price(Number(input.dataset.price));
      if (compareEl) {
        var cmp = input.dataset.compare;
        compareEl.hidden = !cmp;
        compareEl.textContent = cmp ? price(Number(cmp)) : "";
      }
      if (perEl) perEl.textContent = (input.dataset.per100 ? "Soit " + price(Number(input.dataset.per100)) + " les 100 ml · " : "") + "Prix indicatif TTC.";
      if (notifySize) notifySize.value = input.value;
    };
    sizeInputs.forEach(function (i) { i.addEventListener("change", function () { update(i); }); });
  }

  /* Catalogue : filtres et tri côté navigateur */
  var filters = $("[data-filters]");
  var gridEl = $("[data-grid]");
  if (filters && gridEl) {
    var cells = $$(":scope > div", gridEl);
    var original = cells.slice();
    var countEl = $("[data-count]", filters);
    var emptyEl = $("[data-empty]");
    var sortEl = $("[data-sort]", filters);
    var apply = function () {
      var genders = $$("[data-filter-gender][aria-pressed='true']", filters).map(function (b) { return b.dataset.filterGender; });
      var fams = $$("[data-filter-family][aria-pressed='true']", filters).map(function (b) { return b.dataset.filterFamily; });
      var shown = 0;
      cells.forEach(function (cell) {
        var card = $(".card", cell);
        var g = card.dataset.gender;
        var f = (card.dataset.families || "").split("|");
        var ok = (!genders.length || genders.indexOf(g) !== -1) && (!fams.length || fams.some(function (x) { return f.indexOf(x) !== -1; }));
        cell.hidden = !ok;
        if (ok) { shown++; cell.classList.add("is-visible"); }
      });
      if (countEl) countEl.textContent = shown + " produit" + (shown > 1 ? "s" : "");
      if (emptyEl) emptyEl.hidden = shown !== 0;
    };
    var sort = function () {
      var mode = sortEl ? sortEl.value : "featured";
      var list = original.slice();
      var get = function (cell) { return $(".card", cell).dataset; };
      if (mode === "price_asc") list.sort(function (a, b) { return get(a).price - get(b).price; });
      if (mode === "price_desc") list.sort(function (a, b) { return get(b).price - get(a).price; });
      if (mode === "name") list.sort(function (a, b) { return get(a).name.localeCompare(get(b).name, "fr"); });
      if (mode === "new") list.sort(function (a, b) { return get(b).new - get(a).new; });
      list.forEach(function (cell) { gridEl.appendChild(cell); });
    };
    filters.addEventListener("click", function (e) {
      var chip = e.target.closest(".filter-chip");
      if (!chip) return;
      chip.setAttribute("aria-pressed", chip.getAttribute("aria-pressed") === "true" ? "false" : "true");
      apply();
    });
    if (sortEl) sortEl.addEventListener("change", sort);
  }

  /* Page de remerciement adaptée au formulaire envoyé */
  var thanksTitle = $("[data-thanks-title]");
  if (thanksTitle) {
    var f = new URLSearchParams(location.search).get("f");
    var texts = {
      ouverture: ["Vous êtes inscrit·e", "Nous vous enverrons l'invitation à l'ouverture de la boutique en ligne."],
      disponibilite: ["C'est noté", "Nous vous prévenons dès que ce parfum est disponible à la commande."],
      contact: ["Votre message est bien reçu", "Nous revenons vers vous très vite."],
    }[f];
    if (texts) { thanksTitle.textContent = texts[0]; var t = $("[data-thanks-text]"); if (t) t.textContent = texts[1]; }
  }
})();
