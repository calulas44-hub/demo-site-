/* ============================================================================
   MOZAÏK – Espace gérant (admin.js)
   Reprend toutes les fonctions de l'admin MYKONOS (commandes en direct + son,
   produits, catégories, promotions, clients, newsletter, tickets de caisse,
   chiffre d'affaires, QR code, réglages, sauvegarde) et ajoute : historique
   filtrable, options & suppléments, suggestions du panier, tables + QR par
   table, encaissements / annulations / remboursements, contenus du site.
   Tout est branché sur la MÊME source de données que le site client.
   ==========================================================================*/
(function () {
  'use strict';
  var M = window.MOZAIK, ART = window.MZ_ART;
  var catalog = M.getCatalog();
  var current = 'dashboard';

  var STATUSES = ['Nouvelle', 'En préparation', 'Prête', 'Terminée', 'Annulée'];
  var FINAL = { 'Terminée': 1, 'Annulée': 1 };
  var NEXT = { 'Nouvelle': ['En préparation', 'Lancer la préparation'], 'En préparation': ['Prête', 'Marquer prête'], 'Prête': ['Terminée', 'Servie / remise'] };
  var PAID_WITH = [['card_tpe', '💳 Carte (TPE)'], ['cash', '💶 Espèces'], ['ticket_resto', '🎫 Titre-restaurant'], ['other', 'Autre']];
  var MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  /* =========================================================================
     UTILITAIRES
     ========================================================================= */
  function el(id) { return document.getElementById(id); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function money(n) { return M.money(n); }
  function num(v, d) { var x = parseFloat(String(v).replace(',', '.')); return isNaN(x) ? (d === undefined ? 0 : d) : x; }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function S() { return catalog.settings; }
  function vat() { return num(S().vatRate, 10); }
  function fmtDT(iso) { if (!iso) return '—'; var d = new Date(iso); return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  function fmtT(iso) { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  function ago(iso) {
    var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'à l\'instant'; if (m < 60) return 'il y a ' + m + ' min';
    var h = Math.floor(m / 60); if (h < 24) return 'il y a ' + h + ' h ' + (m % 60 ? (m % 60) + ' min' : '');
    return fmtDT(iso);
  }
  function toast(msg, type) {
    var wrap = el('toastWrap'), t = document.createElement('div');
    t.className = 'toast ' + (type || 'ok'); t.textContent = msg; wrap.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; }, 2600);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
  }
  function persist() {
    M.saveCatalog(catalog);
    var s = el('admSaveState'); s.textContent = 'Enregistré ✓'; s.className = 'pill pill--ok';
  }
  function downloadFile(name, content, type) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: type || 'text/plain' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 500);
  }
  function csvDownload(name, rows) {
    var csv = rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(';'); }).join('\n');
    downloadFile(name, '﻿' + csv, 'text/csv'); // BOM + « ; » pour Excel FR
  }
  function amount(n) { return M.round2(n).toFixed(2).replace('.', ','); }
  function sw(attr, on, label) { return '<label class="check"><span class="switch"><input type="checkbox" ' + attr + ' ' + (on ? 'checked' : '') + '><span class="slider"></span></span>' + (label ? ' ' + label : '') + '</label>'; }
  function field(label, id, val, type, extra) {
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><input class="input" id="' + id + '" type="' + (type || 'text') + '" ' + (type === 'number' ? 'step="0.01"' : '') + ' value="' + esc(val == null ? '' : val) + '" ' + (extra || '') + '></div>';
  }
  function area(label, id, val, rows) { return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><textarea class="textarea" id="' + id + '" rows="' + (rows || 3) + '">' + esc(val || '') + '</textarea></div>'; }
  function stat(n, l, accent) { return '<div class="stat ' + (accent ? 'stat--accent' : '') + '"><div class="n">' + n + '</div><div class="l">' + esc(l) + '</div></div>'; }
  function findProduct(id) { for (var i = 0; i < catalog.products.length; i++) if (catalog.products[i].id === id) return catalog.products[i]; return null; }
  function findCat(id) { for (var i = 0; i < catalog.categories.length; i++) if (catalog.categories[i].id === id) return catalog.categories[i]; return null; }
  function findGroup(id) { for (var i = 0; i < catalog.optionGroups.length; i++) if (catalog.optionGroups[i].id === id) return catalog.optionGroups[i]; return null; }
  function catName(id) { var c = findCat(id); return c ? c.name : '—'; }
  function slug(s) { return norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'x'; }

  function mediaHTML(item) {
    var src = item && item.image;
    if (src) {
      if (String(src).indexOf('media:') === 0) {
        var id = String(src).slice(6), local = M.getMedia(id);
        if (local) return '<img src="' + local + '" alt="">';
        return '<span data-media="' + esc(id) + '" style="display:block;width:100%;height:100%">' + ART.tile(item.visual || item) + '</span>';
      }
      return '<img src="' + esc(src) + '" alt="">';
    }
    return ART.tile(item.visual || item);
  }
  function hydrateMedia(root) {
    $$('[data-media]', root).forEach(function (node) {
      M.loadMedia(node.getAttribute('data-media'), function (data) { if (data && node.parentNode) node.outerHTML = '<img src="' + data + '" alt="">'; });
    });
  }
  function resizeImage(file, maxSize, cb) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } } else if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; }
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        try { cb(c.toDataURL('image/jpeg', 0.8)); } catch (err) { cb(null); }
      };
      img.onerror = function () { cb(null); };
      img.src = e.target.result;
    };
    reader.onerror = function () { cb(null); };
    reader.readAsDataURL(file);
  }

  /* ---------- modale ---------- */
  function openModal(html, wide) {
    var m = el('admModal');
    m.className = 'modal' + (wide ? ' modal--wide' : '');
    m.innerHTML = html;
    el('admModalWrap').classList.add('show');
    $$('[data-close]', m).forEach(function (b) { b.addEventListener('click', closeModal); });
    hydrateMedia(m);
  }
  function closeModal() { el('admModalWrap').classList.remove('show'); }
  function modalOpen() { return el('admModalWrap').classList.contains('show'); }

  /* ---------- périodes ---------- */
  function sod(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function eod(d) { var x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
  function todayRange() { var n = new Date(); return { from: sod(n).getTime(), to: eod(n).getTime() }; }
  function makeRange(state) {
    var n = new Date(), from, to, label;
    switch (state.mode) {
      case 'today': from = sod(n); to = eod(n); label = 'Aujourd\'hui'; break;
      case 'yesterday': from = sod(new Date(n.getTime() - 86400000)); to = eod(from); label = 'Hier'; break;
      case 'week': { var w = sod(n); w.setDate(w.getDate() - ((w.getDay() + 6) % 7)); from = w; to = eod(new Date(w.getTime() + 6 * 86400000)); label = 'Cette semaine'; break; }
      case '7d': from = sod(new Date(n.getTime() - 6 * 86400000)); to = eod(n); label = '7 derniers jours'; break;
      case '30d': from = sod(new Date(n.getTime() - 29 * 86400000)); to = eod(n); label = '30 derniers jours'; break;
      case 'year': from = new Date(n.getFullYear(), 0, 1); to = eod(new Date(n.getFullYear(), 11, 31)); label = 'Année ' + n.getFullYear(); break;
      case 'pickMonth': from = new Date(state.year, state.month, 1); to = eod(new Date(state.year, state.month + 1, 0)); label = MONTHS[state.month] + ' ' + state.year; break;
      case 'custom':
        if (state.from && state.to) { from = sod(new Date(state.from + 'T00:00:00')); to = eod(new Date(state.to + 'T00:00:00')); label = 'du ' + from.toLocaleDateString('fr-FR') + ' au ' + to.toLocaleDateString('fr-FR'); break; }
        /* falls through */
      default: from = new Date(n.getFullYear(), n.getMonth(), 1); to = eod(new Date(n.getFullYear(), n.getMonth() + 1, 0)); label = 'Ce mois';
    }
    return { from: from.getTime(), to: to.getTime(), label: label };
  }
  function rangeHTML(state, presets) {
    var cy = new Date().getFullYear(), yrs = '';
    for (var y = cy; y >= cy - 3; y--) yrs += '<option value="' + y + '" ' + (state.year === y ? 'selected' : '') + '>' + y + '</option>';
    var mos = MONTHS.map(function (m, i) { return '<option value="' + i + '" ' + (state.month === i ? 'selected' : '') + '>' + m + '</option>'; }).join('');
    var labels = { today: 'Aujourd\'hui', yesterday: 'Hier', week: 'Cette semaine', '7d': '7 jours', '30d': '30 jours', month: 'Ce mois', year: 'Cette année' };
    return '<div class="adm-card"><div class="chip-set" style="margin-bottom:10px">' +
      presets.map(function (p) { return '<button type="button" class="opt-chip ' + (state.mode === p ? 'selected' : '') + '" data-range="' + p + '">' + labels[p] + '</button>'; }).join('') + '</div>' +
      '<div class="adm-row" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));align-items:end">' +
        '<div class="field" style="margin:0"><label>Mois précis</label><div style="display:flex;gap:6px"><select class="mini-input" id="rgMonth">' + mos + '</select><select class="mini-input" id="rgYear" style="max-width:92px">' + yrs + '</select></div></div>' +
        '<div class="field" style="margin:0"><label for="rgFrom">Période — du</label><input class="mini-input" type="date" id="rgFrom" value="' + esc(state.from) + '"></div>' +
        '<div class="field" style="margin:0"><label for="rgTo">au</label><input class="mini-input" type="date" id="rgTo" value="' + esc(state.to) + '"></div>' +
      '</div></div>';
  }
  function bindRange(state, rerender) {
    $$('[data-range]').forEach(function (b) { b.addEventListener('click', function () { state.mode = b.getAttribute('data-range'); rerender(); }); });
    var m = el('rgMonth'), y = el('rgYear'), f = el('rgFrom'), t = el('rgTo');
    function pick() { state.mode = 'pickMonth'; state.month = parseInt(m.value, 10); state.year = parseInt(y.value, 10); rerender(); }
    m.addEventListener('change', pick); y.addEventListener('change', pick);
    function cust() { state.from = f.value; state.to = t.value; if (f.value && t.value) { state.mode = 'custom'; rerender(); } }
    f.addEventListener('change', cust); t.addEventListener('change', cust);
  }
  // Charge les commandes d'une période (Firebase si connecté, sinon cache local).
  // extraDays : élargit la fenêtre pour capter encaissements/remboursements tardifs.
  function loadRange(range, extraDays, cb) {
    var fromIso = new Date(range.from - (extraDays || 0) * 86400000).toISOString(), toIso = new Date(range.to).toISOString();
    M.fetchOrdersRange(fromIso, toIso, function (list) {
      var map = {};
      M.getOrders().forEach(function (o) { var c = String(o.createdAt || ''); if (c >= fromIso && c <= toIso) map[o.id] = o; });
      (list || []).forEach(function (o) { if (o && o.id) map[o.id] = o; });
      cb(Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }));
    });
  }

  /* =========================================================================
     ALERTE SONORE + NOTIFICATION (comme MYKONOS, son « clochette de café »)
     ========================================================================= */
  var SOUND_KEY = 'mozaik_admin_sound', BASE_TITLE = 'MOZAÏK — Espace gérant';
  var audioCtx = null, titleTimer = null, seenIds = null;
  function soundOn() { try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch (e) { return true; } }
  function setSound(v) { try { localStorage.setItem(SOUND_KEY, v ? '1' : '0'); } catch (e) {} }
  function getAudio() {
    try { if (!audioCtx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); } if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {}
    return audioCtx;
  }
  function playBell() {
    var ctx = getAudio(); if (!ctx) return;
    try {
      var now = ctx.currentTime;
      [[0, 1318.5], [0.18, 1760], [0.55, 1318.5], [0.73, 1760]].forEach(function (n) {
        var o = ctx.createOscillator(), g = ctx.createGain(), s = now + n[0];
        o.type = 'sine'; o.frequency.setValueAtTime(n[1], s);
        g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.35, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.5);
        o.connect(g); g.connect(ctx.destination); o.start(s); o.stop(s + 0.52);
      });
    } catch (e) {}
  }
  function notifyDesktop(o) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      new Notification('☕ Nouvelle commande Mozaïk', { body: '#' + o.number + (o.table ? ' · ' + o.table.label : ' · ' + o.fulfillment) + ' · ' + M.money(o.total), tag: 'mozaik-order' });
    } catch (e) {}
  }
  function flashTitle(n) {
    clearInterval(titleTimer); var on = true, c = 0;
    titleTimer = setInterval(function () { document.title = on ? '🔔 ' + n + ' nouvelle(s) commande(s) !' : BASE_TITLE; on = !on; if (++c > 14) { clearInterval(titleTimer); document.title = BASE_TITLE; } }, 650);
  }
  function baseline() { seenIds = {}; M.getOrders().forEach(function (o) { seenIds[o.id] = 1; }); }
  function checkNewOrders() {
    var orders = M.getOrders();
    if (!seenIds) { baseline(); return; }
    var fresh = orders.filter(function (o) { return !seenIds[o.id] && o.status === 'Nouvelle'; });
    orders.forEach(function (o) { seenIds[o.id] = 1; });
    if (!fresh.length || !isAuthed()) return;
    if (soundOn()) playBell();
    toast('🔔 ' + fresh.length + ' nouvelle(s) commande(s) !', 'info');
    notifyDesktop(fresh[0]);
    flashTitle(fresh.length);
  }
  function updateNavBadge() {
    var n = M.getOrders().filter(function (o) { return o.status === 'Nouvelle'; }).length, b = el('navNewBadge');
    b.textContent = n; b.classList.toggle('hidden', !n);
  }
  function updateSoundBtn() {
    var b = el('admSoundToggle'), on = soundOn();
    b.textContent = on ? '🔔 Son activé' : '🔕 Son coupé';
    b.className = 'btn btn--sm ' + (on ? '' : 'btn--ghost');
  }

  /* =========================================================================
     CONNEXION (code haché, verrouillage après 5 essais)
     ========================================================================= */
  var AUTH_KEY = 'mozaik_admin_auth', LOCK_KEY = 'mozaik_admin_lock';
  function isAuthed() { try { return sessionStorage.getItem(AUTH_KEY) === S().adminCodeHash; } catch (e) { return false; } }
  function tryLogin(e) {
    if (e) e.preventDefault();
    var lock = {}; try { lock = JSON.parse(sessionStorage.getItem(LOCK_KEY) || '{}'); } catch (x) {}
    if (lock.until && Date.now() < lock.until) { el('admLoginErr').textContent = 'Trop d\'essais. Réessayez dans ' + Math.ceil((lock.until - Date.now()) / 1000) + ' s.'; return; }
    catalog = M.getCatalog();
    var code = el('admCode').value.trim();
    if (code && M.hashAdminCode(code) === S().adminCodeHash) {
      try { sessionStorage.setItem(AUTH_KEY, S().adminCodeHash); sessionStorage.removeItem(LOCK_KEY); } catch (x) {}
      showApp();
    } else {
      lock.fails = (lock.fails || 0) + 1;
      if (lock.fails >= 5) { lock.until = Date.now() + 30000; lock.fails = 0; }
      try { sessionStorage.setItem(LOCK_KEY, JSON.stringify(lock)); } catch (x) {}
      el('admLoginErr').textContent = 'Code incorrect.';
      el('admCode').value = ''; el('admCode').focus();
    }
  }
  function showApp() {
    el('admLogin').classList.add('hidden');
    el('admApp').classList.remove('hidden');
    updateSoundBtn(); baseline(); updateNavBadge();
    if (soundOn() && 'Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
    render(current);
  }
  function logout() { try { sessionStorage.removeItem(AUTH_KEY); } catch (e) {} location.reload(); }

  /* =========================================================================
     NAVIGATION
     ========================================================================= */
  var TITLES = {
    dashboard: 'Tableau de bord', orders: 'Commandes en cours', history: 'Historique des commandes',
    products: 'Produits', categories: 'Catégories', options: 'Options & suppléments', suggestions: 'Suggestions du panier',
    tables: 'Tables & QR codes', promos: 'Offres & codes promo', customers: 'Clients', newsletter: 'Newsletter',
    compta: 'Comptabilité', tickets: 'Tickets de caisse', content: 'Contenus du site', settings: 'Réglages'
  };
  var VIEWS = {};
  function render(section) {
    current = section || current;
    catalog = M.getCatalog();
    el('admTitle').textContent = TITLES[current] || '';
    $$('#admNav button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-sec') === current); });
    var v = VIEWS[current];
    el('admContent').innerHTML = v.view();
    if (v.bind) v.bind();
    hydrateMedia(el('admContent'));
    el('admSide').classList.remove('show'); el('admOverlay').classList.remove('show');
    updateNavBadge();
  }

  /* =========================================================================
     COMMANDES : affichage & actions (partagés)
     ========================================================================= */
  function statusPill(s) {
    var map = { 'Nouvelle': 'pill--copper', 'En préparation': 'pill--warn', 'Prête': 'pill--blue', 'Terminée': 'pill--ok', 'Annulée': 'pill--muted' };
    return '<span class="pill ' + (map[s] || 'pill--muted') + '">' + esc(s === 'Terminée' ? 'Servie' : s) + '</span>';
  }
  function payPill(o) {
    var refunded = M.orderRefunded(o);
    if (refunded > 0) return '<span class="pill pill--red">↩︎ ' + (refunded >= o.total ? 'Remboursée' : 'Remb. ' + money(refunded)) + '</span>';
    if (o.paidAt) return '<span class="pill pill--ok">✓ Payée · ' + esc(M.paymentLabel(o)) + '</span>';
    if (o.status === 'Annulée') return '<span class="pill pill--muted">Non payée</span>';
    return '<span class="pill pill--copper">💶 À encaisser</span>';
  }
  function whereHTML(o) {
    if (o.table) return '<span class="oc-table">📍 ' + esc(o.table.label) + '</span>';
    return '<span class="pill pill--sage">' + esc(o.fulfillment || '—') + '</span>';
  }
  function itemsHTML(o) {
    return (o.items || []).map(function (l) {
      var opts = M.lineOptionsText(l);
      return '<div class="order-line"><span><b>' + l.qty + '×</b> ' + esc(l.name) + (opts ? '<br><span class="sub">' + esc(opts) + '</span>' : '') + '</span><span>' + money(M.lineTotal(l)) + '</span></div>';
    }).join('');
  }
  function orderCardHTML(o) {
    var nx = NEXT[o.status];
    var refundable = o.paidAt && M.orderRefunded(o) < o.total;
    return '' +
      '<div class="order-card st-' + esc(String(o.status).replace(/\s+/g, '-')) + '">' +
        '<div class="oc-head"><div><span class="oc-num">#' + esc(o.number) + '</span> ' + whereHTML(o) +
          '<div class="oc-meta">' + fmtT(o.createdAt) + ' · ' + ago(o.createdAt) + ' · <b>' + esc(o.customer.firstName) + ' ' + esc(o.customer.lastName || '') + '</b></div></div>' +
          '<div style="text-align:right"><div class="price">' + money(o.total) + '</div>' + statusPill(o.status) + '</div></div>' +
        '<div class="oc-items">' + itemsHTML(o) + '</div>' +
        (o.note ? '<div class="note-box" style="margin:6px 0">📝 ' + esc(o.note) + '</div>' : '') +
        (o.discount > 0 ? '<div class="oc-meta" style="color:var(--ok);font-weight:700">' + esc(o.discountLabel) + ' : −' + money(o.discount) + (o.studentApplied ? ' · 🎓 vérifier la carte étudiante' : '') + '</div>' : '') +
        (o.address ? '<div class="oc-meta">🛵 ' + esc(o.address) + '</div>' : '') +
        '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">' + payPill(o) +
          (o.customer.phone ? '<span class="oc-meta">📞 ' + esc(o.customer.phone) + '</span>' : '') + '</div>' +
        '<div class="oc-actions no-print">' +
          (nx ? '<button class="btn btn--sm" type="button" data-oact="status" data-id="' + o.id + '" data-to="' + nx[0] + '">' + esc(nx[1]) + ' →</button>' : '') +
          (!o.paidAt && o.status !== 'Annulée' ? '<button class="btn btn--copper btn--sm" type="button" data-oact="pay" data-id="' + o.id + '">Encaisser</button>' : '') +
          (refundable ? '<button class="btn btn--ghost btn--sm" type="button" data-oact="refund" data-id="' + o.id + '">Rembourser</button>' : '') +
          '<button class="btn btn--ghost btn--sm" type="button" data-oact="print" data-id="' + o.id + '">🖨️ Bon</button>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-oact="view" data-id="' + o.id + '">Détails</button>' +
        '</div>' +
      '</div>';
  }
  function getOrder(id) { return M.findOrder(id) || (lastLoaded[id] || null); }
  var lastLoaded = {}; // commandes chargées depuis l'historique (hors cache)
  function patchOrder(o, patch) {
    M.updateOrder(o.id, patch);
    for (var k in patch) o[k] = patch[k];
    lastLoaded[o.id] = o;
  }
  function setStatus(o, status, extra) {
    var hist = (o.statusHistory || []).concat([{ status: status, at: new Date().toISOString() }]);
    var patch = { status: status, statusHistory: hist };
    if (status === 'Annulée') patch.cancelledAt = new Date().toISOString();
    for (var k in (extra || {})) patch[k] = extra[k];
    patchOrder(o, patch);
  }
  function addRefund(o, amt, method, reason) {
    var refunds = (o.refunds || []).concat([{ id: M.uid('rf'), amount: M.round2(amt), at: new Date().toISOString(), method: method || o.paidWith || 'other', reason: reason || '' }]);
    var total = refunds.reduce(function (s, r) { return s + Number(r.amount || 0); }, 0);
    patchOrder(o, { refunds: refunds, paymentStatus: total >= o.total - 0.001 ? 'Remboursée' : 'Partiellement remboursée' });
  }
  function rerenderOrders() {
    if (current === 'history') { refreshHistFromCache(); renderHistList(); return; }
    if (modalOpen()) return;
    if (current === 'orders') renderOrdersList();
    else if (current === 'dashboard' || current === 'compta' || current === 'tickets') render(current);
  }
  // Historique : applique les dernières modifications (statut, paiement…) sans tout recharger
  function refreshHistFromCache() {
    if (!histData) return;
    var r = makeRange(hist), ids = {};
    histData = histData.map(function (o) { ids[o.id] = 1; return M.findOrder(o.id) || lastLoaded[o.id] || o; });
    M.getOrders().forEach(function (o) { var t = new Date(o.createdAt).getTime(); if (!ids[o.id] && t >= r.from && t <= r.to) histData.unshift(o); });
  }

  function openPayModal(o) {
    openModal('<div class="modal-title-bar"><h3>Encaisser #' + esc(o.number) + '</h3></div><button class="modal-close" data-close>✕</button>' +
      '<div class="modal-body"><p class="m-desc">Montant : <b style="font-size:20px;color:var(--green)">' + money(o.total) + '</b>' + (o.studentApplied ? '<br>🎓 Réduction étudiante appliquée : vérifiez la carte.' : '') + '</p>' +
      PAID_WITH.map(function (p) { return '<button type="button" class="choice-card" data-pw="' + p[0] + '"><span class="cc-main"><b>' + esc(p[1]) + '</b></span><span>›</span></button>'; }).join('') +
      '</div><div class="modal-foot"><button class="btn btn--ghost btn--block" data-close type="button">Annuler</button></div>');
    $$('[data-pw]', el('admModal')).forEach(function (b) {
      b.addEventListener('click', function () {
        patchOrder(o, { paymentStatus: 'Payée', paidAt: new Date().toISOString(), paidWith: b.getAttribute('data-pw') });
        closeModal(); toast('#' + o.number + ' encaissée ✓'); rerenderOrders();
      });
    });
  }
  function openRefundModal(o, then) {
    var remaining = M.round2(o.total - M.orderRefunded(o));
    openModal('<div class="modal-title-bar"><h3>Rembourser #' + esc(o.number) + '</h3></div><button class="modal-close" data-close>✕</button>' +
      '<div class="modal-body"><p class="m-desc">Payée ' + money(o.total) + ' (' + esc(M.paymentLabel(o)) + ') · déjà remboursé ' + money(M.orderRefunded(o)) + '</p>' +
      field('Montant à rembourser (€)', 'rfAmount', amount(remaining).replace(',', '.'), 'number', 'min="0.01" max="' + remaining + '"') +
      '<div class="field"><label for="rfMethod">Remboursé par</label><select class="select" id="rfMethod">' + PAID_WITH.map(function (p) { return '<option value="' + p[0] + '" ' + ((o.paidWith || 'card_tpe') === p[0] ? 'selected' : '') + '>' + esc(p[1]) + '</option>'; }).join('') + '</select></div>' +
      field('Motif', 'rfReason', '', 'text', 'placeholder="Erreur de commande, geste commercial…"') +
      '</div><div class="modal-foot"><button class="btn btn--ghost" data-close type="button">Annuler</button><button class="btn btn--copper btn--block" id="rfOk" type="button">Enregistrer le remboursement</button></div>');
    el('rfOk').addEventListener('click', function () {
      var a = M.round2(num(el('rfAmount').value, 0));
      if (a <= 0 || a > remaining + 0.001) { toast('Montant invalide (max ' + money(remaining) + ')', 'err'); return; }
      addRefund(o, a, el('rfMethod').value, el('rfReason').value.trim());
      closeModal(); toast('Remboursement de ' + money(a) + ' enregistré'); if (then) then(); else rerenderOrders();
    });
  }
  function openCancelModal(o) {
    var paidLeft = o.paidAt ? M.round2(o.total - M.orderRefunded(o)) : 0;
    openModal('<div class="modal-title-bar"><h3>Annuler #' + esc(o.number) + ' ?</h3></div><button class="modal-close" data-close>✕</button>' +
      '<div class="modal-body"><p class="m-desc">La commande sera exclue du chiffre d\'affaires. Le client voit l\'annulation dans son suivi.</p>' +
      field('Motif (facultatif)', 'cxReason', '', 'text', 'placeholder="Rupture, client parti…"') +
      (paidLeft > 0 ? '<label class="check ok-box"><input type="checkbox" id="cxRefund" checked> Rembourser ' + money(paidLeft) + ' (' + esc(M.paymentLabel(o)) + ')</label>' : '') +
      '</div><div class="modal-foot"><button class="btn btn--ghost" data-close type="button">Retour</button><button class="btn btn--block" id="cxOk" type="button" style="background:var(--danger)">Annuler la commande</button></div>');
    el('cxOk').addEventListener('click', function () {
      var reason = el('cxReason').value.trim();
      if (paidLeft > 0 && el('cxRefund') && el('cxRefund').checked) addRefund(o, paidLeft, o.paidWith, 'Annulation' + (reason ? ' : ' + reason : ''));
      setStatus(o, 'Annulée', { cancelReason: reason });
      closeModal(); toast('#' + o.number + ' annulée'); rerenderOrders();
    });
  }
  function openOrderDetails(o) {
    var hist = (o.statusHistory || []).map(function (h) { return '<div class="order-line"><span>' + statusPill(h.status) + '</span><span>' + fmtDT(h.at) + '</span></div>'; }).join('');
    var refunds = (o.refunds || []).map(function (r) { return '<div class="order-line"><span>↩︎ ' + money(r.amount) + ' · ' + esc(M.PAY_METHODS[r.method] || r.method) + (r.reason ? ' · ' + esc(r.reason) : '') + '</span><span>' + fmtDT(r.at) + '</span></div>'; }).join('');
    var opts = STATUSES.map(function (s) { return '<option value="' + s + '" ' + (o.status === s ? 'selected' : '') + '>' + (s === 'Terminée' ? 'Servie / remise (Terminée)' : s) + '</option>'; }).join('');
    openModal('<div class="modal-title-bar"><h3>Commande #' + esc(o.number) + '</h3><p class="m-desc">' + fmtDT(o.createdAt) + ' · ' + esc(o.source === 'qr-table' ? 'QR code de table' : 'Site') + '</p></div><button class="modal-close" data-close>✕</button>' +
      '<div class="modal-body">' + orderCardHTML(o) +
        '<div class="opt-group"><h5>Client</h5><p style="margin:4px 0 0;font-size:14px">' + esc(o.customer.firstName) + ' ' + esc(o.customer.lastName || '') + '<br>📞 ' + esc(o.customer.phone || '—') + ' · ✉️ ' + esc(o.customer.email || '—') + '</p></div>' +
        '<div class="opt-group"><h5>Montants</h5>' +
          '<div class="summary-row"><span>Sous-total</span><span>' + money(o.subtotal) + '</span></div>' +
          (o.discount > 0 ? '<div class="summary-row discount"><span>' + esc(o.discountLabel) + '</span><span>−' + money(o.discount) + '</span></div>' : '') +
          (o.delivery > 0 ? '<div class="summary-row"><span>Livraison</span><span>' + money(o.delivery) + '</span></div>' : '') +
          '<div class="summary-row total"><span>Total</span><span>' + money(o.total) + '</span></div>' +
          (M.orderRefunded(o) ? '<div class="summary-row"><span>Remboursé</span><span>−' + money(M.orderRefunded(o)) + '</span></div><div class="summary-row" style="font-weight:800"><span>Net</span><span>' + money(M.orderNet(o)) + '</span></div>' : '') +
        '</div>' +
        '<div class="opt-group"><h5>Statut</h5><select class="select" id="odStatus">' + opts + '</select><div style="margin-top:8px">' + hist + '</div></div>' +
        (refunds ? '<div class="opt-group"><h5>Remboursements</h5>' + refunds + '</div>' : '') +
        (o.cancelReason ? '<div class="note-box">Motif d\'annulation : ' + esc(o.cancelReason) + '</div>' : '') +
        '<div class="oc-actions" style="margin-top:12px">' +
          '<button class="btn btn--ghost btn--sm" type="button" id="odPdf">🧾 Ticket PDF</button>' +
          (o.paidAt && !M.orderRefunded(o) ? '<button class="btn btn--ghost btn--sm" type="button" id="odUnpay">Annuler l\'encaissement</button>' : '') +
          (o.status !== 'Annulée' ? '<button class="btn btn--ghost btn--sm" type="button" id="odCancel" style="color:var(--danger)">Annuler la commande</button>' : '') +
          '<button class="link-danger" type="button" id="odDelete">Supprimer définitivement</button>' +
        '</div>' +
      '</div><div class="modal-foot"><button class="btn btn--block" data-close type="button">Fermer</button></div>', true);
    el('odStatus').addEventListener('change', function () {
      if (this.value === 'Annulée') { openCancelModal(o); return; }
      setStatus(o, this.value); toast('Statut : ' + this.value); openOrderDetails(o); refreshBehind();
    });
    el('odPdf').addEventListener('click', function () { ticketPDF(o); });
    var up = el('odUnpay'); if (up) up.addEventListener('click', function () { patchOrder(o, { paidAt: null, paidWith: null, paymentStatus: 'À payer' }); toast('Encaissement annulé'); openOrderDetails(o); refreshBehind(); });
    var cx = el('odCancel'); if (cx) cx.addEventListener('click', function () { openCancelModal(o); });
    el('odDelete').addEventListener('click', function () {
      if (!confirm('Supprimer définitivement la commande #' + o.number + ' ?\nPréférez « Annuler » pour garder une trace comptable.')) return;
      M.deleteOrder(o.id); delete lastLoaded[o.id]; closeModal(); toast('Commande supprimée'); render(current);
    });
    // actions de la carte dans la modale
    $$('[data-oact]', el('admModal')).forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); orderAction(b); }); });
  }
  function refreshBehind() { var wasOpen = modalOpen(); if (!wasOpen) rerenderOrders(); else if (current === 'orders') renderOrdersList(); }
  function orderAction(b) {
    var o = getOrder(b.getAttribute('data-id')); if (!o) return;
    var act = b.getAttribute('data-oact');
    if (act === 'status') { setStatus(o, b.getAttribute('data-to')); toast('#' + o.number + ' → ' + (b.getAttribute('data-to') === 'Terminée' ? 'Servie' : b.getAttribute('data-to'))); if (modalOpen()) openOrderDetails(o); refreshBehind(); }
    else if (act === 'pay') openPayModal(o);
    else if (act === 'refund') openRefundModal(o);
    else if (act === 'print') printOrder(o);
    else if (act === 'view') openOrderDetails(o);
  }
  function printOrder(o) {
    var s = S(), w = window.open('', '_blank', 'width=380,height=640');
    if (!w) { toast('Autorisez les fenêtres pop-up pour imprimer', 'err'); return; }
    var items = (o.items || []).map(function (l) {
      var opts = M.lineOptionsText(l);
      return '<tr><td><b>' + l.qty + '×</b> ' + esc(l.name) + (opts ? '<br><small>' + esc(opts) + '</small>' : '') + '</td><td style="text-align:right">' + money(M.lineTotal(l)) + '</td></tr>';
    }).join('');
    w.document.write('<html><head><title>Bon #' + esc(o.number) + '</title><style>body{font-family:monospace;padding:10px;font-size:13px}h2{text-align:center;margin:4px}table{width:100%;border-collapse:collapse}td{padding:4px 0;border-bottom:1px dashed #bbb;vertical-align:top}small{color:#444}.big{font-size:22px;font-weight:bold;text-align:center;margin:6px 0}</style></head><body>' +
      '<h2>' + esc(s.restaurantName) + '</h2><div style="text-align:center">' + esc(s.address) + '</div><hr>' +
      '<div class="big">#' + esc(o.number) + (o.table ? ' · ' + esc(o.table.label) : ' · ' + esc(o.fulfillment)) + '</div>' +
      '<div>' + fmtDT(o.createdAt) + '<br>Client : ' + esc(o.customer.firstName) + ' ' + esc(o.customer.lastName || '') + (o.customer.phone ? ' · ' + esc(o.customer.phone) : '') + '</div><hr>' +
      '<table>' + items + '</table>' + (o.note ? '<p><b>Note :</b> ' + esc(o.note) + '</p>' : '') +
      (o.discount > 0 ? '<div>' + esc(o.discountLabel) + ' : −' + money(o.discount) + '</div>' : '') +
      '<div style="font-size:16px;font-weight:bold;text-align:right">TOTAL : ' + money(o.total) + '</div>' +
      '<div style="text-align:right">' + (o.paidAt ? 'Payée (' + esc(M.paymentLabel(o)) + ')' : 'À ENCAISSER') + '</div>' +
      '<hr><div style="text-align:center">Teşekkürler ! ♡</div><script>window.onload=function(){window.print();}<\/script></body></html>');
    w.document.close();
  }

  /* =========================================================================
     TABLEAU DE BORD
     ========================================================================= */
  function todoItems() {
    var s = S(), out = [];
    var noPrice = catalog.products.filter(function (p) { return p.active !== false && !M.hasPrice(p); });
    if (noPrice.length) out.push('<b>' + noPrice.length + ' produit(s) sans prix</b> — visibles mais non commandables : ' + noPrice.map(function (p) { return esc(p.name); }).join(', ') + '. <button class="link-btn" type="button" data-go="products">Saisir les prix</button>');
    var brunch = findCat('brunch');
    if (brunch && brunch.active === false && !catalog.products.some(function (p) { return p.categoryId === 'brunch'; })) out.push('Catégorie « Brunch & salé » (annoncée sur Instagram) à compléter : aucun produit ni prix publié. <button class="link-btn" type="button" data-go="products">Ajouter</button>');
    var noPhoto = catalog.products.filter(function (p) { return p.active !== false && !p.image; }).length;
    if (noPhoto) out.push(noPhoto + ' produit(s) affichés avec une illustration : ajoutez vos vraies photos (Produits → Modifier → Photo).');
    if (s.adminCodeHash === M.DEFAULT_CATALOG.settings.adminCodeHash) out.push('<b>Code d\'accès par défaut</b> : changez-le. <button class="link-btn" type="button" data-go="settings">Réglages</button>');
    if (!s.email) out.push('E-mail de contact non renseigné. <button class="link-btn" type="button" data-go="settings">Réglages</button>');
    if (!s.infoChecked) out.push('Téléphone et horaires repris des fiches publiques (Google, Instagram) : à vérifier. <button class="link-btn" type="button" id="infoChecked">C\'est vérifié ✓</button>');
    if (!window.MOZAIK_FB) out.push('<b>Synchronisation temps réel inactive</b> : les commandes passées sur les téléphones ne remontent pas ici (vérifiez la connexion / la configuration Firebase).');
    return out;
  }
  VIEWS.dashboard = {
    view: function () {
      var orders = M.getOrders(), r = todayRange(), sm = M.summarize(orders, r.from, r.to, vat());
      var active = orders.filter(function (o) { return !FINAL[o.status]; });
      var nNew = active.filter(function (o) { return o.status === 'Nouvelle'; }).length;
      var top = Object.keys(sm.products).map(function (k) { return sm.products[k]; }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 6);
      var todo = todoItems();
      var rows = active.slice().sort(function (a, b) { return String(a.createdAt).localeCompare(String(b.createdAt)); }).map(function (o) {
        return '<tr><td><b>#' + esc(o.number) + '</b></td><td>' + (o.table ? esc(o.table.label) : esc(o.fulfillment)) + '</td><td>' + esc(o.customer.firstName) + '</td><td>' + ago(o.createdAt) + '</td><td class="num"><b>' + money(o.total) + '</b></td><td>' + statusPill(o.status) + '</td><td>' + payPill(o) + '</td><td><button class="btn btn--ghost btn--xs" type="button" data-oact="view" data-id="' + o.id + '">Voir</button></td></tr>';
      }).join('') || '<tr><td colspan="8" class="muted">Aucune commande en cours.</td></tr>';
      return '' +
        '<div class="stat-grid">' +
          stat(money(sm.net), 'CA du jour (TTC)', true) + stat(sm.count, 'Commandes du jour') + stat(money(sm.avg), 'Panier moyen') +
          stat(money(sm.collected), 'Encaissé aujourd\'hui') + stat(money(sm.toCollect), 'Reste à encaisser (' + sm.toCollectCount + ')') + stat(nNew, 'Nouvelles commandes') +
        '</div>' +
        (todo.length ? '<div class="adm-card" style="border-color:#e3cf9f;background:#fbf5e6"><h3>📋 À compléter</h3><ul class="todo-list">' + todo.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></div>' : '') +
        '<div class="adm-card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="margin:0">Commandes en cours (' + active.length + ')</h3><button class="btn btn--sm" type="button" data-go="orders">Ouvrir le tableau de service →</button></div>' +
          '<div class="table-wrap" style="margin-top:10px"><table class="table"><thead><tr><th>N°</th><th>Table / mode</th><th>Client</th><th>Reçue</th><th class="num">Total</th><th>Statut</th><th>Paiement</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
        '<div class="adm-row" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">' +
          '<div class="adm-card"><h3>☕ Ventes du jour par produit</h3>' + (top.length ? top.map(function (p) { return '<div class="order-line"><span>' + esc(p.name) + '</span><span><b>' + p.qty + '</b> · ' + money(p.amount) + '</span></div>'; }).join('') : '<p class="muted" style="margin:0">Pas encore de vente aujourd\'hui.</p>') + '</div>' +
          '<div class="adm-card"><h3>🔔 Alerte des commandes</h3><p class="muted" style="margin:0;font-size:14px">Gardez cette page ouverte au comptoir : une <b>clochette</b> retentit et une notification s\'affiche à chaque nouvelle commande (QR code de table ou site). Cliquez une fois sur la page pour autoriser le son. Les commandes annulées sont exclues du CA ; les remboursements sont déduits du CA et des encaissements.</p></div>' +
        '</div>';
    },
    bind: function () {
      var ic = el('infoChecked'); if (ic) ic.addEventListener('click', function () { S().infoChecked = true; persist(); render('dashboard'); });
    }
  };

  /* =========================================================================
     COMMANDES EN COURS (tableau de service)
     ========================================================================= */
  var ordFilter = 'active', ordSearch = '';
  function matchOrder(o, q) {
    if (!q) return true;
    var hay = norm([o.number, o.customer.firstName, o.customer.lastName, o.customer.phone, o.customer.email, o.table ? o.table.label : '', o.fulfillment, o.note,
      (o.items || []).map(function (l) { return l.name; }).join(' ')].join(' '));
    return hay.indexOf(norm(q)) >= 0;
  }
  function boardOrders() {
    var r = todayRange();
    var list = M.getOrders().filter(function (o) {
      var t = new Date(o.createdAt).getTime(), today = t >= r.from && t <= r.to;
      switch (ordFilter) {
        case 'active': return !FINAL[o.status];
        case 'today': return today;
        case 'Annulée': case 'Terminée': return today && o.status === ordFilter;
        case 'unpaid': return !o.paidAt && o.status !== 'Annulée' && (today || !FINAL[o.status]);
        default: return o.status === ordFilter;
      }
    }).filter(function (o) { return matchOrder(o, ordSearch); });
    list.sort(function (a, b) { return ordFilter === 'active' ? String(a.createdAt).localeCompare(String(b.createdAt)) : String(b.createdAt).localeCompare(String(a.createdAt)); });
    return list;
  }
  function renderOrdersList() {
    var box = el('ordersList'); if (!box) return;
    var list = boardOrders();
    box.innerHTML = list.map(orderCardHTML).join('') || '<div class="adm-card muted" style="text-align:center">Aucune commande ici pour le moment. Les nouvelles commandes apparaissent automatiquement.</div>';
    var counts = {}; M.getOrders().forEach(function (o) { if (!FINAL[o.status]) counts[o.status] = (counts[o.status] || 0) + 1; });
    $$('[data-of]').forEach(function (b) { var k = b.getAttribute('data-of'), c = b.querySelector('i'); if (c) c.textContent = counts[k] ? ' ' + counts[k] : ''; });
  }
  VIEWS.orders = {
    view: function () {
      var f = [['active', 'En cours'], ['Nouvelle', 'Nouvelles'], ['En préparation', 'En préparation'], ['Prête', 'Prêtes'], ['unpaid', 'À encaisser'], ['today', 'Toutes (aujourd\'hui)'], ['Terminée', 'Servies'], ['Annulée', 'Annulées']];
      return '<div class="toolbar"><div class="chip-set">' + f.map(function (x) { return '<button type="button" class="opt-chip ' + (ordFilter === x[0] ? 'selected' : '') + '" data-of="' + esc(x[0]) + '">' + esc(x[1]) + '<i style="font-style:normal;font-weight:800"></i></button>'; }).join('') + '</div>' +
        '<input class="mini-input grow" id="ordSearch" placeholder="Rechercher : n°, prénom, table, produit…" value="' + esc(ordSearch) + '"></div>' +
        '<div class="order-board" id="ordersList"></div>';
    },
    bind: function () {
      $$('[data-of]').forEach(function (b) { b.addEventListener('click', function () { ordFilter = b.getAttribute('data-of'); render('orders'); }); });
      el('ordSearch').addEventListener('input', function () { ordSearch = this.value; renderOrdersList(); });
      renderOrdersList();
    }
  };

  /* =========================================================================
     HISTORIQUE (recherche & filtres sur toute période)
     ========================================================================= */
  var hist = { mode: '7d', month: new Date().getMonth(), year: new Date().getFullYear(), from: '', to: '', q: '', status: 'all', pay: 'all', mode2: 'all', table: 'all' };
  var histData = null, histKey = '';
  function histFiltered() {
    return (histData || []).filter(function (o) {
      var r = makeRange(hist), t = new Date(o.createdAt).getTime();
      if (t < r.from || t > r.to) return false;
      if (hist.status !== 'all' && o.status !== hist.status) return false;
      if (hist.pay === 'unpaid' && (o.paidAt || o.status === 'Annulée')) return false;
      if (hist.pay === 'paid' && !o.paidAt) return false;
      if (hist.pay === 'refunded' && !M.orderRefunded(o)) return false;
      if (hist.mode2 !== 'all' && o.fulfillment !== hist.mode2) return false;
      if (hist.table !== 'all' && !(o.table && o.table.id === hist.table)) return false;
      return matchOrder(o, hist.q);
    });
  }
  function renderHistList() {
    var box = el('histList'); if (!box) return;
    if (!histData) { box.innerHTML = '<p class="muted">Chargement…</p>'; return; }
    var list = histFiltered(), valid = list.filter(function (o) { return o.status !== 'Annulée'; });
    var net = valid.reduce(function (s, o) { return s + M.orderNet(o); }, 0);
    box.innerHTML = '<p class="muted" style="margin:0 0 8px">' + list.length + ' commande(s) · ' + valid.length + ' valide(s) · <b style="color:var(--green)">' + money(net) + '</b> net · ' + (list.length - valid.length) + ' annulée(s)</p>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Table / mode</th><th>Articles</th><th class="num">Total</th><th>Paiement</th><th>Statut</th><th></th></tr></thead><tbody>' +
      (list.map(function (o) {
        var n = (o.items || []).reduce(function (s, l) { return s + l.qty; }, 0);
        return '<tr><td><b>#' + esc(o.number) + '</b></td><td>' + fmtDT(o.createdAt) + '</td><td>' + esc(o.customer.firstName) + ' ' + esc(o.customer.lastName || '') + '</td><td>' + (o.table ? esc(o.table.label) : esc(o.fulfillment)) + '</td>' +
          '<td title="' + esc((o.items || []).map(function (l) { return l.qty + '× ' + l.name; }).join(', ')) + '">' + n + ' art.</td><td class="num"><b>' + money(o.total) + '</b></td><td>' + payPill(o) + '</td><td>' + statusPill(o.status) + '</td>' +
          '<td><button class="btn btn--ghost btn--xs" type="button" data-oact="view" data-id="' + o.id + '">Voir</button></td></tr>';
      }).join('') || '<tr><td colspan="9" class="muted">Aucune commande ne correspond.</td></tr>') + '</tbody></table></div>';
  }
  VIEWS.history = {
    view: function () {
      var tables = catalog.tables.map(function (t) { return '<option value="' + esc(t.id) + '" ' + (hist.table === t.id ? 'selected' : '') + '>' + esc(t.label) + '</option>'; }).join('');
      var modes = (S().fulfillment || []).map(function (m) { return '<option ' + (hist.mode2 === m ? 'selected' : '') + '>' + esc(m) + '</option>'; }).join('');
      function opt(v, l, cur) { return '<option value="' + v + '" ' + (cur === v ? 'selected' : '') + '>' + l + '</option>'; }
      return rangeHTML(hist, ['today', 'yesterday', '7d', '30d', 'month', 'year']) +
        '<div class="adm-card"><div class="toolbar" style="margin:0">' +
          '<input class="mini-input grow" id="hQ" placeholder="Rechercher : n°, client, téléphone, e-mail, produit…" value="' + esc(hist.q) + '">' +
          '<select class="mini-input" style="width:auto" id="hStatus">' + opt('all', 'Tous statuts', hist.status) + STATUSES.map(function (s) { return opt(s, s === 'Terminée' ? 'Servie' : s, hist.status); }).join('') + '</select>' +
          '<select class="mini-input" style="width:auto" id="hPay">' + opt('all', 'Tous paiements', hist.pay) + opt('unpaid', 'À encaisser', hist.pay) + opt('paid', 'Payées', hist.pay) + opt('refunded', 'Remboursées', hist.pay) + '</select>' +
          '<select class="mini-input" style="width:auto" id="hMode"><option value="all">Tous modes</option>' + modes + '</select>' +
          '<select class="mini-input" style="width:auto" id="hTable"><option value="all">Toutes tables</option>' + tables + '</select>' +
          '<button class="btn btn--sm" type="button" id="hCsv">⬇️ CSV commandes</button><button class="btn btn--ghost btn--sm" type="button" id="hCsvItems">⬇️ CSV articles</button>' +
        '</div></div><div class="adm-card" id="histList"></div>';
    },
    bind: function () {
      bindRange(hist, function () { render('history'); });
      el('hQ').addEventListener('input', function () { hist.q = this.value; renderHistList(); });
      [['hStatus', 'status'], ['hPay', 'pay'], ['hMode', 'mode2'], ['hTable', 'table']].forEach(function (x) { el(x[0]).addEventListener('change', function () { hist[x[1]] = this.value; renderHistList(); }); });
      el('hCsv').addEventListener('click', function () {
        var rows = [['N°', 'Date', 'Heure', 'Client', 'Téléphone', 'E-mail', 'Mode', 'Table', 'Articles', 'Sous-total', 'Réduction', 'Libellé réduction', 'Total TTC', 'Remboursé', 'Net', 'Statut', 'Paiement', 'Encaissée le', 'Moyen']];
        histFiltered().forEach(function (o) {
          var d = new Date(o.createdAt);
          rows.push([o.number, d.toLocaleDateString('fr-FR'), d.toLocaleTimeString('fr-FR'), (o.customer.firstName + ' ' + (o.customer.lastName || '')).trim(), o.customer.phone, o.customer.email, o.fulfillment, o.table ? o.table.label : '',
            (o.items || []).map(function (l) { return l.qty + 'x ' + l.name + (l.options && l.options.length ? ' (' + M.lineOptionsText(l) + ')' : ''); }).join(' | '),
            amount(o.subtotal), amount(o.discount), o.discountLabel || '', amount(o.total), amount(M.orderRefunded(o)), amount(o.status === 'Annulée' ? 0 : M.orderNet(o)), o.status, o.paymentStatus, o.paidAt ? fmtDT(o.paidAt) : '', o.paidAt ? M.paymentLabel(o) : '']);
        });
        csvDownload('mozaik-commandes.csv', rows);
      });
      el('hCsvItems').addEventListener('click', function () {
        var rows = [['N°', 'Date', 'Statut', 'Produit', 'Options', 'Quantité', 'Prix unitaire', 'Total ligne']];
        histFiltered().forEach(function (o) { (o.items || []).forEach(function (l) { rows.push([o.number, fmtDT(o.createdAt), o.status, l.name, M.lineOptionsText(l), l.qty, amount(M.lineUnitPrice(l)), amount(M.lineTotal(l))]); }); });
        csvDownload('mozaik-articles.csv', rows);
      });
      var r = makeRange(hist), key = r.from + '-' + r.to;
      if (key !== histKey || !histData) {
        histData = null; histKey = key; renderHistList();
        loadRange(r, 0, function (list) { if (histKey !== key) return; histData = list; list.forEach(function (o) { lastLoaded[o.id] = o; }); renderHistList(); });
      } else renderHistList();
    }
  };

  /* =========================================================================
     PRODUITS
     ========================================================================= */
  var prodCat = 'all', prodQ = '';
  function productCardAdmin(p) {
    var groups = (p.optionGroupIds || []).map(findGroup).filter(Boolean);
    return '<div class="prod-admin-card ' + (p.active === false ? 'is-off' : '') + '">' +
      '<div class="media">' + mediaHTML(p) + (p.featured ? '<span class="qty-badge" style="background:var(--green)">★ Signature</span>' : '') + '</div>' +
      '<div class="pa-body"><b style="font-family:var(--font-title);color:var(--green)">' + esc(p.name) + '</b>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span class="pill pill--muted">' + esc(catName(p.categoryId)) + '</span>' +
          (M.hasPrice(p) ? '<b style="color:var(--green)">' + money(p.price) + '</b>' : '<span class="pill pill--warn">Prix à saisir</span>') + '</div>' +
        (groups.length ? '<div class="oc-meta">Options : ' + groups.map(function (g) { return esc(g.name); }).join(', ') + '</div>' : '') +
        '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:13px;margin-top:auto">' + sw('data-pact="active" data-id="' + p.id + '"', p.active !== false, 'Visible') + sw('data-pact="available" data-id="' + p.id + '"', p.available !== false, 'Disponible') + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn--sm" type="button" data-pedit="' + p.id + '">✏️ Modifier</button><button class="btn btn--ghost btn--sm" type="button" data-pdup="' + p.id + '">Dupliquer</button><button class="link-danger" type="button" data-pdel="' + p.id + '">Supprimer</button></div>' +
      '</div></div>';
  }
  VIEWS.products = {
    view: function () {
      var cats = '<option value="all">Toutes les catégories</option>' + catalog.categories.slice().sort(function (a, b) { return a.order - b.order; }).map(function (c) { return '<option value="' + esc(c.id) + '" ' + (prodCat === c.id ? 'selected' : '') + '>' + esc(c.name) + (c.active === false ? ' (masquée)' : '') + '</option>'; }).join('');
      var list = catalog.products.filter(function (p) { return (prodCat === 'all' || p.categoryId === prodCat) && (!prodQ || norm(p.name + ' ' + p.description).indexOf(norm(prodQ)) >= 0); })
        .sort(function (a, b) { var ca = findCat(a.categoryId), cb = findCat(b.categoryId); return ((ca ? ca.order : 99) - (cb ? cb.order : 99)) || ((a.order || 0) - (b.order || 0)); });
      return '<div class="adm-card"><div class="toolbar" style="margin:0"><select class="mini-input" style="width:auto" id="pCat">' + cats + '</select>' +
        '<input class="mini-input grow" id="pQ" placeholder="Rechercher un produit…" value="' + esc(prodQ) + '"><button class="btn btn--copper btn--sm" type="button" id="pAdd">+ Nouveau produit</button></div>' +
        '<p class="hint" style="margin:10px 0 0">« Visible » = affiché sur la carte · « Disponible » = commandable (sinon « Épuisé ») · sans prix = visible mais non commandable.</p></div>' +
        '<div class="adm-row" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">' + (list.map(productCardAdmin).join('') || '<p class="muted">Aucun produit.</p>') + '</div>';
    },
    bind: function () {
      el('pCat').addEventListener('change', function () { prodCat = this.value; render('products'); });
      var t; el('pQ').addEventListener('input', function () { var v = this.value; clearTimeout(t); t = setTimeout(function () { prodQ = v; render('products'); el('pQ').focus(); el('pQ').setSelectionRange(v.length, v.length); }, 250); });
      el('pAdd').addEventListener('click', function () { openProductEditor(null); });
      $$('[data-pact]').forEach(function (i) { i.addEventListener('change', function () { var p = findProduct(i.getAttribute('data-id')); if (!p) return; p[i.getAttribute('data-pact')] = i.checked; persist(); render('products'); toast('Mis à jour ✓'); }); });
      $$('[data-pedit]').forEach(function (b) { b.addEventListener('click', function () { openProductEditor(b.getAttribute('data-pedit')); }); });
      $$('[data-pdup]').forEach(function (b) { b.addEventListener('click', function () {
        var p = M.clone(findProduct(b.getAttribute('data-pdup'))); p.id = M.uid('p'); p.name += ' (copie)'; p.featured = false; p.order = (p.order || 0) + 0.5;
        catalog.products.push(p); persist(); render('products'); toast('Produit dupliqué');
      }); });
      $$('[data-pdel]').forEach(function (b) { b.addEventListener('click', function () {
        var p = findProduct(b.getAttribute('data-pdel')); if (!p || !confirm('Supprimer « ' + p.name + ' » ? (vous pouvez aussi le masquer)')) return;
        catalog.products = catalog.products.filter(function (x) { return x.id !== p.id; });
        catalog.suggestions.rules.forEach(function (r) { r.suggestProductIds = r.suggestProductIds.filter(function (id) { return id !== p.id; }); r.triggerProductIds = r.triggerProductIds.filter(function (id) { return id !== p.id; }); });
        catalog.suggestions.fallbackProductIds = catalog.suggestions.fallbackProductIds.filter(function (id) { return id !== p.id; });
        persist(); render('products'); toast('Produit supprimé');
      }); });
    }
  };
  function openProductEditor(id) {
    var src = id ? findProduct(id) : null;
    var p = src ? M.clone(src) : { id: M.uid('p'), categoryId: prodCat !== 'all' ? prodCat : (catalog.categories[0] || {}).id, name: '', price: null, description: '', image: '', tint: '#b07a4f', vessel: 'cup', temp: 'hot', layer: false, tags: [], optionGroupIds: [], available: true, active: true, featured: false, order: catalog.products.length + 1 };
    var work = { image: p.image || '', newData: null, groups: (p.optionGroupIds || []).slice() };
    var cats = catalog.categories.map(function (c) { return '<option value="' + esc(c.id) + '" ' + (p.categoryId === c.id ? 'selected' : '') + '>' + esc(c.name) + '</option>'; }).join('');
    var vessels = ART.VESSELS.map(function (v) { return '<option value="' + v.id + '" ' + (p.vessel === v.id ? 'selected' : '') + '>' + esc(v.label) + '</option>'; }).join('');
    function opt(v, l) { return '<option value="' + v + '" ' + (p.temp === v ? 'selected' : '') + '>' + l + '</option>'; }
    openModal('' +
      '<div class="modal-head"><div class="modal-hero" id="peHero"></div><button class="modal-close" data-close>✕</button></div>' +
      '<div class="modal-body"><h3>' + (src ? 'Modifier le produit' : 'Nouveau produit') + '</h3>' +
        field('Nom *', 'peName', p.name) +
        '<div class="grid-2"><div class="field"><label for="peCat">Catégorie</label><select class="select" id="peCat">' + cats + '</select></div>' +
        field('Prix (€) — vide = prix à venir', 'pePrice', M.hasPrice(p) ? p.price : '', 'number', 'min="0" placeholder="ex. 4.50"') + '</div>' +
        area('Description', 'peDesc', p.description, 3) +
        field('Étiquettes (séparées par des virgules)', 'peTags', (p.tags || []).join(', '), 'text', 'placeholder="BIO, Sans caféine, Fait maison…"') +
        '<div class="opt-group"><h5>Options & suppléments proposés</h5><p class="og-help">Cliquez pour activer/désactiver. Gérez les choix et prix dans « Options & suppléments ».</p><div class="chip-set" id="peGroups"></div></div>' +
        '<div class="opt-group"><h5>Photo</h5>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap"><label class="btn btn--ghost btn--sm">📷 ' + (p.image ? 'Remplacer la photo' : 'Ajouter une photo') + '<input type="file" id="peImg" accept="image/*" hidden></label>' +
          '<button class="btn btn--ghost btn--sm" type="button" id="peImgDel" ' + (p.image ? '' : 'style="display:none"') + '>Retirer la photo</button></div>' +
          '<p class="og-help" style="margin-top:6px">Redimensionnée automatiquement. Sans photo, l\'illustration ci-dessous est utilisée.</p></div>' +
        '<div class="opt-group"><h5>Illustration (sans photo)</h5><div class="grid-2">' +
          '<div class="field"><label for="peVessel">Contenant</label><select class="select" id="peVessel">' + vessels + '</select></div>' +
          '<div class="field"><label for="peTint">Couleur de la boisson</label><input class="input" type="color" id="peTint" value="' + esc(p.tint || '#b07a4f') + '" style="height:46px;padding:4px"></div>' +
          '<div class="field"><label for="peTemp">Service</label><select class="select" id="peTemp">' + opt('hot', 'Chaud') + opt('cold', 'Froid') + opt('both', 'Chaud ou froid') + '</select></div>' +
          '<div class="field" style="align-self:end">' + sw('id="peLayer"', p.layer, 'Effet latte étagé') + '</div>' +
        '</div></div>' +
        '<div class="adm-row" style="grid-template-columns:1fr 1fr">' + sw('id="peActive"', p.active !== false, 'Visible sur la carte') + sw('id="peAvail"', p.available !== false, 'Disponible') +
          sw('id="peFeat"', p.featured, '★ Signature (mise en avant)') + '<div class="field" style="margin:0"><label for="peOrder">Ordre</label><input class="mini-input" id="peOrder" type="number" value="' + esc(p.order || 1) + '"></div></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn--ghost" data-close type="button">Annuler</button><button class="btn btn--copper btn--block" id="peSave" type="button">Enregistrer</button></div>');
    function current() { return { tint: el('peTint').value, vessel: el('peVessel').value, temp: el('peTemp').value, layer: el('peLayer').checked, tints: p.tints, fruit: p.fruit, art: p.art }; }
    function refreshHero() {
      var hero = el('peHero');
      if (work.newData) { hero.innerHTML = '<img src="' + work.newData + '" alt="">'; return; }
      if (work.image) { hero.innerHTML = mediaHTML({ image: work.image, visual: current() }); hydrateMedia(hero); return; }
      hero.innerHTML = ART.tile(current());
    }
    function renderGroups() {
      el('peGroups').innerHTML = catalog.optionGroups.map(function (g) {
        return '<button type="button" class="opt-chip ' + (work.groups.indexOf(g.id) >= 0 ? 'selected' : '') + '" data-gid="' + esc(g.id) + '">' + esc(g.name) + '</button>';
      }).join('') || '<span class="muted">Aucun groupe d\'options.</span>';
      $$('[data-gid]', el('peGroups')).forEach(function (b) { b.addEventListener('click', function () {
        var gid = b.getAttribute('data-gid'), i = work.groups.indexOf(gid);
        if (i >= 0) work.groups.splice(i, 1); else work.groups.push(gid);
        renderGroups();
      }); });
    }
    refreshHero(); renderGroups();
    ['peVessel', 'peTint', 'peTemp', 'peLayer'].forEach(function (i) { el(i).addEventListener('input', refreshHero); el(i).addEventListener('change', refreshHero); });
    el('peImg').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      if (f.size > 12 * 1024 * 1024) { toast('Image trop lourde (max 12 Mo)', 'err'); return; }
      resizeImage(f, 900, function (data) {
        if (!data) { toast('Image illisible', 'err'); return; }
        work.newData = data; el('peImgDel').style.display = ''; refreshHero(); toast('Photo prête (aperçu)');
      });
    });
    el('peImgDel').addEventListener('click', function () { work.image = ''; work.newData = null; this.style.display = 'none'; refreshHero(); });
    el('peSave').addEventListener('click', function () {
      var name = el('peName').value.trim(); if (!name) { toast('Nom requis', 'err'); return; }
      var rawPrice = el('pePrice').value.trim();
      var price = rawPrice === '' ? null : M.round2(num(rawPrice, 0));
      if (price !== null && price < 0) { toast('Prix invalide', 'err'); return; }
      if (work.newData) work.image = M.saveMedia('img_' + slug(p.id) + '_' + Date.now().toString(36), work.newData);
      var data = M.clone(p);
      data.name = name; data.categoryId = el('peCat').value; data.price = price; data.description = el('peDesc').value.trim();
      data.tags = el('peTags').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      data.optionGroupIds = work.groups.slice(); data.image = work.image;
      var v = current(); data.tint = v.tint; data.vessel = v.vessel; data.temp = v.temp; data.layer = v.layer;
      data.active = el('peActive').checked; data.available = el('peAvail').checked; data.featured = el('peFeat').checked; data.order = num(el('peOrder').value, 1);
      var idx = -1; for (var i = 0; i < catalog.products.length; i++) if (catalog.products[i].id === p.id) { idx = i; break; }
      if (idx >= 0) catalog.products[idx] = data; else catalog.products.push(data);
      persist(); closeModal(); render('products'); toast(idx >= 0 ? 'Produit enregistré ✓ — visible côté client' : 'Produit ajouté ✓');
    });
  }

  /* =========================================================================
     CATÉGORIES
     ========================================================================= */
  VIEWS.categories = {
    view: function () {
      var vessels = function (cur) { return ART.VESSELS.map(function (v) { return '<option value="' + v.id + '" ' + (cur === v.id ? 'selected' : '') + '>' + esc(v.label) + '</option>'; }).join(''); };
      var rows = catalog.categories.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).map(function (c) {
        var n = catalog.products.filter(function (p) { return p.categoryId === c.id; }).length;
        return '<tr><td style="min-width:180px"><input class="mini-input" data-cset="name" data-id="' + esc(c.id) + '" value="' + esc(c.name) + '"></td>' +
          '<td style="min-width:240px"><input class="mini-input" data-cset="description" data-id="' + esc(c.id) + '" value="' + esc(c.description || '') + '"></td>' +
          '<td><select class="mini-input" data-cset="icon" data-id="' + esc(c.id) + '">' + vessels(c.icon) + '</select></td>' +
          '<td><input class="mini-input" style="width:70px" type="number" data-cset="order" data-id="' + esc(c.id) + '" value="' + esc(c.order || 1) + '"></td>' +
          '<td>' + sw('data-cact data-id="' + esc(c.id) + '"', c.active !== false, c.active !== false ? 'Visible' : 'Masquée') + '</td>' +
          '<td>' + n + '</td><td><button class="link-danger" type="button" data-cdel="' + esc(c.id) + '">Supprimer</button></td></tr>';
      }).join('');
      return '<div class="adm-card"><h3>Catégories de la carte</h3><p class="hint">Une catégorie masquée cache tous ses produits côté client. Une catégorie vide n\'apparaît pas.</p>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Nom</th><th>Description</th><th>Icône</th><th>Ordre</th><th>Affichage</th><th>Produits</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
        '<div class="adm-card"><h3>Ajouter une catégorie</h3><div class="toolbar" style="margin:0"><input class="mini-input grow" id="newCat" placeholder="Ex. Brunch du week-end"><button class="btn btn--copper btn--sm" type="button" id="addCat">+ Ajouter</button></div></div>';
    },
    bind: function () {
      $$('[data-cset]').forEach(function (i) { i.addEventListener('change', function () { var c = findCat(i.getAttribute('data-id')), k = i.getAttribute('data-cset'); if (!c) return; c[k] = k === 'order' ? num(i.value, 1) : i.value.trim(); persist(); toast('Catégorie mise à jour'); }); });
      $$('[data-cact]').forEach(function (i) { i.addEventListener('change', function () { var c = findCat(i.getAttribute('data-id')); if (c) { c.active = i.checked; persist(); render('categories'); } }); });
      $$('[data-cdel]').forEach(function (b) { b.addEventListener('click', function () {
        var id = b.getAttribute('data-cdel'), n = catalog.products.filter(function (p) { return p.categoryId === id; }).length;
        if (n) { toast('Déplacez ou supprimez d\'abord les ' + n + ' produit(s) de cette catégorie', 'err'); return; }
        if (!confirm('Supprimer cette catégorie ?')) return;
        catalog.categories = catalog.categories.filter(function (c) { return c.id !== id; }); persist(); render('categories');
      }); });
      el('addCat').addEventListener('click', function () {
        var name = el('newCat').value.trim(); if (!name) { toast('Nom requis', 'err'); return; }
        catalog.categories.push({ id: 'cat_' + slug(name) + '_' + Date.now().toString(36).slice(-4), name: name, icon: 'cup', description: '', order: catalog.categories.length + 1, active: true });
        persist(); render('categories'); toast('Catégorie ajoutée');
      });
    }
  };

  /* =========================================================================
     OPTIONS & SUPPLÉMENTS
     ========================================================================= */
  VIEWS.options = {
    view: function () {
      var cats = catalog.categories.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>'; }).join('');
      var cards = catalog.optionGroups.map(function (g) {
        var used = catalog.products.filter(function (p) { return (p.optionGroupIds || []).indexOf(g.id) >= 0; }).length;
        var choices = (g.choices || []).map(function (ch) {
          return '<tr><td><input class="mini-input" data-chset="name" data-g="' + esc(g.id) + '" data-c="' + esc(ch.id) + '" value="' + esc(ch.name) + '"></td>' +
            '<td><input class="mini-input" style="width:90px" type="number" step="0.05" min="0" data-chset="price" data-g="' + esc(g.id) + '" data-c="' + esc(ch.id) + '" value="' + esc(ch.price || 0) + '"></td>' +
            '<td>' + sw('data-chav data-g="' + esc(g.id) + '" data-c="' + esc(ch.id) + '"', ch.available !== false, 'Dispo') + '</td>' +
            '<td><button class="link-danger" type="button" data-chdel data-g="' + esc(g.id) + '" data-c="' + esc(ch.id) + '">✕</button></td></tr>';
        }).join('');
        return '<div class="rule-card">' +
          '<div class="adm-row" style="grid-template-columns:2fr 1fr 1fr;align-items:end">' +
            '<div class="field" style="margin:0"><label>Nom du groupe</label><input class="mini-input" data-gset="name" data-g="' + esc(g.id) + '" value="' + esc(g.name) + '"></div>' +
            '<div class="field" style="margin:0"><label>Type</label><select class="mini-input" data-gset="type" data-g="' + esc(g.id) + '"><option value="single" ' + (g.type !== 'multi' ? 'selected' : '') + '>Un seul choix</option><option value="multi" ' + (g.type === 'multi' ? 'selected' : '') + '>Plusieurs choix</option></select></div>' +
            '<div style="padding-bottom:6px">' + sw('data-greq data-g="' + esc(g.id) + '"', g.required, 'Obligatoire') + '</div>' +
          '</div>' +
          '<div class="field" style="margin:10px 0"><label>Aide affichée au client</label><input class="mini-input" data-gset="help" data-g="' + esc(g.id) + '" value="' + esc(g.help || '') + '"></div>' +
          '<div class="table-wrap"><table class="table"><thead><tr><th>Choix</th><th>Supplément (€)</th><th></th><th></th></tr></thead><tbody>' + choices + '</tbody></table></div>' +
          '<div class="toolbar" style="margin:8px 0 0"><input class="mini-input grow" id="nc_' + esc(g.id) + '" placeholder="Nouveau choix (ex. Lait de coco)"><input class="mini-input" style="width:100px" type="number" step="0.05" id="ncp_' + esc(g.id) + '" placeholder="+ €"><button class="btn btn--sm" type="button" data-chadd="' + esc(g.id) + '">+ Choix</button></div>' +
          '<div class="toolbar" style="margin:10px 0 0;border-top:1px dashed var(--line);padding-top:10px"><span class="muted" style="font-size:13px">Utilisé par <b>' + used + '</b> produit(s).</span>' +
            '<select class="mini-input" style="width:auto" id="gc_' + esc(g.id) + '">' + cats + '</select><button class="btn btn--ghost btn--sm" type="button" data-gapply="' + esc(g.id) + '">Ajouter à toute la catégorie</button><button class="btn btn--ghost btn--sm" type="button" data-gunapply="' + esc(g.id) + '">Retirer de la catégorie</button>' +
            '<button class="link-danger" type="button" data-gdel="' + esc(g.id) + '" style="margin-left:auto">Supprimer le groupe</button></div>' +
        '</div>';
      }).join('');
      return '<div class="adm-card"><h3>Options & suppléments</h3><p class="hint">Ce sont les choix proposés au client (carte officielle : lait végétal, sirop BIO, extra espresso, parfum du café turc, chaud/froid…). Le prix du supplément s\'ajoute automatiquement.</p></div>' + cards +
        '<div class="adm-card"><h3>Nouveau groupe d\'options</h3><div class="toolbar" style="margin:0"><input class="mini-input grow" id="newGroup" placeholder="Ex. Taille, Sucre…"><button class="btn btn--copper btn--sm" type="button" id="addGroup">+ Créer</button></div></div>';
    },
    bind: function () {
      function grp(i) { return findGroup(i.getAttribute('data-g')); }
      function ch(i) { var g = grp(i); return g && g.choices.filter(function (c) { return c.id === i.getAttribute('data-c'); })[0]; }
      $$('[data-gset]').forEach(function (i) { i.addEventListener('change', function () { var g = grp(i); if (g) { g[i.getAttribute('data-gset')] = i.value.trim(); persist(); toast('Enregistré'); } }); });
      $$('[data-greq]').forEach(function (i) { i.addEventListener('change', function () { var g = grp(i); if (g) { g.required = i.checked; persist(); } }); });
      $$('[data-chset]').forEach(function (i) { i.addEventListener('change', function () { var c = ch(i); if (!c) return; var k = i.getAttribute('data-chset'); c[k] = k === 'price' ? M.round2(num(i.value, 0)) : i.value.trim(); persist(); toast('Enregistré'); }); });
      $$('[data-chav]').forEach(function (i) { i.addEventListener('change', function () { var c = ch(i); if (c) { c.available = i.checked; persist(); } }); });
      $$('[data-chdel]').forEach(function (b) { b.addEventListener('click', function () { var g = grp(b); if (!g) return; g.choices = g.choices.filter(function (c) { return c.id !== b.getAttribute('data-c'); }); persist(); render('options'); }); });
      $$('[data-chadd]').forEach(function (b) { b.addEventListener('click', function () {
        var gid = b.getAttribute('data-chadd'), g = findGroup(gid), name = el('nc_' + gid).value.trim();
        if (!name) { toast('Nom du choix requis', 'err'); return; }
        g.choices.push({ id: 'c_' + slug(name) + '_' + Date.now().toString(36).slice(-4), name: name, price: M.round2(num(el('ncp_' + gid).value, 0)), available: true });
        persist(); render('options');
      }); });
      $$('[data-gapply]').forEach(function (b) { b.addEventListener('click', function () {
        var gid = b.getAttribute('data-gapply'), cat = el('gc_' + gid).value, n = 0;
        catalog.products.forEach(function (p) { if (p.categoryId === cat && p.optionGroupIds.indexOf(gid) < 0) { p.optionGroupIds.push(gid); n++; } });
        persist(); render('options'); toast(n + ' produit(s) mis à jour');
      }); });
      $$('[data-gunapply]').forEach(function (b) { b.addEventListener('click', function () {
        var gid = b.getAttribute('data-gunapply'), cat = el('gc_' + gid).value, n = 0;
        catalog.products.forEach(function (p) { if (p.categoryId === cat && p.optionGroupIds.indexOf(gid) >= 0) { p.optionGroupIds = p.optionGroupIds.filter(function (x) { return x !== gid; }); n++; } });
        persist(); render('options'); toast(n + ' produit(s) mis à jour');
      }); });
      $$('[data-gdel]').forEach(function (b) { b.addEventListener('click', function () {
        var gid = b.getAttribute('data-gdel'); if (!confirm('Supprimer ce groupe d\'options (il sera retiré de tous les produits) ?')) return;
        catalog.optionGroups = catalog.optionGroups.filter(function (g) { return g.id !== gid; });
        catalog.products.forEach(function (p) { p.optionGroupIds = p.optionGroupIds.filter(function (x) { return x !== gid; }); });
        persist(); render('options');
      }); });
      el('addGroup').addEventListener('click', function () {
        var name = el('newGroup').value.trim(); if (!name) { toast('Nom requis', 'err'); return; }
        catalog.optionGroups.push({ id: 'og_' + slug(name) + '_' + Date.now().toString(36).slice(-4), name: name, type: 'single', required: false, help: '', choices: [] });
        persist(); render('options');
      });
    }
  };

  /* =========================================================================
     SUGGESTIONS DU PANIER
     ========================================================================= */
  var sgPreview = 'p_turkish_coffee';
  function productOptions(selected) {
    return catalog.products.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (p) {
      return '<option value="' + esc(p.id) + '" ' + (selected === p.id ? 'selected' : '') + '>' + esc(p.name) + (M.hasPrice(p) ? ' — ' + money(p.price) : ' (sans prix)') + (p.active === false ? ' [masqué]' : '') + '</option>';
    }).join('');
  }
  function idListHTML(ids, key) {
    return '<div class="chip-set">' + (ids || []).map(function (id, i) {
      var p = findProduct(id), ok = p && M.isOrderable(p, catalog);
      return '<span class="opt-chip" style="cursor:default;' + (ok ? '' : 'opacity:.6') + '" title="' + (ok ? '' : 'Ignoré tant que le produit est sans prix, masqué ou épuisé') + '">' + (key.indexOf('suggest') >= 0 || key === 'fallback' ? '<small>' + (i + 1) + '.</small> ' : '') + esc(p ? p.name : id) + (ok ? '' : ' ⚠️') +
        (i > 0 ? ' <button class="link-btn" type="button" data-up="' + key + '" data-i="' + i + '" title="Monter" style="text-decoration:none">↑</button>' : '') +
        ' <button class="link-danger" type="button" data-rm="' + key + '" data-i="' + i + '" title="Retirer">✕</button></span>';
    }).join('') + '</div>';
  }
  VIEWS.suggestions = {
    view: function () {
      var sg = catalog.suggestions;
      var rules = sg.rules.map(function (r, ri) {
        return '<div class="rule-card">' +
          '<div class="toolbar" style="margin-bottom:8px"><input class="mini-input grow" data-rset="name" data-r="' + ri + '" value="' + esc(r.name) + '">' + sw('data-ract data-r="' + ri + '"', r.active, 'Active') + '<button class="link-danger" type="button" data-rdel="' + ri + '">Supprimer</button></div>' +
          '<div class="field"><label>Message affiché au client</label><input class="mini-input" data-rset="message" data-r="' + ri + '" value="' + esc(r.message || '') + '"></div>' +
          '<div class="field"><label>Si le panier contient un produit de ces catégories…</label><div class="pick-list">' + catalog.categories.map(function (c) {
            return '<button type="button" class="opt-chip ' + (r.triggerCategoryIds.indexOf(c.id) >= 0 ? 'selected' : '') + '" data-rcat="' + esc(c.id) + '" data-r="' + ri + '">' + esc(c.name) + '</button>';
          }).join('') + '</div></div>' +
          '<div class="field"><label>… ou l\'un de ces produits</label>' + idListHTML(r.triggerProductIds, 'trigger:' + ri) +
            '<select class="mini-input" style="margin-top:6px" data-addto="trigger:' + ri + '"><option value="">+ Ajouter un produit déclencheur…</option>' + productOptions() + '</select></div>' +
          '<div class="field" style="margin:0"><label>… alors proposer (dans cet ordre)</label>' + idListHTML(r.suggestProductIds, 'suggest:' + ri) +
            '<select class="mini-input" style="margin-top:6px" data-addto="suggest:' + ri + '"><option value="">+ Ajouter un produit à proposer…</option>' + productOptions() + '</select></div>' +
        '</div>';
      }).join('');
      var preview = M.computeSuggestions([{ productId: sgPreview, qty: 1 }], catalog);
      return '' +
        '<div class="adm-card"><h3>Réglages</h3><div class="adm-row" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));align-items:end">' +
          sw('id="sgOn"', sg.enabled, 'Suggestions activées') + sw('id="sgAfter"', sg.afterAdd, 'Proposer juste après un ajout') +
          '<div class="field" style="margin:0"><label for="sgMax">Nombre de suggestions</label><input class="mini-input" id="sgMax" type="number" min="1" max="6" value="' + esc(sg.max || 3) + '"></div>' +
          '<div class="field" style="margin:0"><label for="sgTitle">Titre dans le panier</label><input class="mini-input" id="sgTitle" value="' + esc(sg.title || '') + '"></div>' +
        '</div><p class="hint" style="margin:10px 0 0">Les produits déjà au panier, épuisés, masqués ou <b>sans prix</b> ne sont jamais proposés : saisissez le prix des pâtisseries pour qu\'elles apparaissent.</p></div>' +
        '<div class="adm-card" style="background:var(--sage-soft)"><h3>👀 Aperçu</h3><div class="toolbar" style="margin:0"><span>Si le client a dans son panier :</span><select class="mini-input" style="width:auto" id="sgPrev">' + productOptions(sgPreview) + '</select></div>' +
          '<div style="margin-top:10px">' + (preview.items.length ? '<b>' + esc(preview.message || sg.title) + '</b><div class="chip-set" style="margin-top:6px">' + preview.items.map(function (p) { return '<span class="pill pill--green">' + esc(p.name) + ' · ' + money(p.price) + '</span>'; }).join('') + '</div>' : '<span class="muted">Aucune suggestion pour ce panier.</span>') + '</div></div>' +
        '<h3 style="margin:18px 0 10px">Règles</h3>' + rules +
        '<button class="btn btn--copper btn--sm" type="button" id="sgAddRule" style="margin-bottom:16px">+ Nouvelle règle</button>' +
        '<div class="adm-card"><h3>Suggestions par défaut</h3><p class="hint">Complètent la liste quand les règles ne suffisent pas.</p>' + idListHTML(sg.fallbackProductIds, 'fallback') +
          '<select class="mini-input" style="margin-top:6px" data-addto="fallback"><option value="">+ Ajouter…</option>' + productOptions() + '</select></div>';
    },
    bind: function () {
      var sg = catalog.suggestions;
      function listFor(key) { if (key === 'fallback') return sg.fallbackProductIds; var p = key.split(':'), r = sg.rules[+p[1]]; return p[0] === 'trigger' ? r.triggerProductIds : r.suggestProductIds; }
      function save() { persist(); render('suggestions'); }
      el('sgOn').addEventListener('change', function () { sg.enabled = this.checked; save(); });
      el('sgAfter').addEventListener('change', function () { sg.afterAdd = this.checked; save(); });
      el('sgMax').addEventListener('change', function () { sg.max = Math.max(1, Math.min(6, Math.round(num(this.value, 3)))); save(); });
      el('sgTitle').addEventListener('change', function () { sg.title = this.value.trim(); persist(); toast('Enregistré'); });
      el('sgPrev').addEventListener('change', function () { sgPreview = this.value; render('suggestions'); });
      $$('[data-rset]').forEach(function (i) { i.addEventListener('change', function () { sg.rules[+i.getAttribute('data-r')][i.getAttribute('data-rset')] = i.value.trim(); persist(); toast('Enregistré'); }); });
      $$('[data-ract]').forEach(function (i) { i.addEventListener('change', function () { sg.rules[+i.getAttribute('data-r')].active = i.checked; save(); }); });
      $$('[data-rdel]').forEach(function (b) { b.addEventListener('click', function () { if (!confirm('Supprimer cette règle ?')) return; sg.rules.splice(+b.getAttribute('data-rdel'), 1); save(); }); });
      $$('[data-rcat]').forEach(function (b) { b.addEventListener('click', function () {
        var r = sg.rules[+b.getAttribute('data-r')], id = b.getAttribute('data-rcat'), i = r.triggerCategoryIds.indexOf(id);
        if (i >= 0) r.triggerCategoryIds.splice(i, 1); else r.triggerCategoryIds.push(id); save();
      }); });
      $$('[data-addto]').forEach(function (s) { s.addEventListener('change', function () { if (!s.value) return; var l = listFor(s.getAttribute('data-addto')); if (l.indexOf(s.value) < 0) l.push(s.value); save(); }); });
      $$('[data-rm]').forEach(function (b) { b.addEventListener('click', function () { listFor(b.getAttribute('data-rm')).splice(+b.getAttribute('data-i'), 1); save(); }); });
      $$('[data-up]').forEach(function (b) { b.addEventListener('click', function () { var l = listFor(b.getAttribute('data-up')), i = +b.getAttribute('data-i'); var t = l[i - 1]; l[i - 1] = l[i]; l[i] = t; save(); }); });
      el('sgAddRule').addEventListener('click', function () { sg.rules.push({ id: M.uid('sg'), name: 'Nouvelle règle', active: true, triggerCategoryIds: [], triggerProductIds: [], suggestProductIds: [], message: 'Ça irait parfaitement avec…' }); save(); });
    }
  };

  /* =========================================================================
     TABLES & QR CODES
     ========================================================================= */
  var posterImg = null, qrCache = {};
  function siteBase() {
    if (S().siteUrl) return S().siteUrl.trim();
    try { return location.href.replace(/[#?].*$/, '').replace(/admin\.html$/, ''); } catch (e) { return ''; }
  }
  function tableUrl(t) { var b = siteBase(); return t ? b + (b.indexOf('?') >= 0 ? '&' : '?') + 'table=' + encodeURIComponent(t.id) : b; }
  function loadPoster(cb) {
    if (posterImg) { cb(posterImg); return; }
    var img = new Image(); img.onload = function () { posterImg = img; cb(img); }; img.onerror = function () { cb(null); }; img.src = 'assets/affiche-busra-fatih.webp';
  }
  function markImage(color, cb) {
    var img = new Image(); img.onload = function () { cb(img); }; img.onerror = function () { cb(null); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ART.logoMark(color));
  }
  function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
  function checker(x, X, Y, w, h, size, color) { x.fillStyle = color; for (var i = 0; i * size < w; i++) for (var j = 0; j * size < h; j++) if ((i + j) % 2 === 0) x.fillRect(X + i * size, Y + j * size, size, size); }
  // Affiche QR (format A6 portrait) : illustration Büşra & Fatih, logo, table, QR
  function buildQRCard(opts, cb) {
    if (typeof QRCode === 'undefined' || !QRCode.toCanvas) { cb(null, 'lib'); return; }
    var qc = document.createElement('canvas');
    QRCode.toCanvas(qc, opts.url, { errorCorrectionLevel: 'H', margin: 1, width: 600, color: { dark: '#18301f', light: '#ffffff' } }, function (err) {
      if (err) { cb(null, 'err'); return; }
      var fontsReady = (document.fonts && document.fonts.load) ? Promise.all(['64px Marcellus', '800 90px "Roboto Slab"', '700 30px Inter'].map(function (f) { return document.fonts.load(f); })).catch(function () {}) : Promise.resolve();
      fontsReady.then(function () {
        loadPoster(function (poster) { markImage('#22392a', function (mark) {
          try {
            var W = 1000, H = 1414, c = document.createElement('canvas'); c.width = W; c.height = H;
            var x = c.getContext('2d');
            x.fillStyle = '#f7f1e3'; x.fillRect(0, 0, W, H);
            checker(x, 0, 0, W, 20, 20, '#22392a'); checker(x, 0, H - 20, W, 20, 20, '#22392a');
            var y = 50;
            if (opts.poster !== false && poster) {
              x.save(); rr(x, 50, y, 900, 420, 28); x.clip();
              x.drawImage(poster, 70, 300, 980, 457, 50, y, 900, 420);
              x.restore();
              x.lineWidth = 6; x.strokeStyle = '#ffffff'; rr(x, 50, y, 900, 420, 28); x.stroke();
              y += 470;
            } else y += 60;
            x.textAlign = 'center';
            if (mark) x.drawImage(mark, W / 2 - 290, y - 6, 62, 72);
            x.fillStyle = '#22392a'; x.font = '64px Marcellus, Georgia, serif';
            x.fillText('M O Z A Ï K', W / 2 + 40, y + 52);
            x.font = '700 22px Inter, Arial'; x.fillStyle = '#3d6444'; x.fillText('B I O   C O F F E E   S H O P', W / 2 + 40, y + 86);
            y += 172;
            x.fillStyle = '#b5652b'; x.font = '800 ' + (opts.title.length > 12 ? 64 : 84) + 'px "Roboto Slab", Georgia, serif'; x.fillText(opts.title, W / 2, y);
            y += 30;
            var box = opts.poster !== false && poster ? 470 : 560, bx = (W - box) / 2;
            x.fillStyle = '#22392a'; rr(x, bx - 14, y, box + 28, box + 28, 34); x.fill();
            x.fillStyle = '#ffffff'; rr(x, bx, y + 14, box, box, 24); x.fill();
            x.drawImage(qc, bx + 26, y + 40, box - 52, box - 52);
            y += box + 28 + 62;
            x.fillStyle = '#22392a'; x.font = '800 38px "Roboto Slab", Georgia, serif'; x.fillText(opts.subtitle || 'Scannez · Commandez · Savourez', W / 2, y);
            x.fillStyle = '#6c6a5d'; x.font = '600 24px Inter, Arial'; x.fillText((S().address || '') + '  ·  @' + (S().instagram || 'mozaik.coffee'), W / 2, y + 44);
            cb(c.toDataURL('image/png'));
          } catch (e) { console.warn(e); cb(null, 'draw'); }
        }); });
      });
    });
  }
  function cardFor(t, cb) {
    var url = tableUrl(t), key = url + '|' + (S().qrPoster !== false) + '|' + (t ? t.label : '');
    if (qrCache[key]) { cb(qrCache[key]); return; }
    buildQRCard({ url: url, title: t ? t.label : 'Commandez ici', subtitle: t ? 'Scannez · Commandez · On vous sert à table' : 'Scannez pour commander à emporter', poster: S().qrPoster !== false }, function (data) { if (data) qrCache[key] = data; cb(data); });
  }
  function downloadData(name, dataUrl) { var a = document.createElement('a'); a.href = dataUrl; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { document.body.removeChild(a); }, 300); }
  function printCards(list) {
    var w = window.open('', '_blank'); if (!w) { toast('Autorisez les fenêtres pop-up pour imprimer', 'err'); return; }
    w.document.write('<html><head><title>QR codes Mozaïk</title><style>@page{size:A4;margin:8mm}body{margin:0;font-family:sans-serif}.g{display:grid;grid-template-columns:1fr 1fr;gap:6mm}.g img{width:100%;page-break-inside:avoid;border:1px dashed #ccc}</style></head><body><p id="w">Préparation…</p><div class="g" id="g"></div></body></html>');
    w.document.close();
    var i = 0;
    (function next() {
      if (i >= list.length) { w.document.getElementById('w').remove(); setTimeout(function () { w.print(); }, 400); return; }
      cardFor(list[i], function (data) { if (data) { var img = w.document.createElement('img'); img.src = data; w.document.getElementById('g').appendChild(img); } i++; next(); });
    })();
  }
  VIEWS.tables = {
    view: function () {
      var cards = catalog.tables.map(function (t, i) {
        return '<div class="qr-card ' + (t.active === false ? 'is-off' : '') + '" style="' + (t.active === false ? 'opacity:.6' : '') + '">' +
          '<div data-qr="' + i + '" style="min-height:150px;display:grid;place-items:center" class="muted">QR…</div>' +
          '<div style="display:grid;gap:6px;margin-top:8px;text-align:left">' +
            '<input class="mini-input" data-tset="label" data-i="' + i + '" value="' + esc(t.label) + '" aria-label="Nom">' +
            '<div style="display:flex;gap:6px"><input class="mini-input" data-tset="zone" data-i="' + i + '" value="' + esc(t.zone || '') + '" placeholder="Zone"><span class="pill pill--muted" title="Code dans le lien du QR" style="align-self:center">?table=' + esc(t.id) + '</span></div>' +
            sw('data-tact data-i="' + i + '"', t.active !== false, 'Active') +
            '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn--sm" type="button" data-tdl="' + i + '">⬇️ PNG</button><button class="btn btn--ghost btn--sm" type="button" data-tpr="' + i + '">🖨️</button><a class="btn btn--ghost btn--sm" href="' + esc(tableUrl(t)) + '" target="_blank" rel="noopener">Tester ↗</a><button class="link-danger" type="button" data-tdel="' + i + '">✕</button></div>' +
          '</div></div>';
      }).join('');
      var nextNum = 1; catalog.tables.forEach(function (t) { var n = parseInt(t.id, 10); if (!isNaN(n) && n >= nextNum) nextNum = n + 1; });
      return '<div class="adm-card"><h3>Comment ça marche</h3><p class="hint" style="margin:0">Chaque table a son QR code. Le client le scanne : la carte s\'ouvre avec <b>sa table identifiée</b>, la commande arrive ici avec le numéro de table. Imprimez les cartes et posez-les sur les tables.</p></div>' +
        '<div class="adm-card"><div class="grid-2">' + field('Adresse du site (modifiable si vous prenez un nom de domaine)', 'qrBase', siteBase()) +
          '<div class="field" style="align-self:end">' + sw('id="qrPoster"', S().qrPoster !== false, 'Inclure l\'illustration Büşra & Fatih') + '</div></div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--sm" type="button" id="qrSaveBase">Enregistrer l\'adresse</button><button class="btn btn--copper btn--sm" type="button" id="qrPrintAll">🖨️ Imprimer tous les QR (4 par page A4)</button><button class="btn btn--ghost btn--sm" type="button" id="qrGeneral">⬇️ QR général (vitrine / à emporter)</button></div></div>' +
        '<div class="qr-grid">' + cards + '</div>' +
        '<div class="adm-card" style="margin-top:14px"><h3>Ajouter une table</h3><div class="toolbar" style="margin:0">' +
          '<input class="mini-input" style="width:110px" id="ntId" value="' + nextNum + '" placeholder="Code"><input class="mini-input grow" id="ntLabel" value="Table ' + nextNum + '" placeholder="Nom affiché"><input class="mini-input" style="width:140px" id="ntZone" value="Salle" placeholder="Zone"><button class="btn btn--copper btn--sm" type="button" id="ntAdd">+ Ajouter</button></div></div>';
    },
    bind: function () {
      $$('[data-qr]').forEach(function (box) {
        var t = catalog.tables[+box.getAttribute('data-qr')];
        cardFor(t, function (data) { box.innerHTML = data ? '<img src="' + data + '" alt="QR ' + esc(t.label) + '">' : '<span style="color:var(--danger)">QR indisponible</span>'; });
      });
      $$('[data-tset]').forEach(function (i) { i.addEventListener('change', function () { catalog.tables[+i.getAttribute('data-i')][i.getAttribute('data-tset')] = i.value.trim(); persist(); render('tables'); }); });
      $$('[data-tact]').forEach(function (i) { i.addEventListener('change', function () { catalog.tables[+i.getAttribute('data-i')].active = i.checked; persist(); render('tables'); }); });
      $$('[data-tdel]').forEach(function (b) { b.addEventListener('click', function () { var t = catalog.tables[+b.getAttribute('data-tdel')]; if (!confirm('Supprimer ' + t.label + ' ? Son QR code ne fonctionnera plus.')) return; catalog.tables.splice(+b.getAttribute('data-tdel'), 1); persist(); render('tables'); }); });
      $$('[data-tdl]').forEach(function (b) { b.addEventListener('click', function () { var t = catalog.tables[+b.getAttribute('data-tdl')]; cardFor(t, function (d) { if (d) { downloadData('mozaik-qr-' + slug(t.label) + '.png', d); toast('QR téléchargé ✓'); } }); }); });
      $$('[data-tpr]').forEach(function (b) { b.addEventListener('click', function () { printCards([catalog.tables[+b.getAttribute('data-tpr')]]); }); });
      el('qrSaveBase').addEventListener('click', function () { var v = el('qrBase').value.trim(); S().siteUrl = (v === location.href.replace(/[#?].*$/, '').replace(/admin\.html$/, '')) ? '' : v; qrCache = {}; persist(); render('tables'); toast('Adresse enregistrée'); });
      el('qrPoster').addEventListener('change', function () { S().qrPoster = this.checked; qrCache = {}; persist(); render('tables'); });
      el('qrPrintAll').addEventListener('click', function () { printCards(catalog.tables.filter(function (t) { return t.active !== false; })); });
      el('qrGeneral').addEventListener('click', function () { cardFor(null, function (d) { if (d) downloadData('mozaik-qr-general.png', d); }); });
      el('ntAdd').addEventListener('click', function () {
        var id = el('ntId').value.trim().replace(/[^A-Za-z0-9_-]/g, ''), label = el('ntLabel').value.trim();
        if (!id || !label) { toast('Code et nom requis', 'err'); return; }
        if (catalog.tables.some(function (t) { return String(t.id).toLowerCase() === id.toLowerCase(); })) { toast('Ce code de table existe déjà', 'err'); return; }
        catalog.tables.push({ id: id, label: label, zone: el('ntZone').value.trim(), active: true }); persist(); render('tables'); toast('Table ajoutée');
      });
    }
  };

  /* =========================================================================
     OFFRES & CODES PROMO
     ========================================================================= */
  VIEWS.promos = {
    view: function () {
      var s = S(), uses = {};
      M.getOrders().forEach(function (o) { if (o.promoCode && o.status !== 'Annulée') uses[o.promoCode] = (uses[o.promoCode] || 0) + 1; });
      var rows = catalog.promos.map(function (p, i) {
        return '<tr><td><input class="mini-input" style="text-transform:uppercase;min-width:110px" data-prset="code" data-i="' + i + '" value="' + esc(p.code) + '"></td>' +
          '<td><select class="mini-input" data-prset="type" data-i="' + i + '"><option value="percent" ' + (p.type === 'percent' ? 'selected' : '') + '>%</option><option value="amount" ' + (p.type === 'amount' ? 'selected' : '') + '>€</option></select></td>' +
          '<td><input class="mini-input" style="width:80px" type="number" step="0.5" data-prset="value" data-i="' + i + '" value="' + esc(p.value) + '"></td>' +
          '<td><input class="mini-input" style="width:90px" type="number" step="0.5" data-prset="minAmount" data-i="' + i + '" value="' + esc(p.minAmount || 0) + '"></td>' +
          '<td><input class="mini-input" type="date" data-prset="expiresAt" data-i="' + i + '" value="' + esc(p.expiresAt || '') + '"></td>' +
          '<td><input class="mini-input" style="min-width:160px" data-prset="description" data-i="' + i + '" value="' + esc(p.description || '') + '"></td>' +
          '<td>' + sw('data-pract data-i="' + i + '"', p.active) + '</td><td>' + (uses[p.code] || 0) + '</td>' +
          '<td><button class="link-danger" type="button" data-prdel="' + i + '">✕</button></td></tr>';
      }).join('');
      return '<div class="adm-row" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">' +
        '<div class="adm-card"><h3>🎓 Réduction étudiante</h3><p class="hint">Affichée en boutique : « −10 % pour tous les étudiants ». Le client la coche à la validation ; vérifiez la carte au comptoir (rappel sur la commande).</p>' +
          sw('id="stOn"', s.studentEnabled, 'Activée') + '<div class="grid-2" style="margin-top:10px">' + field('Réduction (%)', 'stPct', s.studentDiscountPercent, 'number') + field('Mention', 'stText', catalog.content.studentText) + '</div></div>' +
        '<div class="adm-card"><h3>🎁 Fidélité (comme MYKONOS)</h3><p class="hint">Après la 1ʳᵉ commande, le client crée son compte : réduction utilisable une fois, après le délai.</p>' +
          sw('id="loOn"', s.loyaltyEnabled, 'Activée') + '<div class="grid-2" style="margin-top:10px">' + field('Réduction (%)', 'loPct', s.loyaltyDiscountPercent, 'number') + field('Délai avant activation (heures)', 'loDelay', s.loyaltyDelayHours, 'number') + '</div></div>' +
        '</div><div style="text-align:right;margin-bottom:14px"><button class="btn btn--sm" type="button" id="offersSave">Enregistrer les offres</button></div>' +
        '<div class="adm-card"><h3>🏷️ Codes promo</h3><p class="hint">Saisis par le client à la validation. Une seule réduction par commande (étudiant, fidélité ou code).</p>' +
          '<div class="table-wrap"><table class="table"><thead><tr><th>Code</th><th>Type</th><th>Valeur</th><th>Minimum €</th><th>Expire le</th><th>Description</th><th>Actif</th><th>Utilisations</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="9" class="muted">Aucun code.</td></tr>') + '</tbody></table></div>' +
          '<div class="toolbar" style="margin:12px 0 0"><input class="mini-input" style="width:150px;text-transform:uppercase" id="npCode" placeholder="CODE"><select class="mini-input" style="width:auto" id="npType"><option value="percent">%</option><option value="amount">€</option></select><input class="mini-input" style="width:90px" type="number" id="npVal" value="10"><button class="btn btn--copper btn--sm" type="button" id="npAdd">+ Ajouter</button></div></div>';
    },
    bind: function () {
      el('offersSave').addEventListener('click', function () {
        var s = S();
        s.studentEnabled = el('stOn').checked; s.studentDiscountPercent = num(el('stPct').value, 10); catalog.content.studentText = el('stText').value.trim();
        s.loyaltyEnabled = el('loOn').checked; s.loyaltyDiscountPercent = num(el('loPct').value, 10); s.loyaltyDelayHours = num(el('loDelay').value, 24);
        persist(); toast('Offres enregistrées ✓');
      });
      $$('[data-prset]').forEach(function (i) { i.addEventListener('change', function () {
        var p = catalog.promos[+i.getAttribute('data-i')], k = i.getAttribute('data-prset');
        p[k] = (k === 'value' || k === 'minAmount') ? num(i.value, 0) : (k === 'code' ? i.value.trim().toUpperCase() : i.value.trim());
        persist(); toast('Enregistré');
      }); });
      $$('[data-pract]').forEach(function (i) { i.addEventListener('change', function () { catalog.promos[+i.getAttribute('data-i')].active = i.checked; persist(); }); });
      $$('[data-prdel]').forEach(function (b) { b.addEventListener('click', function () { if (!confirm('Supprimer ce code ?')) return; catalog.promos.splice(+b.getAttribute('data-prdel'), 1); persist(); render('promos'); }); });
      el('npAdd').addEventListener('click', function () {
        var code = el('npCode').value.trim().toUpperCase(); if (!code) { toast('Code requis', 'err'); return; }
        if (catalog.promos.some(function (p) { return p.code === code; })) { toast('Ce code existe déjà', 'err'); return; }
        catalog.promos.push({ id: M.uid('promo'), code: code, type: el('npType').value, value: num(el('npVal').value, 0), minAmount: 0, expiresAt: '', active: true, description: '' });
        persist(); render('promos'); toast('Code ajouté');
      });
    }
  };

  /* =========================================================================
     CLIENTS & NEWSLETTER (comme MYKONOS)
     ========================================================================= */
  var custQ = '';
  VIEWS.customers = {
    view: function () {
      var list = M.getCustomers().filter(function (c) { return !custQ || norm([c.firstName, c.lastName, c.email, c.phone].join(' ')).indexOf(norm(custQ)) >= 0; });
      var rows = list.slice().reverse().map(function (cu) {
        var st = M.loyaltyStatus(cu, S()), pct = S().loyaltyDiscountPercent;
        var loy = st.used ? '<span class="pill pill--muted">Utilisée</span>' : st.eligible ? '<span class="pill pill--ok">−' + pct + ' % dispo</span>' : st.availableAt ? '<span class="pill pill--copper">le ' + new Date(st.availableAt).toLocaleDateString('fr-FR') + '</span>' : '<span class="pill pill--muted">en attente</span>';
        return '<tr><td><b>' + esc(cu.firstName || '') + ' ' + esc(cu.lastName || '') + '</b></td><td>' + esc(cu.email || '') + '<br><span class="oc-meta">' + esc(cu.phone || '') + '</span></td>' +
          '<td>' + (cu.orderCount || 0) + '</td><td>' + (cu.newsletter ? '📧 Oui' : '—') + '</td><td>' + loy + '</td><td>' + (cu.createdAt ? new Date(cu.createdAt).toLocaleDateString('fr-FR') : '—') + '</td>' +
          '<td>' + (st.used ? '<button class="btn btn--ghost btn--xs" type="button" data-reset-loy="' + esc(cu.email) + '">Réactiver</button> ' : '') + '<button class="link-danger" type="button" data-del-cust="' + esc(cu.email) + '">Suppr.</button></td></tr>';
      }).join('');
      return '<div class="adm-card"><div class="toolbar" style="margin:0"><input class="mini-input grow" id="cuQ" placeholder="Rechercher un client…" value="' + esc(custQ) + '"><button class="btn btn--sm" type="button" id="cuCsv">⬇️ Export CSV</button></div></div>' +
        '<div class="adm-card"><h3>Comptes clients (' + list.length + ')</h3><div class="table-wrap"><table class="table"><thead><tr><th>Nom</th><th>Contact</th><th>Cmd</th><th>News.</th><th>Fidélité</th><th>Inscrit le</th><th></th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="7" class="muted">Aucun client inscrit pour le moment.</td></tr>') + '</tbody></table></div></div>';
    },
    bind: function () {
      var t; el('cuQ').addEventListener('input', function () { var v = this.value; clearTimeout(t); t = setTimeout(function () { custQ = v; render('customers'); el('cuQ').focus(); }, 300); });
      el('cuCsv').addEventListener('click', function () {
        csvDownload('mozaik-clients.csv', [['Prénom', 'Nom', 'E-mail', 'Téléphone', 'Commandes', 'Newsletter', 'Inscrit le']].concat(M.getCustomers().map(function (c) { return [c.firstName, c.lastName, c.email, c.phone, c.orderCount || 0, c.newsletter ? 'oui' : 'non', c.createdAt ? fmtDT(c.createdAt) : '']; })));
      });
      $$('[data-del-cust]').forEach(function (b) { b.addEventListener('click', function () { if (!confirm('Supprimer ce client ?')) return; var e = b.getAttribute('data-del-cust'); M.saveCustomers(M.getCustomers().filter(function (x) { return x.email !== e; })); render('customers'); }); });
      $$('[data-reset-loy]').forEach(function (b) { b.addEventListener('click', function () {
        var cu = M.findCustomerByEmail(b.getAttribute('data-reset-loy'));
        if (cu) { cu.loyaltyUsed = false; cu.firstOrderAt = new Date(Date.now() - (S().loyaltyDelayHours * 3600000 + 60000)).toISOString(); M.upsertCustomer(cu); render('customers'); toast('Réduction réactivée'); }
      }); });
    }
  };
  VIEWS.newsletter = {
    view: function () {
      var list = M.getNewsletter(), active = list.filter(function (n) { return n.active; });
      var rows = list.slice().reverse().map(function (n) {
        return '<tr><td>' + esc(n.email) + '</td><td>' + esc(n.name || '') + '</td><td>' + new Date(n.date).toLocaleDateString('fr-FR') + '</td><td>' + (n.active ? '<span class="pill pill--ok">Actif</span>' : '<span class="pill pill--muted">Désinscrit</span>') + '</td><td><button class="link-danger" type="button" data-del-news="' + esc(n.email) + '">Suppr.</button></td></tr>';
      }).join('') || '<tr><td colspan="5" class="muted">Aucun abonné.</td></tr>';
      return '<div class="adm-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px"><div><h3 style="margin:0">Abonnés newsletter</h3><p class="muted" style="margin:0;font-size:14px">' + active.length + ' abonné(s) actif(s) sur ' + list.length + ' — idéal pour annoncer ateliers et nouveautés.</p></div><button class="btn btn--sm" type="button" id="exportNews">⬇️ Exporter (CSV)</button></div>' +
        '<div class="adm-card"><div class="table-wrap"><table class="table"><thead><tr><th>E-mail</th><th>Nom</th><th>Date</th><th>Statut</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
        '<div class="adm-card"><h3>Ajouter un e-mail</h3><div class="toolbar" style="margin:0"><input class="mini-input grow" id="newNews" placeholder="client@email.fr"><button class="btn btn--copper btn--sm" type="button" id="addNews">+ Ajouter</button></div></div>';
    },
    bind: function () {
      $$('[data-del-news]').forEach(function (b) { b.addEventListener('click', function () { if (!confirm('Supprimer cet abonné ?')) return; M.saveNewsletter(M.getNewsletter().filter(function (n) { return n.email !== b.getAttribute('data-del-news'); })); render('newsletter'); }); });
      el('addNews').addEventListener('click', function () { var e = el('newNews').value.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { toast('E-mail invalide', 'err'); return; } M.addNewsletter({ email: e }); render('newsletter'); toast('Abonné ajouté'); });
      el('exportNews').addEventListener('click', function () { csvDownload('mozaik-newsletter.csv', [['email', 'nom', 'date']].concat(M.getNewsletter().filter(function (n) { return n.active; }).map(function (n) { return [n.email, n.name || '', n.date]; }))); });
    }
  };

  /* =========================================================================
     COMPTABILITÉ (CA, encaissements, annulations, remboursements, paiements)
     ========================================================================= */
  var acc = { mode: 'month', month: new Date().getMonth(), year: new Date().getFullYear(), from: '', to: '' };
  var accData = null, accKey = '';
  function withAccData(section, render2) {
    var r = makeRange(acc), key = r.from + '-' + r.to;
    if (key === accKey && accData) { render2(accData, r); return; }
    accKey = key; accData = null;
    el('accBox').innerHTML = '<div class="adm-card muted">Chargement des données…</div>';
    loadRange(r, 45, function (list) { if (accKey !== key) return; accData = list; list.forEach(function (o) { lastLoaded[o.id] = o; }); if (current === section) render2(list, r); });
  }
  function bars(entries, fmt) {
    var max = Math.max.apply(null, entries.map(function (e) { return e.v; }).concat([1]));
    return entries.map(function (e) {
      return '<div style="margin-bottom:9px" title="' + esc(e.label + ' : ' + fmt(e)) + '"><div style="display:flex;justify-content:space-between;font-size:13px;gap:8px"><span>' + esc(e.label) + '</span><span><b>' + fmt(e) + '</b></span></div>' +
        '<div class="bar"><i style="width:' + Math.max(2, e.v / max * 100) + '%"></i></div></div>';
    }).join('');
  }
  function renderCompta(list, r) {
    var sm = M.summarize(list, r.from, r.to, vat());
    var spanDays = (r.to - r.from) / 86400000, byMonth = spanDays > 62, groups = {};
    Object.keys(sm.byDay).forEach(function (k) { var g = byMonth ? k.slice(0, 7) : k; if (!groups[g]) groups[g] = { v: 0, n: 0 }; groups[g].v += sm.byDay[k].net; groups[g].n += sm.byDay[k].count; });
    var series = Object.keys(groups).sort().map(function (k) {
      var lbl = byMonth ? MONTHS[parseInt(k.slice(5), 10) - 1] + ' ' + k.slice(0, 4) : new Date(k + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });
      return { label: lbl, v: M.round2(groups[k].v), n: groups[k].n };
    });
    var pays = Object.keys(sm.byPayment).map(function (k) { return sm.byPayment[k]; }).sort(function (a, b) { return b.net - a.net; });
    var modes = Object.keys(sm.byMode).map(function (k) { return { label: k, v: M.round2(sm.byMode[k].net), n: sm.byMode[k].count }; });
    var top = Object.keys(sm.products).map(function (k) { return sm.products[k]; }).sort(function (a, b) { return b.amount - a.amount; }).slice(0, 10);
    el('accBox').innerHTML = '' +
      '<div class="stat-grid">' +
        stat(money(sm.net), 'CA TTC (net des remboursements)', true) + stat(money(sm.ht), 'CA HT') + stat(money(sm.tva), 'TVA collectée (' + vat() + ' %)') +
        stat(sm.count, 'Commandes valides') + stat(money(sm.avg), 'Panier moyen') + stat(money(sm.collected), 'Encaissé net sur la période') +
        stat(money(sm.toCollect), 'Reste à encaisser (' + sm.toCollectCount + ')') + stat(money(sm.discounts), 'Remises accordées') +
        stat(sm.cancelledCount + ' · ' + money(sm.cancelledAmount), 'Annulations (exclues du CA)') + stat(sm.refundsCount + ' · ' + money(sm.refunds), 'Remboursements effectués') +
      '</div>' +
      '<div class="adm-card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="margin:0">💳 Répartition des encaissements — ' + esc(r.label) + '</h3><button class="btn btn--ghost btn--sm" type="button" id="accPayCsv">⬇️ CSV</button></div>' +
        '<div class="table-wrap" style="margin-top:8px"><table class="table"><thead><tr><th>Moyen de paiement</th><th class="num">Paiements</th><th class="num">Encaissé</th><th class="num">Remboursé</th><th class="num">Net</th><th style="width:30%"></th></tr></thead><tbody>' +
        (pays.map(function (p) { var mx = Math.max.apply(null, pays.map(function (x) { return x.net; }).concat([1])); return '<tr><td>' + esc(p.label) + '</td><td class="num">' + p.count + '</td><td class="num">' + money(p.in) + '</td><td class="num">' + (p.out ? '−' + money(p.out) : '—') + '</td><td class="num"><b>' + money(p.net) + '</b></td><td><div class="bar" style="margin:0"><i style="width:' + Math.max(2, p.net / mx * 100) + '%"></i></div></td></tr>'; }).join('') || '<tr><td colspan="6" class="muted">Aucun encaissement sur la période.</td></tr>') +
        (pays.length ? '<tr><td><b>Total</b></td><td class="num"><b>' + pays.reduce(function (s, p) { return s + p.count; }, 0) + '</b></td><td class="num"><b>' + money(sm.collectedGross) + '</b></td><td class="num"><b>' + (sm.refunds ? '−' + money(sm.refunds) : '—') + '</b></td><td class="num"><b>' + money(sm.collected) + '</b></td><td></td></tr>' : '') +
        '</tbody></table></div><p class="hint" style="margin:8px 0 0">Encaissements datés du jour du paiement ; remboursements datés du jour du remboursement.</p></div>' +
      '<div class="adm-row" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">' +
        '<div class="adm-card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h3 style="margin:0">CA TTC par ' + (byMonth ? 'mois' : 'jour') + '</h3><button class="btn btn--ghost btn--sm" type="button" id="accCsv">⬇️ CSV</button></div><div style="margin-top:10px">' +
          (series.length ? bars(series, function (e) { return money(e.v) + ' · ' + e.n + ' cmd'; }) : '<p class="muted" style="margin:0">Aucune vente sur cette période.</p>') + '</div></div>' +
        '<div class="adm-card"><h3>Par mode de service</h3>' + (modes.length ? bars(modes, function (e) { return money(e.v) + ' · ' + e.n + ' cmd'; }) : '<p class="muted" style="margin:0">—</p>') +
          '<h3 style="margin-top:16px">Meilleures ventes (avant remises)</h3>' + (top.length ? top.map(function (p) { return '<div class="order-line"><span>' + esc(p.name) + '</span><span><b>' + p.qty + '</b> · ' + money(p.amount) + '</span></div>'; }).join('') : '<p class="muted" style="margin:0">—</p>') + '</div>' +
      '</div>';
    el('accCsv').addEventListener('click', function () {
      var rows = [['Date', 'Commandes', 'CA HT', 'TVA', 'CA TTC net']];
      Object.keys(sm.byDay).sort().forEach(function (k) { var g = sm.byDay[k], ht = M.round2(g.net / (1 + vat() / 100)); rows.push([k, g.count, amount(ht), amount(g.net - ht), amount(g.net)]); });
      rows.push(['TOTAL', sm.count, amount(sm.ht), amount(sm.tva), amount(sm.net)]);
      csvDownload('mozaik-ca.csv', rows);
    });
    el('accPayCsv').addEventListener('click', function () {
      csvDownload('mozaik-encaissements.csv', [['Moyen', 'Paiements', 'Encaissé', 'Remboursé', 'Net']].concat(pays.map(function (p) { return [p.label, p.count, amount(p.in), amount(p.out), amount(p.net)]; })).concat([['TOTAL', '', amount(sm.collectedGross), amount(sm.refunds), amount(sm.collected)]]));
    });
  }
  VIEWS.compta = {
    view: function () {
      return rangeHTML(acc, ['today', 'yesterday', 'week', 'month', 'year']) +
        '<div class="adm-card" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>Taux de TVA :</b><input class="mini-input" style="width:80px" type="number" step="0.1" min="0" id="caVat" value="' + esc(vat()) + '"> %<button class="btn btn--ghost btn--sm" type="button" id="caVatSave">Enregistrer</button>' +
        '<span class="muted" style="margin-left:auto;font-size:13px">Période : <b>' + esc(makeRange(acc).label) + '</b></span></div><div id="accBox"></div>';
    },
    bind: function () {
      bindRange(acc, function () { render('compta'); });
      el('caVatSave').addEventListener('click', function () { S().vatRate = num(el('caVat').value, 10); persist(); render('compta'); toast('TVA mise à jour'); });
      withAccData('compta', renderCompta);
    }
  };

  /* =========================================================================
     TICKETS DE CAISSE (PDF unitaire, journal PDF, CSV — repris de MYKONOS)
     ========================================================================= */
  function ticketOrders(list, r) {
    return list.filter(function (o) { var t = new Date(o.createdAt).getTime(); return o.status !== 'Annulée' && t >= r.from && t <= r.to; })
      .sort(function (a, b) { return String(a.createdAt).localeCompare(String(b.createdAt)); });
  }
  function htOf(ttc) { return M.round2(ttc / (1 + vat() / 100)); }
  function renderTickets(list, r) {
    var tk = ticketOrders(list, r), tot = tk.reduce(function (s, o) { return s + M.orderNet(o); }, 0), ht = htOf(tot);
    el('accBox').innerHTML = '<div class="stat-grid">' + stat(tk.length, 'Tickets') + stat(money(ht), 'Total HT') + stat(money(tot - ht), 'TVA (' + vat() + ' %)') + stat(money(tot), 'Total TTC net', true) + '</div>' +
      '<div class="adm-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px"><div><h3 style="margin:0">Tickets — ' + esc(r.label) + '</h3><p class="muted" style="margin:0;font-size:13px">Commandes non annulées, montants nets des remboursements.</p></div>' +
      '<div style="display:flex;gap:8px"><button class="btn btn--sm" type="button" id="tkJournal">⬇️ Journal PDF</button><button class="btn btn--ghost btn--sm" type="button" id="tkCsv">⬇️ CSV</button></div></div>' +
      '<div class="adm-card"><div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Table / mode</th><th>Paiement</th><th class="num">HT</th><th class="num">TVA</th><th class="num">TTC</th><th></th></tr></thead><tbody>' +
      (tk.slice().reverse().map(function (o) {
        var ttc = M.orderNet(o), h = htOf(ttc);
        return '<tr><td><b>#' + esc(o.number) + '</b></td><td>' + fmtDT(o.createdAt) + '</td><td>' + esc(o.customer.firstName) + '</td><td>' + (o.table ? esc(o.table.label) : esc(o.fulfillment)) + '</td><td>' + payPill(o) + '</td>' +
          '<td class="num">' + money(h) + '</td><td class="num">' + money(ttc - h) + '</td><td class="num"><b>' + money(ttc) + '</b></td><td><button class="btn btn--ghost btn--xs" type="button" data-tpdf="' + o.id + '">PDF</button></td></tr>';
      }).join('') || '<tr><td colspan="9" class="muted">Aucun ticket sur cette période.</td></tr>') + '</tbody></table></div></div>';
    el('tkJournal').addEventListener('click', function () { journalPDF(tk, r); });
    el('tkCsv').addEventListener('click', function () {
      var rows = [['N°', 'Date', 'Heure', 'Client', 'Mode', 'Table', 'Paiement', 'Statut paiement', 'HT', 'TVA', 'TTC net']];
      tk.forEach(function (o) { var ttc = M.orderNet(o), h = htOf(ttc), d = new Date(o.createdAt); rows.push([o.number, d.toLocaleDateString('fr-FR'), d.toLocaleTimeString('fr-FR'), o.customer.firstName, o.fulfillment, o.table ? o.table.label : '', M.paymentLabel(o), o.paymentStatus, amount(h), amount(ttc - h), amount(ttc)]); });
      csvDownload('mozaik-tickets.csv', rows);
    });
    $$('[data-tpdf]').forEach(function (b) { b.addEventListener('click', function () { var o = getOrder(b.getAttribute('data-tpdf')); if (o) ticketPDF(o); }); });
  }
  VIEWS.tickets = {
    view: function () { return rangeHTML(acc, ['today', 'yesterday', 'week', 'month', 'year']) + '<div id="accBox"></div>'; },
    bind: function () { bindRange(acc, function () { render('tickets'); }); withAccData('tickets', renderTickets); }
  };
  function pdfText(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, ''); }
  function eu(n) { return amount(n) + ' EUR'; }
  function ticketPDF(o) {
    if (!(window.jspdf && window.jspdf.jsPDF)) { printOrder(o); return; }
    var s = S(), vr = vat(), W = 80, lines = (o.items || []).length;
    var doc = new window.jspdf.jsPDF({ unit: 'mm', format: [W, 120 + lines * 9] });
    var x = 6, y = 12;
    function cen(t, size, bold) { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.text(pdfText(t), W / 2, y, { align: 'center' }); }
    cen('MOZAIK', 16, true); y += 5; cen('Bio Coffee Shop', 8); y += 5;
    cen(s.address || '', 7.5); y += 4; if (s.phone) { cen(s.phone, 7.5); y += 4; }
    y += 2; doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(pdfText('Ticket #' + o.number), x, y); y += 4;
    doc.text(pdfText(new Date(o.createdAt).toLocaleString('fr-FR')), x, y); y += 4;
    doc.text(pdfText((o.table ? o.table.label : o.fulfillment) + ' - ' + (o.paidAt ? M.paymentLabel(o) : 'A encaisser')), x, y); y += 3;
    doc.line(x, y, W - x, y); y += 5;
    (o.items || []).forEach(function (l) {
      doc.setFontSize(9); doc.setTextColor(0);
      doc.text(pdfText(l.qty + 'x ' + l.name).slice(0, 34), x, y); doc.text(eu(M.lineTotal(l)), W - x, y, { align: 'right' }); y += 4;
      var opts = M.lineOptionsText(l); if (opts) { doc.setFontSize(7); doc.setTextColor(110); doc.text(pdfText(opts).slice(0, 52), x + 1, y); y += 3.6; }
    });
    doc.setTextColor(0); y += 1; doc.line(x, y, W - x, y); y += 5; doc.setFontSize(9);
    if (o.discount > 0) { doc.text('Sous-total', x, y); doc.text(eu(o.subtotal), W - x, y, { align: 'right' }); y += 4; doc.text(pdfText(o.discountLabel), x, y); doc.text('-' + eu(o.discount), W - x, y, { align: 'right' }); y += 4; }
    var refunded = M.orderRefunded(o);
    if (refunded) { doc.text('Total commande', x, y); doc.text(eu(o.total), W - x, y, { align: 'right' }); y += 4; doc.text('Rembourse', x, y); doc.text('-' + eu(refunded), W - x, y, { align: 'right' }); y += 4; }
    var ttc = M.orderNet(o), ht = htOf(ttc);
    doc.text('Total HT', x, y); doc.text(eu(ht), W - x, y, { align: 'right' }); y += 4;
    doc.text('TVA ' + vr + '%', x, y); doc.text(eu(ttc - ht), W - x, y, { align: 'right' }); y += 5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('TOTAL TTC', x, y); doc.text(eu(ttc), W - x, y, { align: 'right' }); y += 8;
    doc.setFont('helvetica', 'normal'); cen('Tesekkurler ! A bientot', 8);
    doc.save('mozaik-ticket-' + o.number + '.pdf');
  }
  function journalPDF(list, r) {
    if (!(window.jspdf && window.jspdf.jsPDF)) { toast('Librairie PDF indisponible', 'err'); return; }
    var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' }), x = 14, y = 18, W = 210, vr = vat();
    function row(c, bold, yy) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(9);
      doc.text(c[0], x, yy); doc.text(c[1], x + 18, yy); doc.text(c[2], x + 54, yy);
      doc.text(c[3], 146, yy, { align: 'right' }); doc.text(c[4], 170, yy, { align: 'right' }); doc.text(c[5], W - x, yy, { align: 'right' });
    }
    function head() { doc.setFillColor(232, 236, 220); doc.rect(x - 2, y - 4.5, W - 2 * (x - 2), 6.5, 'F'); row(['No', 'Date', 'Table / mode - paiement', 'HT', 'TVA', 'TTC'], true, y); y += 7; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('MOZAIK - Journal des ventes', x, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(pdfText('Periode : ' + r.label + '   -   TVA ' + vr + '%   -   montants nets des remboursements'), x, y); y += 8;
    head();
    var tot = 0;
    list.forEach(function (o) {
      if (y > 282) { doc.addPage(); y = 18; head(); }
      var ttc = M.orderNet(o), ht = htOf(ttc), d = new Date(o.createdAt); tot += ttc;
      row(['#' + o.number, d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), pdfText((o.table ? o.table.label : o.fulfillment) + ' - ' + (o.paidAt ? M.paymentLabel(o) : 'a encaisser')).slice(0, 42), eu(ht), eu(ttc - ht), eu(ttc)], false, y);
      y += 5.6;
    });
    var T = htOf(tot); y += 2; doc.setDrawColor(150); doc.line(x, y, W - x, y); y += 6;
    row(['TOTAL', '(' + list.length + ' tickets)', '', eu(T), eu(tot - T), eu(tot)], true, y);
    doc.save('mozaik-journal-ventes.pdf');
  }

  /* =========================================================================
     CONTENUS DU SITE
     ========================================================================= */
  VIEWS.content = {
    view: function () {
      var c = catalog.content;
      return '<div class="adm-card"><h3>📣 Annonce & bandeau</h3>' + field('Annonce en haut du site (vide = masquée)', 'ctAnnounce', c.announcement, 'text', 'placeholder="Ex. Nouveau : Pumpkin Spice Latte !"') +
          area('Bandeau défilant (une phrase par ligne)', 'ctMarquee', (c.marquee || []).join('\n'), 5) + '</div>' +
        '<div class="adm-card"><h3>🏠 Accueil</h3>' + field('Accroche', 'ctKicker', c.heroKicker) + field('Titre', 'ctTitle', c.heroTitle) + area('Texte', 'ctText', c.heroText, 3) +
          '<div class="grid-2">' + field('Titre de l\'affiche (cartouche)', 'ctPosterTitle', c.posterTitle) + field('Sous-titre de l\'affiche', 'ctPosterText', c.posterText) + '</div>' +
          '<div class="field"><label>Image de l\'affiche</label><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="pill pill--sage">' + (c.heroImage ? 'Image personnalisée' : 'Affiche Büşra & Fatih (par défaut)') + '</span>' +
            '<label class="btn btn--ghost btn--sm">📷 Remplacer<input type="file" id="ctHeroImg" accept="image/*" hidden></label>' + (c.heroImage ? '<button class="btn btn--ghost btn--sm" type="button" id="ctHeroReset">Revenir à l\'affiche</button>' : '') + '</div></div>' +
          area('Promesses (4 lignes)', 'ctPromises', (c.promises || []).join('\n'), 4) + '</div>' +
        '<div class="adm-card"><h3>☕ Café turc sur sable</h3>' + field('Titre', 'ctSandTitle', c.sandTitle) + area('Texte', 'ctSandText', c.sandText, 4) + area('Étapes (une par ligne)', 'ctSandSteps', (c.sandSteps || []).join('\n'), 4) + '</div>' +
        '<div class="adm-card"><h3>💚 Histoire & ateliers</h3>' + field('Prénoms affichés', 'ctTeam', c.teamNames) + field('Titre de l\'histoire', 'ctStoryTitle', c.storyTitle) + area('Histoire', 'ctStoryText', c.storyText, 5) +
          field('Titre ateliers', 'ctWsTitle', c.workshopsTitle) + area('Texte ateliers', 'ctWsText', c.workshopsText, 3) + field('Message de fin de commande', 'ctThanks', c.thanksText) + '</div>' +
        '<div style="text-align:right"><button class="btn btn--copper btn--lg" type="button" id="ctSave">💾 Enregistrer les contenus</button></div>';
    },
    bind: function () {
      function lines(id) { return el(id).value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
      el('ctSave').addEventListener('click', function () {
        var c = catalog.content;
        c.announcement = el('ctAnnounce').value.trim(); c.marquee = lines('ctMarquee');
        c.heroKicker = el('ctKicker').value.trim(); c.heroTitle = el('ctTitle').value.trim(); c.heroText = el('ctText').value.trim();
        c.posterTitle = el('ctPosterTitle').value.trim(); c.posterText = el('ctPosterText').value.trim(); c.promises = lines('ctPromises');
        c.sandTitle = el('ctSandTitle').value.trim(); c.sandText = el('ctSandText').value.trim(); c.sandSteps = lines('ctSandSteps');
        c.teamNames = el('ctTeam').value.trim(); c.storyTitle = el('ctStoryTitle').value.trim(); c.storyText = el('ctStoryText').value.trim();
        c.workshopsTitle = el('ctWsTitle').value.trim(); c.workshopsText = el('ctWsText').value.trim(); c.thanksText = el('ctThanks').value.trim();
        persist(); toast('Contenus enregistrés ✓ — visibles sur le site');
      });
      el('ctHeroImg').addEventListener('change', function () {
        var f = this.files && this.files[0]; if (!f) return;
        resizeImage(f, 1200, function (data) { if (!data) { toast('Image illisible', 'err'); return; } catalog.content.heroImage = M.saveMedia('hero_' + Date.now().toString(36), data); persist(); render('content'); toast('Image d\'accueil remplacée'); });
      });
      var rs = el('ctHeroReset'); if (rs) rs.addEventListener('click', function () { catalog.content.heroImage = ''; persist(); render('content'); });
    }
  };

  /* =========================================================================
     RÉGLAGES
     ========================================================================= */
  VIEWS.settings = {
    view: function () {
      var s = S();
      var hours = s.openingHours.map(function (h, d) { return { h: h, d: d }; });
      hours = hours.slice(1).concat(hours.slice(0, 1));
      return '' +
        '<div class="adm-card"><h3>🏪 Établissement</h3>' +
          '<div class="grid-2">' + field('Nom', 'setName', s.restaurantName) + field('Signature', 'setTagline', s.tagline) + '</div>' +
          field('Slogan', 'setSlogan', s.slogan) +
          '<div class="grid-2">' + field('Téléphone', 'setPhone', s.phone) + field('E-mail de contact', 'setEmail', s.email, 'email') + '</div>' +
          field('Adresse', 'setAddress', s.address) +
          '<div class="grid-2">' + field('Instagram (sans @)', 'setInsta', s.instagram) + field('Lien Google Maps', 'setMaps', s.mapsUrl) + '</div></div>' +
        '<div class="adm-card"><h3>🕒 Horaires</h3><div class="table-wrap"><table class="table"><thead><tr><th>Jour</th><th>Ouverture</th><th>Fermeture</th><th>Fermé</th></tr></thead><tbody>' +
          hours.map(function (x) { return '<tr><td>' + M.DAYS[x.d] + '</td><td><input class="mini-input" type="time" id="ho_' + x.d + '" value="' + esc(x.h.open) + '"></td><td><input class="mini-input" type="time" id="hc_' + x.d + '" value="' + esc(x.h.close) + '"></td><td>' + sw('id="hx_' + x.d + '"', x.h.closed) + '</td></tr>'; }).join('') +
          '</tbody></table></div><p class="hint" style="margin:8px 0 0">Affiché sur le site (« Ouvert / Fermé » en direct) : ' + esc(M.hoursSummary(s)) + '</p></div>' +
        '<div class="adm-card"><h3>🧾 Prise de commande</h3>' +
          '<div class="adm-row" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">' + sw('id="setPause"', s.ordersPaused, '⏸️ Mettre les commandes en ligne en pause') + sw('id="setRestrict"', s.restrictToOpeningHours, 'Commandes seulement pendant les horaires') + '</div>' +
          '<div class="grid-2" style="margin-top:10px">' + field('Modes proposés (séparés par une virgule)', 'setModes', (s.fulfillment || []).join(', ')) + field('Frais de livraison (€, si « Livraison »)', 'setDelivery', s.deliveryFee, 'number') + '</div>' +
          '<p class="hint" style="margin:0">Modes possibles : Sur place, À emporter, Livraison.</p></div>' +
        '<div class="adm-card"><h3>🔐 Code d\'accès</h3><p class="hint">Le code est stocké sous forme chiffrée (empreinte SHA-256). Préférez 6 caractères ou plus.</p><div class="grid-2">' +
          field('Code actuel', 'setCodeOld', '', 'password', 'autocomplete="off"') + field('Nouveau code', 'setCodeNew', '', 'password', 'autocomplete="new-password"') + '</div>' +
          '<button class="btn btn--sm" type="button" id="setCodeBtn">Changer le code</button></div>' +
        '<div class="adm-card"><h3>💳 Paiement</h3><p class="hint" style="margin:0">Paiement sur place (comptoir / à table) actif. Les paiements en ligne (CB, Apple Pay, Google Pay) apparaissent « Bientôt » côté client : ils nécessitent un compte Stripe <b>et</b> un petit serveur de paiement sécurisé. Aucune commande n\'est marquée payée sans encaissement réel.</p>' +
          '<div style="margin-top:10px">' + field('TVA applicable (%)', 'setVat', s.vatRate, 'number') + '</div></div>' +
        '<div class="adm-card"><h3>📧 E-mails automatiques (EmailJS)</h3>' + sw('id="setEmailOn"', s.email_enabled, 'Envoyer les e-mails de confirmation') +
          '<p class="hint" style="margin-top:8px">Même compte EmailJS que MYKONOS : les modèles reçoivent {{restaurant_name}} = ' + esc(s.restaurantName) + '.</p>' +
          '<div class="grid-2">' + field('Clé publique', 'setEjKey', s.emailjs_publicKey) + field('Service ID', 'setEjService', s.emailjs_serviceId) + field('Modèle client', 'setEjTplC', s.emailjs_templateClient) + field('Modèle gérant', 'setEjTplA', s.emailjs_templateAdmin) + '</div>' +
          field('E-mail qui reçoit les commandes', 'setEjTo', s.admin_notify_email, 'email') +
          '<button class="btn btn--ghost btn--sm" type="button" id="testEmail">✉️ Envoyer un e-mail de test</button></div>' +
        '<div style="text-align:right;margin-bottom:14px"><button class="btn btn--copper btn--lg" type="button" id="saveSettings">💾 Enregistrer les réglages</button></div>' +
        '<div class="adm-card"><h3>💾 Données & sauvegarde</h3><p class="hint">Exportez régulièrement une sauvegarde (carte, réglages, contenus). L\'export complet inclut aussi les commandes en cache, clients et newsletter.</p>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--sm" type="button" id="exportCatalog">⬇️ Sauvegarde de la carte</button><button class="btn btn--ghost btn--sm" type="button" id="exportAll">⬇️ Export complet</button>' +
          '<label class="btn btn--ghost btn--sm">⬆️ Importer une carte<input type="file" id="importCatalog" accept="application/json" hidden></label>' +
          '<button class="btn btn--ghost btn--sm" type="button" id="resetCatalog" style="color:var(--danger)">♻️ Réinitialiser la carte officielle</button></div></div>';
    },
    bind: function () {
      el('saveSettings').addEventListener('click', function () {
        var s = S();
        s.restaurantName = el('setName').value.trim() || 'MOZAÏK'; s.tagline = el('setTagline').value.trim(); s.slogan = el('setSlogan').value.trim();
        s.phone = el('setPhone').value.trim(); s.email = el('setEmail').value.trim(); s.address = el('setAddress').value.trim();
        s.instagram = el('setInsta').value.trim().replace(/^@/, ''); s.mapsUrl = el('setMaps').value.trim();
        for (var d = 0; d < 7; d++) s.openingHours[d] = { open: el('ho_' + d).value || '09:00', close: el('hc_' + d).value || '18:00', closed: el('hx_' + d).checked };
        s.ordersPaused = el('setPause').checked; s.restrictToOpeningHours = el('setRestrict').checked;
        var modes = el('setModes').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        s.fulfillment = modes.length ? modes : ['Sur place', 'À emporter'];
        s.deliveryFee = num(el('setDelivery').value, 0); s.vatRate = num(el('setVat').value, 10);
        s.email_enabled = el('setEmailOn').checked; s.emailjs_publicKey = el('setEjKey').value.trim(); s.emailjs_serviceId = el('setEjService').value.trim();
        s.emailjs_templateClient = el('setEjTplC').value.trim(); s.emailjs_templateAdmin = el('setEjTplA').value.trim(); s.admin_notify_email = el('setEjTo').value.trim();
        persist(); render('settings'); toast('Réglages enregistrés ✓');
      });
      el('setCodeBtn').addEventListener('click', function () {
        var oldc = el('setCodeOld').value.trim(), nc = el('setCodeNew').value.trim();
        if (M.hashAdminCode(oldc) !== S().adminCodeHash) { toast('Code actuel incorrect', 'err'); return; }
        if (nc.length < 4) { toast('Le nouveau code doit faire au moins 4 caractères', 'err'); return; }
        S().adminCodeHash = M.hashAdminCode(nc);
        try { sessionStorage.setItem(AUTH_KEY, S().adminCodeHash); } catch (e) {}
        persist(); el('setCodeOld').value = ''; el('setCodeNew').value = ''; toast('Code d\'accès changé ✓');
      });
      el('testEmail').addEventListener('click', function () {
        var s = S();
        if (!window.emailjs) { toast('Librairie e-mail non chargée', 'err'); return; }
        try {
          window.emailjs.init({ publicKey: s.emailjs_publicKey });
          window.emailjs.send(s.emailjs_serviceId, s.emailjs_templateAdmin, { order_number: 'TEST', first_name: 'Test', customer_name: 'Test Mozaïk', items: '• 1× Turkish Coffee BIO sur sable (test)', total: '4,50 €', fulfillment: 'Sur place — Table 1', wanted: 'maintenant', restaurant_name: s.restaurantName, to_email: s.admin_notify_email || s.email, customer_email: s.admin_notify_email || s.email })
            .then(function () { toast('E-mail de test envoyé ✓'); }).catch(function (e) { toast('Échec : ' + (e && e.text ? e.text : 'vérifiez les identifiants'), 'err'); });
        } catch (e) { toast('Erreur EmailJS', 'err'); }
      });
      el('exportCatalog').addEventListener('click', function () { downloadFile('mozaik-carte-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ catalog: M.getCatalog(), exportedAt: new Date().toISOString() }, null, 2), 'application/json'); });
      el('exportAll').addEventListener('click', function () { downloadFile('mozaik-export-complet-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ catalog: M.getCatalog(), orders: M.getOrders(), customers: M.getCustomers(), newsletter: M.getNewsletter(), exportedAt: new Date().toISOString() }, null, 2), 'application/json'); });
      el('importCatalog').addEventListener('change', function () {
        var f = this.files && this.files[0]; if (!f) return;
        var rd = new FileReader();
        rd.onload = function (e) {
          try {
            var parsed = JSON.parse(e.target.result), cat = parsed.catalog || parsed;
            if (!cat.settings || !cat.products) throw new Error('format');
            if (!confirm('Importer cette carte ? La carte actuelle sera remplacée.')) return;
            M.saveCatalog(M.normalize(cat)); catalog = M.getCatalog(); render('settings'); toast('Carte importée ✓');
          } catch (err) { toast('Fichier invalide', 'err'); }
        };
        rd.readAsText(f);
      });
      el('resetCatalog').addEventListener('click', function () {
        if (!confirm('Revenir à la carte officielle par défaut ? Vos modifications de produits, options, contenus et réglages seront perdues (commandes et clients conservés).')) return;
        var keepHash = S().adminCodeHash;
        catalog = M.resetCatalog(); catalog.settings.adminCodeHash = keepHash; persist(); render('settings'); toast('Carte réinitialisée');
      });
    }
  };

  /* =========================================================================
     LIAISONS GLOBALES / INIT
     ========================================================================= */
  function setLive(state) {
    var p = el('admLiveState'); if (!p) return;
    if (state === 'on') { p.textContent = '🟢 En direct'; p.className = 'pill pill--ok'; }
    else if (state === 'off') { p.textContent = '🟠 Reconnexion…'; p.className = 'pill pill--warn'; }
    else { p.textContent = '⚪ Local'; p.className = 'pill pill--muted'; }
  }
  function bindGlobal() {
    el('loginBadge').innerHTML = ART.logoBadge();
    el('sideMark').innerHTML = ART.logoMark(ART.CREAM);
    el('admLoginForm').addEventListener('submit', tryLogin);
    el('admLogout').addEventListener('click', logout);
    el('admMenuToggle').addEventListener('click', function () { el('admSide').classList.toggle('show'); el('admOverlay').classList.toggle('show'); });
    el('admOverlay').addEventListener('click', function () { el('admSide').classList.remove('show'); el('admOverlay').classList.remove('show'); });
    el('admModalBackdrop').addEventListener('click', closeModal);
    $$('#admNav button').forEach(function (b) { b.addEventListener('click', function () { render(b.getAttribute('data-sec')); window.scrollTo(0, 0); }); });
    // Délégation : actions sur les commandes + raccourcis de navigation
    el('admContent').addEventListener('click', function (e) {
      var b = e.target.closest('[data-oact]'); if (b) { orderAction(b); return; }
      var g = e.target.closest('[data-go]'); if (g) render(g.getAttribute('data-go'));
    });
    el('admSoundToggle').addEventListener('click', function () {
      var on = !soundOn(); setSound(on); updateSoundBtn();
      if (on) { getAudio(); playBell(); if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} } toast('Alerte sonore activée 🔔'); }
      else toast('Alerte sonore coupée 🔕', 'info');
    });
    document.addEventListener('click', function unlock() { getAudio(); document.removeEventListener('click', unlock); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

    window.MOZAIK_syncOrderBaseline = baseline;
    if (window.MOZAIK_FB && window.MOZAIK_FB.ready) setLive('on');
    window.addEventListener('mozaik:fb-ready', function () { setLive('on'); });
    window.addEventListener('mozaik:connection', function (e) { setLive(e.detail && e.detail.connected ? 'on' : 'off'); });
    window.addEventListener('mozaik:sync-error', function () { toast('⚠️ Synchronisation refusée par la base : vérifiez les règles Firebase', 'err'); });
    function onOrders() { checkNewOrders(); updateNavBadge(); if (isAuthed()) { accKey = ''; rerenderOrders(); } }
    window.addEventListener('mozaik:orders-updated', onOrders);
    window.addEventListener('mozaik:customers-updated', function () { if (isAuthed() && current === 'customers' && !modalOpen()) render('customers'); });
    window.addEventListener('mozaik:newsletter-updated', function () { if (isAuthed() && current === 'newsletter' && !modalOpen()) render('newsletter'); });
    window.addEventListener('mozaik:catalog-updated', function () {
      catalog = M.getCatalog();
      var typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && el('admContent').contains(document.activeElement);
      if (isAuthed() && !modalOpen() && !typing && ['dashboard', 'orders', 'history', 'compta', 'tickets'].indexOf(current) < 0) render(current);
    });
    window.addEventListener('storage', function (e) {
      if (e.key === M.KEYS.orders) onOrders();
      if (e.key === M.KEYS.catalog) catalog = M.getCatalog();
    });
    // Filet de sécurité (mode local, plusieurs onglets) + rafraîchit « il y a X min »
    setInterval(function () { checkNewOrders(); updateNavBadge(); if (isAuthed() && current === 'orders' && !modalOpen()) renderOrdersList(); }, 15000);
    window.addEventListener('focus', function () { clearInterval(titleTimer); document.title = BASE_TITLE; });
  }
  function init() {
    bindGlobal();
    if (isAuthed()) showApp(); else el('admCode').focus();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
