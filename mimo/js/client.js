/* ============================================================================
   MIMO – Application client (client.js)
   Repris de Mozaïk : scan du QR de table → carte → personnalisation → panier →
   suggestions complémentaires → validation (réductions, paiement) →
   confirmation → suivi en direct → compte client (fidélité si activée).
   + page d'accueil éditoriale de Mimo (incontournables, chapitres de la carte,
   expérience, univers visuel, infos pratiques, appel final).
   ==========================================================================*/
(function () {
  'use strict';
  var M = window.MIMO, ART = window.MIMO_ART;

  /* ---------- état ---------- */
  var catalog = M.getCatalog();
  var table = null;               // { id, label } — table identifiée par le QR code
  var pendingTableParam = null;   // table du QR pas encore connue (catalogue en cours de synchro)
  var modalState = null;
  var checkout = { discountType: null, promoCode: '', fulfillment: null, payment: 'sur_place', tableId: '' };
  var searchTerm = '';
  var sheetCount = 0;
  var modalCleanup = null;
  var pillStop = null, pillOrderId = null, lastPillStatus = null;

  var PAYMENTS = [
    { id: 'sur_place',  ico: '💶', label: 'Payer sur place', desc: 'Au comptoir, selon les moyens de paiement acceptés chez Mimo' },
    { id: 'card',       ico: '💳', label: 'Carte bancaire en ligne', desc: 'Visa, Mastercard, CB' },
    { id: 'apple_pay',  ico: '🍎', label: 'Apple Pay', desc: 'iPhone / Mac' },
    { id: 'google_pay', ico: '📲', label: 'Google Pay', desc: 'Android' }
  ];
  var STEPS = ['Nouvelle', 'En préparation', 'Prête', 'Terminée'];
  var STEP_LABELS = { 'Nouvelle': 'Reçue', 'En préparation': 'En préparation', 'Prête': 'Prête', 'Terminée': 'Servie' };

  /* ---------- utilitaires ---------- */
  function el(id) { return document.getElementById(id); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function money(n) { return M.money(n); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function S() { return catalog.settings; }
  function C() { return catalog.content; }

  function toast(msg, type) {
    var wrap = el('toastWrap'), t = document.createElement('div');
    while (wrap.children.length > 1) wrap.removeChild(wrap.firstChild); // 2 messages max à l'écran
    t.className = 'toast ' + (type || 'ok');
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateY(-8px)'; }, 2600);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
  }

  /* ---------- catalogue ---------- */
  function findProduct(id) { for (var i = 0; i < catalog.products.length; i++) if (catalog.products[i].id === id) return catalog.products[i]; return null; }
  function findCat(id) { for (var i = 0; i < catalog.categories.length; i++) if (catalog.categories[i].id === id) return catalog.categories[i]; return null; }
  function findGroup(id) { for (var i = 0; i < catalog.optionGroups.length; i++) if (catalog.optionGroups[i].id === id) return catalog.optionGroups[i]; return null; }
  function findTable(id) {
    var key = String(id || '').trim().toLowerCase();
    for (var i = 0; i < catalog.tables.length; i++) if (String(catalog.tables[i].id).toLowerCase() === key) return catalog.tables[i];
    return null;
  }
  function catActive(id) { var c = findCat(id); return !!(c && c.active !== false); }
  function isVisible(p) { return !!p && p.active !== false && catActive(p.categoryId); }
  function hasPrice(p) { return p && p.price !== null && p.price !== undefined && p.price !== '' && !isNaN(Number(p.price)); }
  function isOrderable(p) { return isVisible(p) && p.available !== false && hasPrice(p); }
  function groupsOf(p) { return (p.optionGroupIds || []).map(findGroup).filter(function (g) { return g && (g.choices || []).length; }); }
  function sortedCats() { return catalog.categories.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function productsOf(catId) {
    return catalog.products.filter(function (p) { return p.categoryId === catId && p.active !== false; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }
  function visualOf(p) { return { tint: p.tint, vessel: p.vessel, temp: p.temp, layer: p.layer, tints: p.tints, fruit: p.fruit, art: p.art }; }

  /* ---------- images (photo admin ou illustration) ---------- */
  function mediaHTML(item, alt) {
    var src = item && item.image;
    if (src) {
      if (String(src).indexOf('media:') === 0) {
        var id = String(src).slice(6), local = M.getMedia(id);
        if (local) return '<img src="' + local + '" alt="' + esc(alt || '') + '" loading="lazy">';
        return '<span data-media="' + esc(id) + '" data-alt="' + esc(alt || '') + '" style="display:block;width:100%;height:100%">' + ART.tile(item.visual || item) + '</span>';
      }
      return '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '" loading="lazy">';
    }
    return ART.tile(item.visual || item);
  }
  function hydrateMedia(root) {
    $$('[data-media]', root).forEach(function (node) {
      M.loadMedia(node.getAttribute('data-media'), function (data) {
        if (data && node.parentNode) node.outerHTML = '<img src="' + data + '" alt="' + esc(node.getAttribute('data-alt') || '') + '" loading="lazy">';
      });
    });
  }

  /* =========================================================================
     CONTENUS & INFOS
     ========================================================================= */
  function renderStatic() {
    var s = S(), c = C();
    el('brandMark').innerHTML = ART.logoMark();
    el('footerMark').innerHTML = ART.logoMark(ART.SUN);
    el('badgeMark').innerHTML = ART.logoMark(ART.SUN);
    el('heroMascot').innerHTML = ART.mascot();
    el('expMascot').innerHTML = ART.mascot();
    el('ctaMascot').innerHTML = ART.mascot({ heart: '#f6c33b' });
    $$('.brand-name').forEach(function (n) { n.textContent = s.restaurantName || 'Mimo'; });
    var insta = instaUrl(), handle = s.instagram || 'mimo.aix';

    // Annonce + bandeau défilant (ingrédients de la carte)
    var an = el('announce');
    if (c.announcement) { an.textContent = c.announcement; an.classList.remove('hidden'); } else an.classList.add('hidden');
    var items = (c.marquee || []).filter(Boolean);
    el('marqueeTrack').innerHTML = items.concat(items).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');
    el('marqueeTrack').parentNode.style.display = items.length ? '' : 'none';

    // Bandeau info
    el('topHours').textContent = M.hoursSummary(s);
    el('topInsta').href = insta; el('topInsta').textContent = '@' + handle;
    el('instaBtn').href = insta; el('instaBtn').setAttribute('aria-label', 'Instagram @' + handle + ' (nouvel onglet)'); el('instaBtn').title = 'Suivre @' + handle + ' sur Instagram';

    // Héros
    el('heroKicker').textContent = c.heroKicker || '';
    var words = String(c.heroTitle || '').match(/[^.!?]+[.!?]?/g) || [];
    el('heroTitle').innerHTML = '<span class="sr-only">' + esc((s.restaurantName || 'Mimo') + ', coffee shop à Aix-en-Provence : ') + '</span>' +
      words.map(function (w, i) { return '<span class="w w' + ((words.length === 1 ? 2 : i) % 3 + 1) + '">' + esc(w.trim()) + '</span>'; }).join(' ');
    el('heroText').textContent = c.heroText || '';
    var badge = String(c.heroBadge || '').trim().toUpperCase();
    el('heroBadgeText').textContent = badge ? badge + ' · ' + badge + ' ·' : '';
    el('heroBadgeText').closest('.hv-badge').style.display = badge ? '' : 'none';
    var heroImg = el('heroImg');
    if (c.heroImage) M.resolveImage(c.heroImage, function (src) { if (src) heroImg.src = src; });
    el('heroAddress').textContent = shortAddress(s.address) || 'Aix-en-Provence';

    // Incontournables & carte
    el('featuredTitle').textContent = c.featuredTitle || 'Les incontournables';
    el('featuredText').textContent = c.featuredText || '';
    el('menuTitle').textContent = c.menuTitle || 'La carte';
    el('menuText').textContent = c.menuText || '';

    // Offres (masquées tant qu'elles ne sont pas activées dans l'admin)
    el('studentOffer').style.display = s.studentEnabled ? '' : 'none';
    el('studentPct').textContent = '−' + s.studentDiscountPercent + ' %';
    el('studentText').textContent = c.studentText || '';
    el('loyaltyOffer').style.display = s.loyaltyEnabled ? '' : 'none';
    el('loyaltyPct').textContent = '−' + s.loyaltyDiscountPercent + ' %';
    el('loyaltyPct2').textContent = s.loyaltyDiscountPercent;
    el('loyaltyDelay').textContent = s.loyaltyDelayHours + ' h';
    el('offres').style.display = (s.studentEnabled || s.loyaltyEnabled) ? '' : 'none';
    el('offres').classList.toggle('single', !(s.studentEnabled && s.loyaltyEnabled));

    // Expérience
    el('experienceKicker').textContent = c.experienceKicker || '';
    el('storyTitle').textContent = c.storyTitle || '';
    el('storyText').textContent = c.storyText || '';
    var icons = ['🍪', '🍵', '🥛', '🥡', '☀️', '✨'];
    el('pillars').innerHTML = (c.pillars || []).slice(0, 6).map(function (t, i) { return '<div class="pillar"><i aria-hidden="true">' + icons[i % icons.length] + '</i>' + esc(t) + '</div>'; }).join('');
    el('stepsTitle').textContent = c.stepsTitle || '';
    el('steps').innerHTML = (c.steps || []).map(function (t, i) { return '<li><b>' + (i + 1) + '</b>' + esc(t) + '</li>'; }).join('');
    var hasEvents = !!(c.eventsTitle || c.eventsText);
    el('eventsBox').classList.toggle('hidden', !hasEvents);
    el('eventsTitle').textContent = c.eventsTitle || '';
    el('eventsText').textContent = c.eventsText || '';
    el('storySlogan').textContent = s.slogan || '';

    // Univers
    el('galleryTitle').textContent = c.galleryTitle || 'Univers Mimo';
    el('galleryText').textContent = c.galleryText || '';
    el('galleryHandle').textContent = handle;
    el('galleryInsta').href = insta;

    // Infos
    var maps = s.mapsUrl || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(s.address || ''));
    el('infoAddress').textContent = s.address || '';
    el('mapsLink').href = maps; el('ctaMaps').href = maps;
    var contact = [];
    if (s.phone) contact.push('📞 <a href="tel:' + esc(String(s.phone).replace(/[^\d+]/g, '')) + '">' + esc(s.phone) + '</a>');
    if (s.email) contact.push('✉️ <a href="mailto:' + esc(s.email) + '">' + esc(s.email) + '</a>');
    contact.push('📸 <a href="' + insta + '" target="_blank" rel="noopener">@' + esc(handle) + '</a> sur Instagram.');
    el('infoContact').innerHTML = contact.join('<br>');
    var today = new Date().getDay(), order = [1, 2, 3, 4, 5, 6, 0];
    el('hoursTable').innerHTML = order.map(function (d) {
      var h = s.openingHours[d] || { closed: true };
      return '<tr class="' + (d === today ? 'today' : '') + '"><td>' + M.DAYS[d] + '</td><td>' + (h.closed ? 'Fermé' : esc(M.fmtHour(h.open)) + ' – ' + esc(M.fmtHour(h.close))) + '</td></tr>';
    }).join('');

    // Appel final & pied de page
    el('ctaTitle').textContent = c.ctaTitle || '';
    el('ctaText').textContent = c.ctaText || '';
    el('footerSlogan').textContent = s.slogan || '';
    el('footerInsta').href = insta; el('footerInsta').textContent = 'Instagram @' + handle;
    el('footerInfos').innerHTML = esc(s.address) + '<br>' + esc(M.hoursSummary(s)) + (s.phone ? '<br>' + esc(s.phone) : '');
    el('year').textContent = new Date().getFullYear();
    updateJsonLd();
    renderOpenState();
  }
  function instaUrl() { return 'https://www.instagram.com/' + encodeURIComponent(S().instagram || 'mimo.aix') + '/'; }
  function shortAddress(a) { return String(a || '').replace(/,?\s*\d{5}\s*/, ', ').replace(/,\s*,/g, ',').replace(/,\s*$/, ''); }

  // Données structurées (référencement local) : suivent l'adresse et les horaires saisis dans l'admin
  function updateJsonLd() {
    var node = el('jsonld'); if (!node) return;
    try {
      var s = S(), data = JSON.parse(node.textContent);
      var m = String(s.address || '').match(/^(.*?),?\s*(\d{5})\s+(.+)$/);
      data.name = s.restaurantName || 'Mimo';
      if (m) { data.address.streetAddress = m[1].trim(); data.address.postalCode = m[2]; data.address.addressLocality = m[3].trim(); }
      if (s.phone) data.telephone = s.phone; else delete data.telephone;
      if (s.email) data.email = s.email; else delete data.email;
      data.sameAs = [instaUrl()];
      var EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], groups = {};
      (s.openingHours || []).forEach(function (h, d) { if (h && !h.closed) { var k = h.open + '-' + h.close; (groups[k] = groups[k] || []).push(EN[d]); } });
      data.openingHoursSpecification = Object.keys(groups).map(function (k) { return { '@type': 'OpeningHoursSpecification', dayOfWeek: groups[k], opens: k.split('-')[0], closes: k.split('-')[1] }; });
      node.textContent = JSON.stringify(data, null, 2);
    } catch (e) {}
  }

  function renderOpenState() {
    var s = S(), st = M.openState(s);
    var txt = st.open ? '<i class="dot"></i> Ouvert · jusqu\'à ' + esc(st.closesAt)
      : '<i class="dot dot--off"></i> Fermé' + (st.next ? ' · ouvre ' + esc(st.next.dayLabel) + ' à ' + esc(st.next.at) : '');
    el('openNow').innerHTML = txt;
    el('infoOpen').innerHTML = txt;
    el('topOpen').textContent = st.open ? '☀️ Ouvert aujourd\'hui jusqu\'à ' + st.closesAt : '🌙 Fermé' + (st.next ? ' · ouvre ' + st.next.dayLabel + ' à ' + st.next.at : '');
    var cb = el('closedBanner');
    if (s.ordersPaused) { cb.textContent = '⏸️ Les commandes en ligne sont momentanément en pause. Rendez-vous au comptoir !'; cb.classList.remove('hidden'); }
    else if (!st.open) {
      cb.textContent = 'Mimo est fermé pour le moment' + (st.next ? ' — réouverture ' + st.next.dayLabel + ' à ' + st.next.at : '') + '. ' +
        (s.restrictToOpeningHours ? 'Les commandes reprendront à l\'ouverture.' : 'Vous pouvez consulter la carte.');
      cb.classList.remove('hidden');
    } else cb.classList.add('hidden');
  }
  function orderingBlocked() {
    var s = S();
    if (s.ordersPaused) return 'Les commandes en ligne sont momentanément en pause.';
    if (s.restrictToOpeningHours && !M.openState(s).open) return 'Les commandes en ligne sont possibles pendant les heures d\'ouverture.';
    return '';
  }

  /* =========================================================================
     TABLE (QR CODE)
     ========================================================================= */
  function initTable() {
    var params = new URLSearchParams(location.search);
    var param = params.get('table') || params.get('t');
    if (param) {
      var found = findTable(param);
      if (found && found.active !== false) setTable(found, true);
      else pendingTableParam = param;
    } else {
      table = M.getTable();
    }
    if (table) checkout.fulfillment = 'Sur place';
    renderTable();
  }
  function setTable(t, fromScan) {
    if (!t) { table = null; M.clearTable(); }
    else { table = { id: t.id, label: t.label }; M.saveTable(t); checkout.fulfillment = 'Sur place'; }
    renderTable();
    if (fromScan && t) setTimeout(function () { toast('Bienvenue ! Vous êtes à la ' + t.label + ' ☕'); }, 400);
  }
  function retryPendingTable() {
    if (!pendingTableParam) return;
    var found = findTable(pendingTableParam);
    if (found && found.active !== false) { pendingTableParam = null; setTable(found, true); }
  }
  function renderTable() {
    var chip = el('tableChip'), banner = el('tableBanner');
    if (table) {
      chip.textContent = '📍 ' + table.label;
      chip.classList.remove('hidden');
      banner.classList.remove('hidden');
      el('tbIcon').textContent = String(table.id).replace(/^t/i, 'T');
      el('tbTitle').textContent = 'Vous êtes à la ' + table.label;
      el('tbText').textContent = 'Commandez ici : on vous sert directement à table. Paiement sur place.';
    } else {
      chip.classList.add('hidden');
      banner.classList.add('hidden');
    }
  }
  function openTableModal() {
    var opts = catalog.tables.filter(function (t) { return t.active !== false; }).map(function (t) {
      return '<option value="' + esc(t.id) + '" ' + (table && table.id === t.id ? 'selected' : '') + '>' + esc(t.label) + (t.zone ? ' · ' + esc(t.zone) : '') + '</option>';
    }).join('');
    openModal('' +
      '<div class="modal-title-bar"><h3>📍 Votre table</h3></div><button class="modal-close" data-close aria-label="Fermer">✕</button>' +
      '<div class="modal-body">' +
        '<p class="m-desc">' + (table ? 'Votre commande sera servie à la <b>' + esc(table.label) + '</b>.' : 'Indiquez votre table pour être servi(e) directement.') + '</p>' +
        '<div class="field"><label for="tblSel">Changer de table</label><select class="select" id="tblSel"><option value="">— Choisir —</option>' + opts + '</select></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn--ghost" id="tblClear" type="button">Je ne suis pas à table</button><button class="btn btn--block" id="tblOk" type="button">Valider</button></div>');
    el('tblOk').addEventListener('click', function () { var t = findTable(el('tblSel').value); if (t) setTable(t); closeModal(); });
    el('tblClear').addEventListener('click', function () { setTable(null); checkout.fulfillment = null; closeModal(); toast('Commande sans table (comptoir / à emporter)', 'info'); });
  }

  /* =========================================================================
     SIGNATURES & CARTE
     ========================================================================= */
  function tagsOf(p) {
    var tags = (p.tags || []).slice();
    if ((p.optionGroupIds || []).indexOf('og_temp') >= 0) tags.unshift('Chaud ou glacé');
    return tags;
  }
  function priceHTML(p) {
    if (!hasPrice(p)) return '<span class="price--tbd">Au comptoir · voir l\'ardoise</span>';
    return '<span class="price">' + money(p.price) + '</span>';
  }
  function addBtnHTML(p) {
    if (!hasPrice(p)) return '';
    if (p.available === false) return '<button class="add-btn" disabled aria-label="Indisponible">+</button>';
    return '<button class="add-btn" type="button" data-add="' + esc(p.id) + '" aria-label="Ajouter ' + esc(p.name) + '">+</button>';
  }
  function productCardHTML(p) {
    var tags = tagsOf(p).map(function (t) { return '<span class="pill pill--sage">' + esc(t) + '</span>'; }).join('');
    return '' +
      '<article class="p-card" data-pid="' + esc(p.id) + '">' +
        '<div class="media" data-open="' + esc(p.id) + '" role="button" tabindex="0" aria-label="Voir ' + esc(p.name) + '">' + mediaHTML(p, p.name) +
          (p.available === false ? '<div class="soldout">Épuisé pour aujourd\'hui</div>' : '') +
          '<span class="qty-badge hidden" data-qb="' + esc(p.id) + '"></span>' +
        '</div>' +
        '<div class="p-body">' +
          '<h4 data-open="' + esc(p.id) + '">' + esc(p.name) + '</h4>' +
          '<p class="p-desc">' + esc(p.description || '') + '</p>' +
          (tags ? '<div class="tag-row">' + tags + '</div>' : '') +
          '<div class="p-foot">' + priceHTML(p) + addBtnHTML(p) + '</div>' +
        '</div>' +
      '</article>';
  }

  function renderFeatured() {
    var list = catalog.products.filter(function (p) { return p.featured && isVisible(p); });
    var sec = el('incontournables');
    if (!list.length) { sec.style.display = 'none'; return; }
    sec.style.display = '';
    el('featuredRail').innerHTML = list.map(function (p) {
      return '<div class="feat-card">' +
        '<div class="media" data-open="' + esc(p.id) + '" role="button" tabindex="0">' + mediaHTML(p, p.name) + '</div>' +
        '<div class="fc-body"><b data-open="' + esc(p.id) + '" style="cursor:pointer">' + esc(p.name) + '</b>' +
          '<span class="p-desc" style="-webkit-line-clamp:2;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden">' + esc(p.description || '') + '</span>' +
          '<div class="fc-foot">' + priceHTML(p) + addBtnHTML(p) + '</div></div>' +
      '</div>';
    }).join('');
    bindProductButtons(el('featuredRail'));
    hydrateMedia(el('featuredRail'));
  }

  /* ---------- Chapitres de la carte (présentation éditoriale) ---------- */
  function priceRange(prods) {
    var prices = prods.filter(hasPrice).map(function (p) { return Number(p.price); });
    if (!prices.length) return '';
    var lo = Math.min.apply(null, prices), hi = Math.max.apply(null, prices);
    return lo === hi ? money(lo) : 'de ' + money(lo) + ' à ' + money(hi);
  }
  function scrollToCat(id) {
    if (searchTerm) { el('menuSearch').value = ''; searchTerm = ''; renderMenu(); }
    var t = el('cat-' + id);
    if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.pageYOffset - 140, behavior: 'smooth' });
  }
  function renderChapters() {
    var box = el('chapters');
    var list = sortedCats().filter(function (c) { return c.active !== false && c.story && productsOf(c.id).some(isVisible); });
    box.innerHTML = list.map(function (c) {
      var prods = productsOf(c.id).filter(isVisible), first = prods[0] || {}, range = priceRange(prods);
      var visual = { image: c.image, vessel: c.icon || first.vessel, tint: first.tint, fruit: first.fruit, temp: first.temp, layer: first.layer };
      return '<article class="chapter c-' + esc(c.id) + ' reveal">' +
        '<div class="ch-media">' + mediaHTML(visual, c.imageAlt || c.name) + '</div>' +
        '<div class="ch-copy">' + (c.kicker ? '<span class="eyebrow">' + esc(c.kicker) + '</span>' : '') +
          '<h3>' + esc(c.name) + '</h3><p>' + esc(c.story) + '</p>' +
          '<div class="ch-meta"><span class="pill pill--sage">' + prods.length + ' à la carte</span>' + (range ? '<span class="pill pill--copper">' + esc(range) + '</span>' : '') + '</div>' +
          '<div><button class="btn" type="button" data-jump="' + esc(c.id) + '">Voir et commander <span class="arr" aria-hidden="true">↘</span></button></div>' +
        '</div></article>';
    }).join('');
    $$('[data-jump]', box).forEach(function (b) { b.addEventListener('click', function () { scrollToCat(b.getAttribute('data-jump')); }); });
    hydrateMedia(box);
    observeReveal(box);
  }

  /* ---------- Apparition douce des blocs au défilement ---------- */
  var revealObs = null;
  function observeReveal(root) {
    var nodes = $$('.reveal:not(.in)', root);
    if (!('IntersectionObserver' in window)) { nodes.forEach(function (n) { n.classList.add('in'); }); return; }
    if (!revealObs) revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    nodes.forEach(function (n) { revealObs.observe(n); });
  }

  /* ---------- Galerie : agrandissement ---------- */
  function openZoom(src, alt) {
    openModal('<div class="modal-title-bar"><h3>' + esc(alt || '') + '</h3></div><button class="modal-close" data-close aria-label="Fermer">✕</button>' +
      '<div class="modal-body lightbox"><img src="' + esc(src) + '" alt="' + esc(alt || '') + '"></div>', { wide: true });
  }

  function renderMenu() {
    var bar = el('catBar'), cont = el('menuContainer');
    var chips = '', html = '', q = norm(searchTerm), any = false;
    sortedCats().forEach(function (c) {
      if (c.active === false) return;
      var prods = productsOf(c.id);
      if (q) prods = prods.filter(function (p) { return norm(p.name + ' ' + p.description + ' ' + (p.tags || []).join(' ') + ' ' + c.name).indexOf(q) >= 0; });
      if (!prods.length) return;
      any = true;
      var iconP = prods[0];
      chips += '<button class="cat-chip" type="button" data-cat="' + esc(c.id) + '">' + esc(c.name) + '</button>';
      html += '<section class="cat-section" id="cat-' + esc(c.id) + '">' +
        '<div class="cat-head"><div class="ch-icon">' + ART.tile({ vessel: c.icon || iconP.vessel, tint: iconP.tint, temp: iconP.temp, layer: iconP.layer, tints: iconP.tints }) + '</div>' +
        '<div><h3>' + esc(c.name) + '</h3>' + (c.description ? '<p>' + esc(c.description) + '</p>' : '') + '</div></div>' +
        '<div class="menu-grid">' + prods.map(productCardHTML).join('') + '</div></section>';
    });
    bar.innerHTML = chips;
    cont.innerHTML = any ? html : (q ? '<div class="empty-search">Aucun résultat pour « ' + esc(searchTerm) + ' ».<br><button class="link-btn" type="button" id="clearSearch">Effacer la recherche</button></div>'
      : '<p class="empty-search">La carte est momentanément indisponible.</p>');
    var cs = el('clearSearch'); if (cs) cs.addEventListener('click', function () { el('menuSearch').value = ''; searchTerm = ''; renderMenu(); });

    $$('.cat-chip', bar).forEach(function (chip) {
      chip.addEventListener('click', function () {
        var t = el('cat-' + chip.getAttribute('data-cat'));
        if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.pageYOffset - 140, behavior: 'smooth' });
      });
    });
    bindProductButtons(cont);
    hydrateMedia(cont);
    updateQtyBadges();
    setupCatSpy();
  }
  function bindProductButtons(root) {
    $$('[data-add]', root).forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); quickAdd(b.getAttribute('data-add'), b); });
    });
    $$('[data-open]', root).forEach(function (n) {
      n.addEventListener('click', function () { openProduct(n.getAttribute('data-open')); });
      n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProduct(n.getAttribute('data-open')); } });
    });
  }
  function setupCatSpy() {
    var chips = $$('.cat-chip', el('catBar'));
    function onScroll() {
      var pos = window.pageYOffset + 160, current = null;
      chips.forEach(function (chip) { var t = el('cat-' + chip.getAttribute('data-cat')); if (t && t.offsetTop <= pos) current = chip; });
      chips.forEach(function (c) { c.classList.toggle('active', c === current); });
      if (current && current.scrollIntoView && current.dataset.lastActive !== '1') {
        chips.forEach(function (c) { c.dataset.lastActive = ''; });
        current.dataset.lastActive = '1';
        var bar = el('catBar'); bar.scrollTo({ left: current.offsetLeft - 16, behavior: 'smooth' });
      }
    }
    window.removeEventListener('scroll', window.__miSpy || function () {});
    window.__miSpy = onScroll;
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
  function updateQtyBadges() {
    var counts = {};
    M.getCart().forEach(function (l) { counts[l.productId] = (counts[l.productId] || 0) + l.qty; });
    $$('[data-qb]').forEach(function (b) {
      var n = counts[b.getAttribute('data-qb')] || 0;
      b.textContent = n + ' au panier';
      b.classList.toggle('hidden', !n);
    });
  }

  /* =========================================================================
     MODALE
     ========================================================================= */
  function openModal(html, opts) {
    if (modalCleanup) { try { modalCleanup(); } catch (e) {} modalCleanup = null; }
    var m = el('modal');
    m.className = 'modal' + (opts && opts.wide ? ' modal--wide' : '');
    m.innerHTML = html;
    el('modalWrap').classList.add('show');
    document.body.style.overflow = 'hidden';
    $$('[data-close]', m).forEach(function (b) { b.addEventListener('click', closeModal); });
    hydrateMedia(m);
  }
  function closeModal() {
    el('modalWrap').classList.remove('show');
    document.body.style.overflow = el('cartDrawer').classList.contains('show') ? 'hidden' : '';
    modalState = null;
    if (modalCleanup) { try { modalCleanup(); } catch (e) {} modalCleanup = null; }
  }

  /* =========================================================================
     PRODUIT : personnalisation (options réelles de la carte)
     ========================================================================= */
  function quickAdd(pid, btn) {
    var p = findProduct(pid);
    if (!p || !isOrderable(p)) return;
    if (groupsOf(p).length) { openProduct(pid); return; }
    addLine(p, [], 1);
    afterAdd(p, btn);
  }
  function openProduct(pid) {
    var p = findProduct(pid);
    if (!p || !isVisible(p)) return;
    modalState = { p: p, qty: 1, sel: {} };
    renderProductModal();
  }
  function selectedOptions() {
    var out = [];
    groupsOf(modalState.p).forEach(function (g) {
      (modalState.sel[g.id] || []).forEach(function (cid) {
        var ch = (g.choices || []).filter(function (c) { return c.id === cid; })[0];
        if (ch) out.push({ groupId: g.id, groupName: g.name, choiceId: ch.id, name: ch.name, price: M.round2(ch.price || 0) });
      });
    });
    return out;
  }
  function modalPrice() {
    var unit = Number(modalState.p.price || 0) + selectedOptions().reduce(function (s, o) { return s + o.price; }, 0);
    return M.round2(unit * modalState.qty);
  }
  function renderProductModal() {
    var p = modalState.p, orderable = isOrderable(p);
    var html = '' +
      '<div class="modal-head"><div class="modal-hero">' + mediaHTML(p, p.name) + '</div><button class="modal-close" data-close aria-label="Fermer">✕</button></div>' +
      '<div class="modal-body">' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<div style="margin:-2px 0 8px">' + priceHTML(p) + '</div>' +
        '<p class="m-desc">' + esc(p.description || '') + '</p>' +
        (tagsOf(p).length ? '<div class="tag-row" style="margin-bottom:6px">' + tagsOf(p).map(function (t) { return '<span class="pill pill--sage">' + esc(t) + '</span>'; }).join('') + '</div>' : '');
    if (!hasPrice(p)) {
      html += '<div class="note-box">Proposé au comptoir : le prix et le parfum du moment sont indiqués sur l\'ardoise chez Mimo. La commande en ligne sera possible dès que le prix sera affiché ici.</div>';
    } else if (p.available === false) {
      html += '<div class="note-box">Épuisé pour aujourd\'hui, revenez vite !</div>';
    }
    if (orderable) {
      groupsOf(p).forEach(function (g) {
        var sel = modalState.sel[g.id] || [];
        html += '<div class="opt-group" id="og-' + esc(g.id) + '">' +
          '<h5><span>' + esc(g.name) + '</span>' + (g.required ? '<span class="pill pill--copper">Obligatoire</span>' : '<span class="pill pill--muted">' + (g.type === 'multi' ? 'Facultatif · plusieurs choix' : 'Facultatif') + '</span>') + '</h5>' +
          (g.help ? '<p class="og-help">' + esc(g.help) + '</p>' : '') +
          '<div class="chip-set">' + (g.choices || []).map(function (ch) {
            return '<button type="button" class="opt-chip ' + (sel.indexOf(ch.id) >= 0 ? 'selected' : '') + '" data-g="' + esc(g.id) + '" data-c="' + esc(ch.id) + '" ' + (ch.available === false ? 'disabled' : '') + '>' +
              esc(ch.name) + (Number(ch.price) ? ' <small>+' + money(ch.price) + '</small>' : '') + '</button>';
          }).join('') + '</div></div>';
      });
      html += '<div class="opt-group" style="display:flex;align-items:center;justify-content:space-between"><h5 style="margin:0">Quantité</h5>' +
        '<span class="qty"><button type="button" data-q="-1" aria-label="Moins">−</button><span id="mQty">' + modalState.qty + '</span><button type="button" data-q="1" aria-label="Plus">+</button></span></div>';
    }
    html += '</div><div class="modal-foot">' +
      (orderable
        ? '<button class="btn btn--ghost" data-close type="button">Annuler</button><button class="btn btn--copper btn--block" id="addToCartBtn" type="button">Ajouter · <span id="mPrice">' + money(modalPrice()) + '</span></button>'
        : '<button class="btn btn--block" data-close type="button">Fermer</button>') +
      '</div>';
    openModal(html);
    var m = el('modal');
    $$('[data-g]', m).forEach(function (b) {
      b.addEventListener('click', function () {
        var g = findGroup(b.getAttribute('data-g')), cid = b.getAttribute('data-c');
        var cur = modalState.sel[g.id] || [];
        if (g.type === 'multi') {
          cur = cur.indexOf(cid) >= 0 ? cur.filter(function (x) { return x !== cid; }) : cur.concat([cid]);
        } else {
          cur = (cur[0] === cid && !g.required) ? [] : [cid];
        }
        modalState.sel[g.id] = cur;
        $$('[data-g="' + g.id + '"]', m).forEach(function (x) { x.classList.toggle('selected', cur.indexOf(x.getAttribute('data-c')) >= 0); });
        var box = el('og-' + g.id); if (box) box.classList.remove('invalid');
        el('mPrice').textContent = money(modalPrice());
      });
    });
    $$('[data-q]', m).forEach(function (b) {
      b.addEventListener('click', function () {
        modalState.qty = Math.max(1, Math.min(30, modalState.qty + parseInt(b.getAttribute('data-q'), 10)));
        el('mQty').textContent = modalState.qty; el('mPrice').textContent = money(modalPrice());
      });
    });
    var add = el('addToCartBtn');
    if (add) add.addEventListener('click', function () {
      var missing = groupsOf(p).filter(function (g) { return g.required && !(modalState.sel[g.id] || []).length; });
      if (missing.length) {
        missing.forEach(function (g) { var box = el('og-' + g.id); if (box) box.classList.add('invalid'); });
        var first = el('og-' + missing[0].id); if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast('Choisissez : ' + missing.map(function (g) { return g.name.toLowerCase(); }).join(', '), 'err');
        return;
      }
      addLine(p, selectedOptions(), modalState.qty);
      closeModal();
      afterAdd(p);
    });
  }

  /* ---------- lignes du panier ---------- */
  function optionsKey(opts) { return (opts || []).map(function (o) { return o.groupId + ':' + o.choiceId; }).sort().join('|'); }
  function addLine(p, options, qty) {
    var cart = M.getCart(), key = optionsKey(options);
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].productId === p.id && optionsKey(cart[i].options) === key) {
        cart[i].qty = Math.min(50, cart[i].qty + qty); M.saveCart(cart); return;
      }
    }
    cart.push({
      uid: M.uid('line'), productId: p.id, categoryId: p.categoryId, name: p.name, image: p.image || '',
      visual: visualOf(p), basePrice: M.round2(p.price), options: options, qty: qty, kind: 'product'
    });
    M.saveCart(cart);
  }
  function afterAdd(p, btn) {
    var bar = el('mobileCartBar'); bar.classList.remove('bump'); void bar.offsetWidth; bar.classList.add('bump');
    if (btn) { btn.textContent = '✓'; setTimeout(function () { btn.textContent = '+'; }, 900); }
    if (!maybeSuggestSheet(p)) toast(p.name + ' ajouté au panier ✓');
  }

  /* =========================================================================
     SUGGESTIONS COMPLÉMENTAIRES (règles gérées dans l'admin)
     ========================================================================= */
  function computeSuggestions(cart) { return M.computeSuggestions(cart, catalog); }
  function suggestionAdd(pid, rerender) {
    var p = findProduct(pid);
    if (!p || !isOrderable(p)) return;
    var required = groupsOf(p).filter(function (g) { return g.required; });
    if (required.length) { closeModal(); openProduct(pid); return; }
    addLine(p, [], 1);
    toast(p.name + ' ajouté ✓');
    if (rerender) rerender();
  }
  function maybeSuggestSheet(p) {
    var sg = catalog.suggestions || {};
    if (!sg.enabled || !sg.afterAdd || sheetCount >= 2) return false;
    var res = computeSuggestions(M.getCart());
    if (!res.items.length) return false;
    sheetCount++;
    function render(added) {
      var list = computeSuggestions(M.getCart());
      var rows = list.items.map(function (x) {
        return '<div class="cart-line" style="grid-template-columns:58px 1fr auto;align-items:center">' +
          '<div class="thumb">' + mediaHTML(x, '') + '</div>' +
          '<div><div class="cl-name">' + esc(x.name) + '</div><div class="cl-opts">' + money(x.price) + '</div></div>' +
          '<button class="btn btn--copper btn--sm" type="button" data-sg="' + esc(x.id) + '">+ Ajouter</button></div>';
      }).join('');
      openModal('' +
        '<div class="modal-title-bar"><span class="pill pill--ok">✓ ' + esc(added || p.name) + ' ajouté au panier</span>' +
        '<h3 style="margin-top:10px">' + esc(list.message || res.message || sg.title || 'Ça irait parfaitement avec…') + '</h3></div>' +
        '<button class="modal-close" data-close aria-label="Fermer">✕</button>' +
        '<div class="modal-body" style="padding-top:6px">' + (rows || '<p class="m-desc">Tout est dans votre panier !</p>') + '</div>' +
        '<div class="modal-foot"><button class="btn btn--ghost" data-close type="button">Continuer</button><button class="btn btn--block" id="sheetCart" type="button">Voir le panier · ' + money(M.computeTotals(M.getCart(), {}, catalog).subtotal) + '</button></div>');
      $$('[data-sg]', el('modal')).forEach(function (b) {
        b.addEventListener('click', function () {
          var px = findProduct(b.getAttribute('data-sg'));
          suggestionAdd(b.getAttribute('data-sg'), function () { render(px ? px.name : ''); });
        });
      });
      el('sheetCart').addEventListener('click', function () { closeModal(); openCart(); });
    }
    render();
    return true;
  }

  /* =========================================================================
     PANIER
     ========================================================================= */
  function cartCount() { return M.getCart().reduce(function (n, l) { return n + l.qty; }, 0); }
  function updateCartBadges() {
    var n = cartCount(), sub = M.computeTotals(M.getCart(), {}, catalog).subtotal;
    el('cartCount').textContent = n;
    el('cartCount').style.display = n ? '' : 'none';
    var bar = el('mobileCartBar');
    if (n > 0) {
      bar.classList.add('show'); document.body.classList.add('has-mobile-bar');
      el('mobileCartCount').textContent = n;
      el('mobileCartText').textContent = 'Voir le panier';
      el('mobileCartTotal').textContent = money(sub);
    } else { bar.classList.remove('show'); document.body.classList.remove('has-mobile-bar'); }
    updateQtyBadges();
  }
  // Remet les prix du panier à jour depuis la carte (l'admin a pu modifier un prix)
  function refreshCartFromCatalog() {
    var cart = M.getCart(), changed = false, removed = [];
    cart = cart.filter(function (l) {
      var p = findProduct(l.productId);
      if (!p || !isOrderable(p)) { removed.push(l.name); changed = true; return false; }
      if (M.round2(p.price) !== l.basePrice || p.name !== l.name) { l.basePrice = M.round2(p.price); l.name = p.name; changed = true; }
      l.image = p.image || ''; l.visual = visualOf(p);
      l.options = (l.options || []).filter(function (o) {
        var g = findGroup(o.groupId), ch = g && (g.choices || []).filter(function (c) { return c.id === o.choiceId; })[0];
        if (!ch || ch.available === false) { changed = true; return false; }
        if (M.round2(ch.price || 0) !== o.price) { o.price = M.round2(ch.price || 0); changed = true; }
        return true;
      });
      return true;
    });
    if (changed) M.saveCart(cart);
    if (removed.length) toast(removed.join(', ') + ' n\'est plus disponible et a été retiré du panier', 'info');
  }

  function renderCart() {
    var cart = M.getCart(), body = el('cartBody'), foot = el('cartFoot');
    if (!cart.length) {
      body.innerHTML = '<div class="cart-empty">' + ART.mascot() + '<p>Votre panier est vide.<br>Un matcha, un latte, un cookie ?</p></div>';
      foot.innerHTML = '<a href="#menu" class="btn btn--block btn--lg" id="gotoMenu">Voir la carte</a>';
      el('gotoMenu').addEventListener('click', closeCart);
      updateCartBadges();
      return;
    }
    var html = cart.map(function (l) {
      return '<div class="cart-line">' +
        '<div class="thumb">' + mediaHTML(l, '') + '</div>' +
        '<div><div class="cl-name">' + esc(l.name) + '</div>' +
          (l.options && l.options.length ? '<div class="cl-opts">' + esc(M.lineOptionsText(l)) + '</div>' : '') +
          '<div class="cl-opts">' + money(M.lineUnitPrice(l)) + ' l\'unité</div></div>' +
        '<div class="cl-price">' + money(M.lineTotal(l)) + '</div>' +
        '<div class="cl-actions"><span class="qty"><button type="button" data-dec="' + l.uid + '" aria-label="Retirer un">−</button><span>' + l.qty + '</span><button type="button" data-inc="' + l.uid + '" aria-label="Ajouter un">+</button></span>' +
        '<button class="link-danger" type="button" data-del="' + l.uid + '">Supprimer</button></div>' +
      '</div>';
    }).join('');

    var sg = computeSuggestions(cart);
    if (sg.items.length) {
      html += '<div class="suggest"><h4>' + esc((catalog.suggestions && catalog.suggestions.title) || 'Ça irait parfaitement avec…') + '</h4>' +
        (sg.message ? '<p>' + esc(sg.message) + '</p>' : '<p>Ajoutez-les en un clic.</p>') +
        '<div class="sg-list">' + sg.items.map(function (p) {
          return '<div class="sg-card"><div class="media">' + mediaHTML(p, '') + '</div><div class="sg-body"><span class="sg-name">' + esc(p.name) + '</span>' +
            '<b style="color:var(--green);font-size:13.5px">' + money(p.price) + '</b>' +
            '<button class="btn btn--copper btn--xs btn--block" type="button" data-sgc="' + esc(p.id) + '">+ Ajouter</button></div></div>';
        }).join('') + '</div></div>';
    }
    html += renderCartLoyalty();
    body.innerHTML = html;
    hydrateMedia(body);

    var t = M.computeTotals(cart, {}, catalog);
    var blocked = orderingBlocked();
    foot.innerHTML =
      (table ? '<div class="summary-row" style="color:var(--green);font-weight:700"><span>📍 ' + esc(table.label) + '</span><span>servi à table</span></div>' : '') +
      '<div class="summary-row total"><span>Sous-total</span><span>' + money(t.subtotal) + '</span></div>' +
      (discountHint() ? '<p class="muted" style="font-size:12.5px;margin:2px 0 10px">' + discountHint() + '</p>' : '<div style="height:8px"></div>') +
      (blocked ? '<div class="note-box">' + esc(blocked) + '</div>' : '') +
      '<button class="btn btn--copper btn--block btn--lg" id="checkoutBtn" type="button" ' + (blocked ? 'disabled' : '') + '>Valider ma commande →</button>';
    el('checkoutBtn').addEventListener('click', openCheckout);

    $$('[data-inc]', body).forEach(function (b) { b.addEventListener('click', function () { changeQty(b.getAttribute('data-inc'), 1); }); });
    $$('[data-dec]', body).forEach(function (b) { b.addEventListener('click', function () { changeQty(b.getAttribute('data-dec'), -1); }); });
    $$('[data-del]', body).forEach(function (b) { b.addEventListener('click', function () { removeLine(b.getAttribute('data-del')); }); });
    $$('[data-sgc]', body).forEach(function (b) { b.addEventListener('click', function () { suggestionAdd(b.getAttribute('data-sgc'), renderCart); }); });
    var lt = el('loyaltyApply');
    if (lt) lt.addEventListener('click', function () { checkout.discountType = 'loyalty'; openCheckout(); });
    updateCartBadges();
  }
  function discountHint() {
    var s = S(), list = [];
    if (s.studentEnabled) list.push('réduction étudiante');
    if (s.loyaltyEnabled) list.push('fidélité');
    if ((catalog.promos || []).some(function (p) { return p.active; })) list.push('code promo');
    if (!list.length) return '';
    var t = list.join(', ').replace(/, ([^,]*)$/, ' ou $1');
    return t.charAt(0).toUpperCase() + t.slice(1) + ' à l\'étape suivante.';
  }
  function renderCartLoyalty() {
    var session = M.getSession(); if (!session) return '';
    var cust = M.findCustomerByEmail(session.email); if (!cust) return '';
    var st = M.loyaltyStatus(cust, S());
    if (st.eligible) return '<div class="ok-box" style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span>🎁 <b>−' + S().loyaltyDiscountPercent + ' % fidélité</b> disponible, ' + esc(cust.firstName || '') + ' !</span><button class="btn btn--sm" type="button" id="loyaltyApply">Utiliser</button></div>';
    if (st.availableAt && !st.used) return '<div class="note-box">⏳ Votre −' + S().loyaltyDiscountPercent + ' % fidélité s\'active le ' + formatDateTime(st.availableAt) + '.</div>';
    return '';
  }
  function changeQty(uid, d) {
    var cart = M.getCart();
    for (var i = 0; i < cart.length; i++) if (cart[i].uid === uid) {
      cart[i].qty = cart[i].qty + d;
      if (cart[i].qty < 1) cart.splice(i, 1);
      break;
    }
    M.saveCart(cart); renderCart();
  }
  function removeLine(uid) { M.saveCart(M.getCart().filter(function (l) { return l.uid !== uid; })); renderCart(); }
  function openCart() {
    refreshCartFromCatalog(); renderCart();
    el('cartDrawer').classList.add('show'); el('cartDrawer').setAttribute('aria-hidden', 'false');
    el('overlay').classList.add('show'); document.body.style.overflow = 'hidden';
  }
  function closeCart() {
    el('cartDrawer').classList.remove('show'); el('cartDrawer').setAttribute('aria-hidden', 'true');
    el('overlay').classList.remove('show'); document.body.style.overflow = '';
  }

  /* =========================================================================
     VALIDATION DE COMMANDE
     ========================================================================= */
  function formatDateTime(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return iso; }
  }
  function onlineReady() { var s = S(); return !!(s.stripe_enabled && s.stripe_publishableKey); }
  function isOnlinePay(id) { return id === 'card' || id === 'apple_pay' || id === 'google_pay'; }
  function loyaltyEligible() {
    var session = M.getSession(); if (!session) return null;
    var cust = M.findCustomerByEmail(session.email);
    return cust && M.loyaltyStatus(cust, S()).eligible ? cust : null;
  }
  function currentTotals() {
    return M.computeTotals(M.getCart(), { discountType: checkout.discountType, promoCode: checkout.promoCode, fulfillment: checkout.fulfillment }, catalog);
  }

  function openCheckout() {
    refreshCartFromCatalog();
    var cart = M.getCart();
    if (!cart.length) { toast('Votre panier est vide', 'info'); return; }
    var blocked = orderingBlocked();
    if (blocked) { toast(blocked, 'err'); return; }
    var s = S(), modes = s.fulfillment && s.fulfillment.length ? s.fulfillment : ['Sur place', 'À emporter'];
    if (!checkout.fulfillment || modes.indexOf(checkout.fulfillment) < 0) checkout.fulfillment = table ? (modes.indexOf('Sur place') >= 0 ? 'Sur place' : modes[0]) : modes[0];
    if (checkout.discountType === 'loyalty' && !loyaltyEligible()) checkout.discountType = null;
    var session = M.getSession(), cust = session ? M.findCustomerByEmail(session.email) : null;
    var saved = {}; try { saved = JSON.parse(localStorage.getItem('mimo_contact_v1') || '{}'); } catch (e) {}
    var pre = cust || saved || {};

    var html = '' +
      '<div class="modal-title-bar"><span class="eyebrow">Dernière étape</span><h3>Finaliser ma commande</h3></div>' +
      '<button class="modal-close" data-back aria-label="Retour au panier">✕</button>' +
      '<div class="modal-body">' +
        '<div class="opt-group" style="margin-top:0"><h5>Comment souhaitez-vous la recevoir ?</h5><div class="chip-set" id="coModes">' +
          modes.map(function (m) { return '<button type="button" class="opt-chip" data-mode="' + esc(m) + '">' + (m === 'Sur place' ? '☕ ' : (m === 'À emporter' ? '🥡 ' : '🛵 ')) + esc(m) + '</button>'; }).join('') +
        '</div><div id="coTableBox" style="margin-top:10px"></div></div>' +
        '<div class="grid-2">' +
          '<div class="field"><label for="coFirst">Prénom *</label><input class="input" id="coFirst" autocomplete="given-name" value="' + esc(pre.firstName || '') + '" placeholder="Votre prénom"></div>' +
          '<div class="field"><label for="coLast">Nom</label><input class="input" id="coLast" autocomplete="family-name" value="' + esc(pre.lastName || '') + '" placeholder="Facultatif"></div>' +
        '</div>' +
        '<div class="grid-2">' +
          '<div class="field"><label for="coPhone" id="coPhoneLabel">Téléphone (facultatif)</label><input class="input" id="coPhone" type="tel" autocomplete="tel" value="' + esc(pre.phone || '') + '" placeholder="06 12 34 56 78"></div>' +
          '<div class="field"><label for="coEmail">E-mail (confirmation)</label><input class="input" id="coEmail" type="email" autocomplete="email" value="' + esc(pre.email || '') + '" placeholder="vous@email.fr"></div>' +
        '</div>' +
        '<div class="field hidden" id="addrField"><label for="coAddr">Adresse de livraison *</label><input class="input" id="coAddr" autocomplete="street-address" placeholder="N°, rue, code postal, ville"></div>' +
        '<div class="field"><label for="coNote">Une précision ? (parfum de sirop, allergies…)</label><textarea class="textarea" id="coNote" placeholder="Facultatif"></textarea></div>' +
        '<p class="muted" style="font-size:12px;margin:-4px 0 6px">Vos coordonnées servent uniquement à traiter votre commande. <a href="confidentialite.html" target="_blank" rel="noopener">Confidentialité</a></p>' +
        '<div class="opt-group" id="coDiscountGroup"><h5>Réduction <span class="pill pill--muted">une seule par commande</span></h5><div id="coDiscounts" style="margin-top:8px"></div></div>' +
        '<div class="opt-group"><h5>Paiement</h5><div id="payMethods" style="margin-top:8px"></div><div id="payNote"></div></div>' +
        '<div class="opt-group" id="coSummary"></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn--ghost" data-back type="button">Retour</button><button class="btn btn--copper btn--block btn--lg" id="placeOrderBtn" type="button">Commander</button></div>';
    openModal(html);
    var m = el('modal');
    $$('[data-back]', m).forEach(function (b) { b.addEventListener('click', function () { closeModal(); openCart(); }); });
    $$('[data-mode]', m).forEach(function (b) { b.addEventListener('click', function () { checkout.fulfillment = b.getAttribute('data-mode'); renderModes(); refreshSummary(); }); });
    renderModes(); renderDiscounts(); renderPayMethods(); refreshSummary();
    el('placeOrderBtn').addEventListener('click', placeOrder);
  }

  function renderModes() {
    var m = el('modal'), mode = checkout.fulfillment;
    $$('[data-mode]', m).forEach(function (b) { b.classList.toggle('selected', b.getAttribute('data-mode') === mode); });
    var box = el('coTableBox'), livr = mode === 'Livraison';
    el('addrField').classList.toggle('hidden', !livr);
    el('coPhoneLabel').innerHTML = livr ? 'Téléphone * (livraison)' : 'Téléphone (facultatif)';
    if (mode === 'Sur place') {
      if (table) {
        box.innerHTML = '<div class="ok-box" style="margin:0;display:flex;justify-content:space-between;align-items:center;gap:8px"><span>📍 Servi à la <b>' + esc(table.label) + '</b></span><button class="link-btn" type="button" id="coChangeTable">Changer</button></div>';
        el('coChangeTable').addEventListener('click', function () { table = null; renderModes(); });
      } else {
        var opts = catalog.tables.filter(function (t) { return t.active !== false; }).map(function (t) {
          return '<option value="' + esc(t.id) + '" ' + (checkout.tableId === t.id ? 'selected' : '') + '>' + esc(t.label) + '</option>';
        }).join('');
        box.innerHTML = '<div class="field" style="margin:0"><label for="coTable">Votre table</label><select class="select" id="coTable"><option value="">Je récupère au comptoir</option>' + opts + '</select></div>';
        el('coTable').addEventListener('change', function () {
          checkout.tableId = this.value;
          var t = findTable(this.value); if (t) setTable(t); renderModes();
        });
      }
    } else box.innerHTML = '';
  }

  function renderDiscounts() {
    var s = S(), box = el('coDiscounts'), cards = '';
    if (s.studentEnabled) {
      cards += '<button type="button" class="choice-card ' + (checkout.discountType === 'student' ? 'selected' : '') + '" data-disc="student">' +
        '<span class="cc-ico">🎓</span><span class="cc-main"><b>Je suis étudiant(e) : −' + s.studentDiscountPercent + ' %</b><small>' + esc(C().studentText || 'Carte étudiante à présenter.') + '</small></span><span class="cc-radio"></span></button>';
    }
    var lc = loyaltyEligible();
    if (lc) {
      cards += '<button type="button" class="choice-card ' + (checkout.discountType === 'loyalty' ? 'selected' : '') + '" data-disc="loyalty">' +
        '<span class="cc-ico">🎁</span><span class="cc-main"><b>Ma réduction fidélité : −' + s.loyaltyDiscountPercent + ' %</b><small>Disponible pour vous, ' + esc(lc.firstName || '') + ' !</small></span><span class="cc-radio"></span></button>';
    }
    var hasPromos = (catalog.promos || []).some(function (p) { return p.active; });
    if (hasPromos || checkout.discountType === 'promo') {
      cards += '<div class="choice-card ' + (checkout.discountType === 'promo' ? 'selected' : '') + '" style="flex-wrap:wrap">' +
        '<span class="cc-ico">🏷️</span><span class="cc-main"><b>Code promo</b>' +
        (checkout.discountType === 'promo' ? '<small>Code « ' + esc(checkout.promoCode) + ' » appliqué · <button class="link-btn" type="button" id="promoRemove">retirer</button></small>' : '<small>Vous avez un code ? Saisissez-le.</small>') + '</span>' +
        (checkout.discountType === 'promo' ? '' : '<div class="promo-row" style="width:100%;margin-top:8px"><input class="input" id="promoInput" placeholder="CODE" autocomplete="off"><button class="btn btn--sm" type="button" id="promoApply">Appliquer</button></div>') +
        '</div>';
    }
    box.innerHTML = cards;
    el('coDiscountGroup').style.display = cards ? '' : 'none';
    $$('[data-disc]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        var d = b.getAttribute('data-disc');
        checkout.discountType = checkout.discountType === d ? null : d;
        if (checkout.discountType !== 'promo') checkout.promoCode = '';
        renderDiscounts(); refreshSummary();
      });
    });
    var pa = el('promoApply');
    if (pa) {
      var apply = function () {
        var code = el('promoInput').value.trim().toUpperCase();
        if (!code) return;
        var v = M.validatePromo(code, M.computeTotals(M.getCart(), {}, catalog).subtotal, catalog);
        if (!v.ok) { toast(v.error, 'err'); return; }
        checkout.discountType = 'promo'; checkout.promoCode = v.promo.code;
        toast('Code ' + v.promo.code + ' appliqué ✓'); renderDiscounts(); refreshSummary();
      };
      pa.addEventListener('click', apply);
      el('promoInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') apply(); });
    }
    var pr = el('promoRemove');
    if (pr) pr.addEventListener('click', function (e) { e.stopPropagation(); checkout.discountType = null; checkout.promoCode = ''; renderDiscounts(); refreshSummary(); });
  }

  function renderPayMethods() {
    var wrap = el('payMethods'); if (!wrap) return;
    if (isOnlinePay(checkout.payment) && !onlineReady()) checkout.payment = 'sur_place';
    wrap.innerHTML = PAYMENTS.map(function (p) {
      var ready = p.id === 'sur_place' || onlineReady();
      return '<button type="button" class="choice-card ' + (checkout.payment === p.id ? 'selected' : '') + '" data-pay="' + p.id + '" ' + (ready ? '' : 'disabled') + '>' +
        '<span class="cc-ico">' + (p.ico || '') + '</span><span class="cc-main"><b>' + esc(p.label) + (ready ? '' : ' <span class="pill pill--muted">Bientôt</span>') + '</b><small>' + esc(p.desc) + '</small></span><span class="cc-radio"></span></button>';
    }).join('');
    $$('[data-pay]', wrap).forEach(function (b) {
      b.addEventListener('click', function () { checkout.payment = b.getAttribute('data-pay'); renderPayMethods(); refreshSummary(); });
    });
    el('payNote').innerHTML = onlineReady() ? '' : '<p class="muted" style="font-size:12.5px;margin:4px 0 0">Le paiement en ligne arrive bientôt. Vous réglez sur place, au comptoir ou à table.</p>';
  }

  function refreshSummary() {
    var t = currentTotals(), box = el('coSummary');
    if (checkout.discountType && !t.discountType) { checkout.discountType = null; checkout.promoCode = ''; }
    box.innerHTML = '<h5>Récapitulatif</h5>' +
      M.getCart().map(function (l) {
        return '<div class="order-line"><span>' + l.qty + '× ' + esc(l.name) + (l.options && l.options.length ? '<br><span class="sub">' + esc(M.lineOptionsText(l)) + '</span>' : '') + '</span><span>' + money(M.lineTotal(l)) + '</span></div>';
      }).join('') +
      '<div class="summary-row" style="margin-top:6px"><span>Sous-total</span><span>' + money(t.subtotal) + '</span></div>' +
      (t.discount > 0 ? '<div class="summary-row discount"><span>' + esc(t.discountLabel) + '</span><span>−' + money(t.discount) + '</span></div>' : '') +
      (t.delivery > 0 ? '<div class="summary-row"><span>Livraison</span><span>' + money(t.delivery) + '</span></div>' : '') +
      '<div class="summary-row total"><span>Total</span><span>' + money(t.total) + '</span></div>';
    var btn = el('placeOrderBtn');
    if (btn) btn.textContent = (checkout.payment === 'sur_place' ? 'Commander · ' : 'Payer · ') + money(t.total);
  }

  function placeOrder() {
    var btn = el('placeOrderBtn');
    var first = el('coFirst').value.trim(), last = el('coLast').value.trim();
    var phone = el('coPhone').value.trim(), email = el('coEmail').value.trim();
    var mode = checkout.fulfillment, pay = checkout.payment || 'sur_place';
    if (!first) { toast('Indiquez votre prénom', 'err'); el('coFirst').focus(); return; }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('E-mail invalide', 'err'); el('coEmail').focus(); return; }
    if (mode === 'Livraison') {
      if (!phone) { toast('Le téléphone est obligatoire pour la livraison', 'err'); return; }
      if (!el('coAddr').value.trim()) { toast('Indiquez votre adresse de livraison', 'err'); return; }
    }
    if (isOnlinePay(pay) && !onlineReady()) { toast('Paiement en ligne bientôt disponible : choisissez « Payer sur place »', 'info'); return; }
    var blocked = orderingBlocked(); if (blocked) { toast(blocked, 'err'); return; }
    refreshCartFromCatalog();
    var cart = M.getCart();
    if (!cart.length) { toast('Votre panier est vide', 'info'); closeModal(); return; }

    btn.disabled = true; btn.textContent = 'Envoi de la commande…';
    try { localStorage.setItem('mimo_contact_v1', JSON.stringify({ firstName: first, lastName: last, phone: phone, email: email })); } catch (e) {}
    var t = currentTotals();
    var note = el('coNote').value.trim(), addr = mode === 'Livraison' ? el('coAddr').value.trim() : '';
    var tableInfo = (mode === 'Sur place' && table) ? { id: table.id, label: table.label } : null;

    M.allocateOrderNumber(function (number) {
      var now = new Date().toISOString();
      var order = {
        id: M.uid('o'), number: number, createdAt: now,
        status: 'Nouvelle', statusHistory: [{ status: 'Nouvelle', at: now }],
        customer: { firstName: first, lastName: last, phone: phone, email: email },
        fulfillment: mode, table: tableInfo, address: addr, note: note,
        source: tableInfo ? 'qr-table' : 'web',
        items: cart.map(function (l) {
          return { uid: l.uid, productId: l.productId, categoryId: l.categoryId, name: l.name, basePrice: l.basePrice, options: l.options || [], qty: l.qty, visual: l.visual, image: l.image && l.image.indexOf('data:') === 0 ? '' : (l.image || '') };
        }),
        subtotal: t.subtotal, discount: t.discount, discountLabel: t.discountLabel, discountType: t.discountType || null,
        promoCode: t.promoCode || '', delivery: t.delivery, total: t.total,
        loyaltyApplied: t.discountType === 'loyalty', studentApplied: t.discountType === 'student',
        paymentMethod: pay, paymentStatus: pay === 'sur_place' ? 'À payer' : 'Payée',
        paidAt: pay === 'sur_place' ? null : now, paidWith: pay === 'sur_place' ? null : pay,
        refunds: []
      };
      var syncState = (window.MIMO_FB && window.MIMO_FB.ready) ? 'pending' : 'local';
      M.addOrder(order, function (ok) { syncState = ok ? 'ok' : 'fail'; updateSyncLine(syncState); });

      // Fidélité (identique à MYKONOS)
      var session = M.getSession();
      if (session && email) {
        var cust = M.findCustomerByEmail(email);
        if (cust) {
          if (!cust.firstOrderAt) cust.firstOrderAt = order.createdAt;
          cust.orderCount = (cust.orderCount || 0) + 1;
          cust.lastOrderAt = order.createdAt;
          if (order.loyaltyApplied) cust.loyaltyUsed = true;
          M.upsertCustomer(cust);
        }
      }
      M.addMyOrder(order);
      M.clearCart();
      checkout.discountType = null; checkout.promoCode = '';
      sheetCount = 0;
      sendOrderEmails(order);
      closeCart();
      showConfirmation(order, syncState);
      updateCartBadges();
      startPill(order.id);
    });
  }

  /* =========================================================================
     CONFIRMATION & SUIVI EN DIRECT
     ========================================================================= */
  function syncLineHTML(state) {
    if (state === 'ok') return '<div class="ok-box" style="text-align:center">✓ Commande transmise au comptoir</div>';
    if (state === 'fail') return '<div class="err-box" style="text-align:center">⚠️ Connexion difficile : montrez ce numéro au comptoir pour confirmer votre commande.</div>';
    if (state === 'pending') return '<div class="note-box" style="text-align:center">Transmission au comptoir…</div>';
    return '';
  }
  function updateSyncLine(state) { var n = el('syncLine'); if (n) n.innerHTML = syncLineHTML(state); }
  function statusMessage(o) {
    var where = o.table ? 'à votre table (' + o.table.label + ')' : (o.fulfillment === 'À emporter' ? 'au comptoir' : (o.fulfillment === 'Livraison' ? 'chez vous' : 'au comptoir'));
    switch (o.status) {
      case 'Nouvelle': return 'Commande reçue, elle passe bientôt en préparation.';
      case 'En préparation': return 'Votre commande est en préparation ☕';
      case 'Prête': return o.table ? 'C\'est prêt ! On vous l\'apporte ' + where + '.' : 'C\'est prêt ! Votre commande vous attend ' + where + '.';
      case 'Terminée': return 'Bonne dégustation ! ' + (C().thanksText || '');
      case 'Annulée': return 'Cette commande a été annulée. Pour toute question, adressez-vous au comptoir.';
    }
    return '';
  }
  function trackerHTML(o) {
    if (o.status === 'Annulée') return '<div class="err-box" style="text-align:center">Commande annulée</div>';
    var idx = STEPS.indexOf(o.status);
    return '<div class="tracker">' + STEPS.map(function (s, i) {
      var cls = i < idx ? 'done' : (i === idx ? (s === 'Terminée' ? 'done' : 'now') : '');
      return '<div class="st ' + cls + '"><i></i>' + esc(STEP_LABELS[s]) + '</div>';
    }).join('') + '</div>';
  }
  function orderBodyHTML(o) {
    var paid = o.paidAt;
    return '<div id="trackLive">' + trackerHTML(o) + '<p class="status-msg">' + esc(statusMessage(o)) + '</p></div>' +
      '<div class="opt-group">' +
        (o.items || []).map(function (l) {
          return '<div class="order-line"><span>' + l.qty + '× ' + esc(l.name) + (l.options && l.options.length ? '<br><span class="sub">' + esc(M.lineOptionsText(l)) + '</span>' : '') + '</span><span>' + money(M.lineTotal(l)) + '</span></div>';
        }).join('') +
        (o.discount > 0 ? '<div class="summary-row discount"><span>' + esc(o.discountLabel) + '</span><span>−' + money(o.discount) + '</span></div>' : '') +
        '<div class="summary-row total"><span>Total</span><span>' + money(o.total) + '</span></div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">' +
          '<span class="pill pill--sage">' + esc(o.table ? '📍 ' + o.table.label : o.fulfillment) + '</span>' +
          (paid ? '<span class="pill pill--ok">✓ Payée</span>' : '<span class="pill pill--copper">💶 À régler sur place</span>') +
          (o.studentApplied ? '<span class="pill pill--blue">🎓 Carte étudiante à présenter</span>' : '') +
        '</div>' +
      '</div>';
  }
  function showConfirmation(order, syncState) {
    var loggedIn = !!M.getSession();
    var alreadyClient = order.customer.email && M.findCustomerByEmail(order.customer.email);
    var account = '';
    if (S().loyaltyEnabled && !loggedIn && !alreadyClient) {
      account = '<div class="offer offer--student" style="margin-top:6px"><h3 style="font-size:19px">🎁 −' + S().loyaltyDiscountPercent + ' % sur votre prochaine commande</h3>' +
        '<p>Créez votre compte en 20 secondes : la réduction s\'active ' + S().loyaltyDelayHours + ' h après cette commande.</p>' +
        '<button class="btn btn--sage btn--block" type="button" id="confCreateAccount">Créer mon compte</button></div>';
    }
    openModal('' +
      '<div class="confirm-hero"><button class="modal-close" data-close aria-label="Fermer">✕</button>' +
        '<div class="eyebrow-light">Merci ' + esc(order.customer.firstName) + ' !</div>' +
        '<div class="num">#' + esc(order.number) + '</div><h3>Commande confirmée</h3>' +
        (S().email_enabled && order.customer.email ? '<p style="margin:6px 0 0;color:#efe4cf;font-size:13.5px">Un e-mail de confirmation vous a été envoyé.</p>' : '') +
      '</div>' +
      '<div class="modal-body"><div id="syncLine">' + syncLineHTML(syncState) + '</div>' + orderBodyHTML(order) + account + '</div>' +
      '<div class="modal-foot"><button class="btn btn--block" data-close type="button">Retour à la carte</button></div>');
    var ca = el('confCreateAccount');
    if (ca) ca.addEventListener('click', function () { openAccountModal(order.customer, order); });
    watchInModal(order.id);
  }
  function watchInModal(id) {
    var stop = M.watchOrder(id, function (o) {
      if (!o) return;
      var live = el('trackLive');
      if (live) live.innerHTML = trackerHTML(o) + '<p class="status-msg">' + esc(statusMessage(o)) + '</p>';
    });
    modalCleanup = stop;
  }
  function openTracking(id) {
    var o = M.findOrder(id);
    var mine = M.getMyOrders().filter(function (x) { return x.id === id; })[0];
    if (!o && !mine) return;
    openModal('' +
      '<div class="confirm-hero"><button class="modal-close" data-close aria-label="Fermer">✕</button>' +
        '<div class="eyebrow-light">Suivi de commande</div>' +
        '<div class="num">#' + esc((o || mine).number) + '</div></div>' +
      '<div class="modal-body" id="trackBody">' + (o ? orderBodyHTML(o) : '<p class="m-desc">Chargement…</p>') + '</div>' +
      '<div class="modal-foot"><button class="btn btn--block" data-close type="button">Fermer</button></div>');
    var stop = M.watchOrder(id, function (ord) { if (ord && el('trackBody')) el('trackBody').innerHTML = orderBodyHTML(ord); });
    modalCleanup = stop;
  }

  // Pastille « Ma commande » (suivi permanent de la dernière commande active)
  function startPill(id) {
    if (pillStop) { try { pillStop(); } catch (e) {} pillStop = null; }
    pillOrderId = id; lastPillStatus = null;
    var pill = el('trackPill');
    pillStop = M.watchOrder(id, function (o) {
      if (!o) return;
      var recent = Date.now() - new Date(o.createdAt).getTime() < 6 * 3600 * 1000;
      var active = recent && o.status !== 'Terminée' && o.status !== 'Annulée';
      if (lastPillStatus && lastPillStatus !== o.status && o.status === 'Prête') {
        toast('☕ Votre commande #' + o.number + ' est prête !');
        try { if (navigator.vibrate) navigator.vibrate([120, 80, 120]); } catch (e) {}
      }
      lastPillStatus = o.status;
      if (active) {
        pill.innerHTML = '<span class="dot"></span> #' + esc(o.number) + ' · ' + esc(STEP_LABELS[o.status] || o.status);
        pill.classList.add('show');
      } else pill.classList.remove('show');
    });
  }
  function resumePill() {
    var mine = M.getMyOrders();
    if (mine.length && Date.now() - new Date(mine[0].createdAt).getTime() < 6 * 3600 * 1000) startPill(mine[0].id);
  }

  /* =========================================================================
     COMPTE CLIENT & FIDÉLITÉ (repris de MYKONOS)
     ========================================================================= */
  function myOrdersHTML() {
    var list = M.getMyOrders();
    if (!list.length) return '<p class="muted" style="font-size:13.5px;margin:0">Aucune commande récente sur cet appareil.</p>';
    return list.slice(0, 6).map(function (x) {
      var o = M.findOrder(x.id);
      return '<button type="button" class="choice-card" data-track="' + esc(x.id) + '"><span class="cc-ico">☕</span><span class="cc-main"><b>Commande #' + esc(x.number) + '</b><small>' +
        esc(formatDateTime(x.createdAt)) + ' · ' + money(x.total) + (o ? ' · ' + esc(o.status === 'Terminée' ? 'Servie' : o.status) : '') + '</small></span><span>›</span></button>';
    }).join('');
  }
  function openAccountModal(prefill, linkedOrder) {
    var session = M.getSession();
    if (session && !linkedOrder) { openMySpace(); return; }
    prefill = prefill || {};
    var loyal = !!S().loyaltyEnabled, nm = S().restaurantName || 'Mimo';
    openModal('' +
      '<div class="modal-title-bar"><span class="eyebrow">' + (loyal ? 'Fidélité' : 'Mon compte') + '</span><h3>Créer mon compte ' + esc(nm) + '</h3></div><button class="modal-close" data-close aria-label="Fermer">✕</button>' +
      '<div class="modal-body">' +
        (loyal ? '<p class="m-desc">Profitez de <b>−' + S().loyaltyDiscountPercent + ' %</b> sur votre prochaine commande (activée ' + S().loyaltyDelayHours + ' h après votre 1ʳᵉ commande).</p>'
               : '<p class="m-desc">Retrouvez vos commandes et gagnez du temps : vos coordonnées seront pré-remplies.</p>') +
        '<div class="grid-2"><div class="field"><label for="acFirst">Prénom *</label><input class="input" id="acFirst" value="' + esc(prefill.firstName || '') + '"></div>' +
        '<div class="field"><label for="acLast">Nom *</label><input class="input" id="acLast" value="' + esc(prefill.lastName || '') + '"></div></div>' +
        '<div class="field"><label for="acEmail">E-mail *</label><input class="input" id="acEmail" type="email" value="' + esc(prefill.email || '') + '"></div>' +
        '<div class="field"><label for="acPhone">Téléphone *</label><input class="input" id="acPhone" type="tel" value="' + esc(prefill.phone || '') + '"></div>' +
        '<label class="check field"><input type="checkbox" id="acNews"> Je souhaite recevoir les nouveautés de ' + esc(nm) + ' par e-mail (facultatif, désinscription à tout moment).</label>' +
        '<p class="muted" style="font-size:12px">En créant un compte, vous acceptez que ' + esc(nm) + ' conserve ces informations pour gérer vos commandes' + (loyal ? ' et votre fidélité' : '') + '. <a href="confidentialite.html" target="_blank" rel="noopener">Politique de confidentialité</a></p>' +
        (linkedOrder ? '' : '<div class="opt-group"><h5>Mes commandes récentes</h5>' + myOrdersHTML() + '</div>') +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn--ghost" id="acLoginLink" type="button">J\'ai déjà un compte</button><button class="btn btn--block" id="acCreate" type="button">Créer mon compte</button></div>');
    el('acLoginLink').addEventListener('click', openLoginModal);
    el('acCreate').addEventListener('click', function () { createAccount(linkedOrder); });
    bindTrackButtons();
  }
  function bindTrackButtons() {
    $$('[data-track]', el('modal')).forEach(function (b) { b.addEventListener('click', function () { openTracking(b.getAttribute('data-track')); }); });
  }
  function createAccount(linkedOrder) {
    var first = el('acFirst').value.trim(), last = el('acLast').value.trim();
    var email = el('acEmail').value.trim(), phone = el('acPhone').value.trim(), news = el('acNews').checked;
    if (!first || !last) { toast('Prénom et nom requis', 'err'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('E-mail invalide', 'err'); return; }
    if (!phone) { toast('Téléphone requis', 'err'); return; }
    var existing = M.findCustomerByEmail(email);
    if (existing && existing.createdAt) { toast('Un compte existe déjà avec cet e-mail : connectez-vous.', 'info'); openLoginModal(); return; }
    var cust = existing || {};
    cust.firstName = first; cust.lastName = last; cust.email = email; cust.phone = phone;
    cust.newsletter = !!news; cust.createdAt = cust.createdAt || new Date().toISOString();
    cust.orderCount = cust.orderCount || 0; cust.loyaltyUsed = cust.loyaltyUsed || false;
    if (linkedOrder) {
      cust.firstOrderAt = cust.firstOrderAt || linkedOrder.createdAt;
      cust.orderCount = Math.max(cust.orderCount, 1);
      cust.lastOrderAt = linkedOrder.createdAt;
    }
    M.upsertCustomer(cust);
    M.saveSession({ email: email, firstName: first });
    if (news) M.addNewsletter({ email: email, name: first + ' ' + last });
    closeModal();
    toast('Compte créé, bienvenue ' + first + ' ! ♡');
    refreshSessionUI();
  }
  function openLoginModal() {
    openModal('' +
      '<div class="modal-title-bar"><h3>Content de vous revoir !</h3></div><button class="modal-close" data-close aria-label="Fermer">✕</button>' +
      '<div class="modal-body"><p class="m-desc">Entrez votre e-mail pour retrouver votre compte et votre fidélité.</p>' +
      '<div class="field"><label for="loginEmail">E-mail</label><input class="input" id="loginEmail" type="email" placeholder="vous@email.fr"></div></div>' +
      '<div class="modal-foot"><button class="btn btn--ghost" id="toCreate" type="button">Créer un compte</button><button class="btn btn--block" id="doLogin" type="button">Se connecter</button></div>');
    el('toCreate').addEventListener('click', function () { openAccountModal({}, null); });
    el('doLogin').addEventListener('click', function () {
      var cust = M.findCustomerByEmail(el('loginEmail').value.trim());
      if (!cust) { toast('Aucun compte trouvé avec cet e-mail', 'err'); return; }
      M.saveSession({ email: cust.email, firstName: cust.firstName });
      closeModal(); toast('Bonjour ' + (cust.firstName || '') + ' ! ☕'); refreshSessionUI();
    });
  }
  function loyaltyPill(cust) {
    var st = M.loyaltyStatus(cust, S()), pct = S().loyaltyDiscountPercent;
    return st.used ? '<span class="pill pill--muted">Réduction utilisée</span>'
      : st.eligible ? '<span class="pill pill--ok">−' + pct + ' % disponible !</span>'
      : st.availableAt ? '<span class="pill pill--copper">−' + pct + ' % le ' + formatDateTime(st.availableAt) + '</span>'
      : '<span class="pill pill--muted">Passez une 1ʳᵉ commande</span>';
  }
  function openMySpace() {
    var session = M.getSession(), cust = session ? M.findCustomerByEmail(session.email) : null;
    openModal('' +
      '<div class="modal-title-bar"><span class="eyebrow">Mon espace</span><h3>' + (cust ? 'Bonjour ' + esc(cust.firstName || '') + ' ☕' : 'Mes commandes') + '</h3></div><button class="modal-close" data-close aria-label="Fermer">✕</button>' +
      '<div class="modal-body">' +
        (cust ? '<div class="opt-group" style="margin-top:0"><h5>' + (S().loyaltyEnabled ? 'Fidélité' : 'Mon compte') + '</h5><p style="margin:4px 0 0">' + (cust.orderCount || 0) + ' commande(s)' + (S().loyaltyEnabled ? ' · ' + loyaltyPill(cust) : '') + '</p></div>' : '') +
        '<div class="opt-group"><h5>Mes commandes récentes</h5>' + myOrdersHTML() + '</div>' +
      '</div>' +
      '<div class="modal-foot">' + (cust ? '<button class="btn btn--ghost" id="logoutBtn" type="button">Se déconnecter</button>' : '<button class="btn btn--ghost" id="toCreate2" type="button">Créer un compte</button>') +
      '<button class="btn btn--block" data-close type="button">Fermer</button></div>');
    var lo = el('logoutBtn'); if (lo) lo.addEventListener('click', function () { M.clearSession(); closeModal(); refreshSessionUI(); toast('Déconnecté(e)', 'info'); });
    var tc = el('toCreate2'); if (tc) tc.addEventListener('click', function () { openAccountModal({}, null); });
    bindTrackButtons();
  }
  function refreshSessionUI() {
    var session = M.getSession(), box = el('loyaltyStatusBox'), btn = el('openAccountBtn');
    if (!session) {
      btn.textContent = 'Créer mon compte';
      box.innerHTML = '<button class="link-btn" type="button" id="loginSmall">J\'ai déjà un compte →</button>';
      el('loginSmall').addEventListener('click', openLoginModal);
      return;
    }
    var cust = M.findCustomerByEmail(session.email);
    btn.textContent = 'Mon espace';
    box.innerHTML = cust ? '<div style="font-size:14px">👋 <b>' + esc(cust.firstName || '') + '</b> · ' + (cust.orderCount || 0) + ' commande(s)' + (S().loyaltyEnabled ? ' · ' + loyaltyPill(cust) : '') + '</div>' : '';
  }

  /* =========================================================================
     E-MAILS (EmailJS, comme MYKONOS)
     ========================================================================= */
  function emailReady() { var s = S(); return !!(s.email_enabled && window.emailjs && s.emailjs_publicKey && s.emailjs_serviceId); }
  function orderToText(order) {
    return order.items.map(function (l) {
      var d = M.lineOptionsText(l);
      return '• ' + l.qty + '× ' + l.name + ' — ' + money(M.lineTotal(l)) + (d ? '\n   ' + d : '');
    }).join('\n');
  }
  function sendOrderEmails(order) {
    if (!emailReady()) return;
    var s = S();
    var params = {
      order_number: order.number,
      customer_name: order.customer.firstName + ' ' + (order.customer.lastName || ''),
      first_name: order.customer.firstName, customer_email: order.customer.email, customer_phone: order.customer.phone,
      items: orderToText(order), subtotal: money(order.subtotal),
      discount: order.discount > 0 ? '-' + money(order.discount) + ' (' + order.discountLabel + ')' : 'Aucune',
      delivery: order.delivery > 0 ? money(order.delivery) : 'Non', total: money(order.total),
      fulfillment: order.fulfillment + (order.table ? ' — ' + order.table.label : ''),
      address: order.address || (order.table ? order.table.label : 'Retrait au comptoir'),
      wanted: new Date(order.createdAt).toLocaleString('fr-FR'), note: order.note || '—',
      restaurant_name: s.restaurantName, restaurant_phone: s.phone, restaurant_address: s.address
    };
    try {
      window.emailjs.init({ publicKey: s.emailjs_publicKey });
      if (s.emailjs_templateClient && order.customer.email) window.emailjs.send(s.emailjs_serviceId, s.emailjs_templateClient, params).catch(function (e) { console.warn('email client', e); });
      if (s.emailjs_templateAdmin) window.emailjs.send(s.emailjs_serviceId, s.emailjs_templateAdmin, Object.assign({}, params, { to_email: s.admin_notify_email || s.email })).catch(function (e) { console.warn('email admin', e); });
    } catch (e) { console.warn(e); }
  }

  /* =========================================================================
     LIAISONS GLOBALES
     ========================================================================= */
  function openMenuPhoto() {
    openModal('<div class="modal-title-bar"><h3>La carte chez Mimo</h3></div><button class="modal-close" data-close aria-label="Fermer">✕</button>' +
      '<div class="modal-body lightbox"><img src="assets/carte-mimo.webp" alt="Carte de Mimo avec les prix : les classiques, coffee, gâteaux, matcha et sans café"></div>', { wide: true });
  }
  function rerenderAll() {
    renderStatic(); renderFeatured(); renderChapters(); renderMenu(); refreshSessionUI(); updateCartBadges();
    if (el('cartDrawer').classList.contains('show')) { refreshCartFromCatalog(); renderCart(); }
  }
  function bindGlobal() {
    el('openCart').addEventListener('click', openCart);
    el('closeCart').addEventListener('click', closeCart);
    el('overlay').addEventListener('click', closeCart);
    el('mobileCartBar').addEventListener('click', openCart);
    el('modalBackdrop').addEventListener('click', closeModal);
    el('tableChip').addEventListener('click', openTableModal);
    el('accountBtn').addEventListener('click', function () { if (M.getSession()) openMySpace(); else if (M.getMyOrders().length) openMySpace(); else openAccountModal({}, null); });
    el('openAccountBtn').addEventListener('click', function () { if (M.getSession()) openMySpace(); else openAccountModal({}, null); });
    el('trackPill').addEventListener('click', function () { if (pillOrderId) openTracking(pillOrderId); });
    el('footerTrack').addEventListener('click', function (e) { e.preventDefault(); openMySpace(); });
    el('menuPhotoBtn').addEventListener('click', openMenuPhoto);
    $$('[data-zoom]').forEach(function (b) { b.addEventListener('click', function () { openZoom(b.getAttribute('data-zoom'), b.getAttribute('data-alt')); }); });
    function railStep(dir) { var r = el('featuredRail'), card = r.firstElementChild; r.scrollBy({ left: dir * ((card ? card.getBoundingClientRect().width : 280) + 16), behavior: 'smooth' }); }
    el('railPrev').addEventListener('click', function () { railStep(-1); });
    el('railNext').addEventListener('click', function () { railStep(1); });
    var st;
    el('menuSearch').addEventListener('input', function () {
      var v = this.value; clearTimeout(st);
      st = setTimeout(function () { searchTerm = v.trim(); renderMenu(); }, 160);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (el('modalWrap').classList.contains('show')) closeModal(); else closeCart(); } });
    window.addEventListener('mimo:cart-updated', updateCartBadges);
    window.addEventListener('mimo:catalog-updated', function () {
      catalog = M.getCatalog();
      retryPendingTable();
      if (el('modalWrap').classList.contains('show')) { renderStatic(); renderFeatured(); renderChapters(); renderMenu(); updateCartBadges(); }
      else rerenderAll();
    });
    window.addEventListener('storage', function (e) {
      if (e.key === M.KEYS.catalog) { catalog = M.getCatalog(); rerenderAll(); }
      if (e.key === M.KEYS.cart) updateCartBadges();
    });
  }

  function init() {
    initTable();
    renderStatic();
    renderFeatured();
    renderChapters();
    renderMenu();
    bindGlobal();
    observeReveal(document);
    refreshSessionUI();
    refreshCartFromCatalog();
    updateCartBadges();
    resumePill();
    setInterval(function () { renderOpenState(); refreshSessionUI(); }, 60000);
    // Arrivée par QR code de table : on amène directement le client à la carte
    if (table && new URLSearchParams(location.search).get('table') && window.matchMedia('(max-width: 720px)').matches) {
      setTimeout(function () { var m = el('menu'); if (m) window.scrollTo({ top: m.getBoundingClientRect().top + window.pageYOffset - 70, behavior: 'smooth' }); }, 900);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // Exposé pour les tests automatisés
  window.MIMO_CLIENT = { computeSuggestions: function () { return computeSuggestions(M.getCart()); } };
})();
