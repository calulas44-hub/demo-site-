/* ============================================================================
   MYKONOS – Espace administrateur (admin.js)
   Gère : commandes, produits (emoji + image), catégories, boissons, sauces,
   crudités, promotions, clients, newsletter, réglages, e-mails, sauvegarde.
   Tout est branché sur la MÊME source de données que le client.
   ==========================================================================*/
(function () {
  'use strict';
  var M = window.MYKONOS;
  var catalog = M.getCatalog();
  var currentSection = 'dashboard';

  /* ---------- utils ---------- */
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function money(n) { return M.money(n); }
  function num(v, d) { var x = parseFloat(String(v).replace(',', '.')); return isNaN(x) ? (d || 0) : x; }

  function toast(msg, type) {
    var wrap = el('toastWrap'); var t = document.createElement('div');
    t.className = 'toast ' + (type || 'ok');
    t.innerHTML = (type === 'err' ? '⚠️ ' : (type === 'info' ? 'ℹ️ ' : '✅ ')) + esc(msg);
    wrap.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; }, 2400);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2800);
  }
  function persist() {
    M.saveCatalog(catalog);
    var s = el('admSaveState');
    s.textContent = 'Enregistré ✓'; s.className = 'pill pill--ok';
  }
  function flashSaving() { var s = el('admSaveState'); s.textContent = 'Enregistrement…'; s.className = 'pill pill--gold'; }

  /* ---------------------------------------------------------------------
     Alerte sonore + notification à chaque nouvelle commande
     --------------------------------------------------------------------- */
  var SOUND_KEY = 'mykonos_admin_sound';
  var audioCtx = null, orderWatchTimer = null, lastOrderCount = null, titleFlashTimer = null;
  var BASE_TITLE = 'MYKONOS — Administration';

  function soundEnabled() { try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch (e) { return true; } }
  function setSoundEnabled(v) { try { localStorage.setItem(SOUND_KEY, v ? '1' : '0'); } catch (e) {} }

  function getAudio() {
    try {
      if (!audioCtx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) audioCtx = new AC(); }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) {}
    return audioCtx;
  }

  // Chant d'oiseau synthétisé (3 petits gazouillis) — aucun fichier externe requis
  function playChirp() {
    var ctx = getAudio(); if (!ctx) return;
    try {
      var now = ctx.currentTime;
      [0, 0.17, 0.34].forEach(function (t) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        var s = now + t;
        o.frequency.setValueAtTime(1900, s);
        o.frequency.exponentialRampToValueAtTime(3300, s + 0.07);
        o.frequency.exponentialRampToValueAtTime(2200, s + 0.13);
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.32, s + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.16);
        o.connect(g); g.connect(ctx.destination);
        o.start(s); o.stop(s + 0.18);
      });
    } catch (e) {}
  }

  function notifyDesktop(order) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      var body = order
        ? ('Commande #' + order.number + ' · ' + M.money(order.total) +
           (order.customer ? ' · ' + order.customer.firstName : ''))
        : 'Nouvelle commande reçue';
      new Notification('🍽️ Nouvelle commande MYKONOS', { body: body, tag: 'mykonos-order' });
    } catch (e) {}
  }

  function flashTitle(n) {
    try {
      clearInterval(titleFlashTimer);
      var on = true, count = 0;
      titleFlashTimer = setInterval(function () {
        document.title = on ? ('🔔 ' + n + ' commande' + (n > 1 ? 's' : '') + ' !') : BASE_TITLE;
        on = !on; if (++count > 12) { clearInterval(titleFlashTimer); document.title = BASE_TITLE; }
      }, 650);
    } catch (e) {}
  }

  function onNewOrders(n) {
    var orders = M.getOrders();
    if (soundEnabled()) playChirp();
    toast('🔔 ' + n + ' nouvelle' + (n > 1 ? 's' : '') + ' commande' + (n > 1 ? 's' : '') + ' !', 'info');
    notifyDesktop(orders[0]);
    flashTitle(n);
    if (currentSection === 'orders' || currentSection === 'dashboard') render(currentSection);
  }

  function startOrderWatch() {
    if (orderWatchTimer) return;
    lastOrderCount = M.getOrders().length;
    orderWatchTimer = setInterval(function () {
      var c = M.getOrders().length;
      if (lastOrderCount !== null && c > lastOrderCount) onNewOrders(c - lastOrderCount);
      lastOrderCount = c;
    }, 4000);
    // remet le titre normal quand l'admin revient sur l'onglet
    window.addEventListener('focus', function () { clearInterval(titleFlashTimer); document.title = BASE_TITLE; });
  }

  function updateSoundBtn() {
    var b = el('admSoundToggle'); if (!b) return;
    var on = soundEnabled();
    b.textContent = on ? '🔔 Son activé' : '🔕 Son coupé';
    b.classList.toggle('btn--red', on);
    b.classList.toggle('btn--ghost', !on);
  }

  /* ---------- modale admin ---------- */
  function openModal(html) { el('admModal').innerHTML = html; el('admModalWrap').classList.add('show'); document.body.style.overflow = 'hidden'; }
  function closeModal() { el('admModalWrap').classList.remove('show'); document.body.style.overflow = ''; }

  /* ---------- image resize ---------- */
  function resizeImage(file, maxSize, cb) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
        else { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        try { cb(c.toDataURL('image/jpeg', 0.82)); } catch (err) { cb(null); }
      };
      img.onerror = function () { cb(null); };
      img.src = e.target.result;
    };
    reader.onerror = function () { cb(null); };
    reader.readAsDataURL(file);
  }

  /* =====================================================================
     LOGIN
     ===================================================================== */
  var AUTH_KEY = 'mykonos_admin_auth';
  function isAuthed() { try { return sessionStorage.getItem(AUTH_KEY) === '1'; } catch (e) { return false; } }
  function setAuthed() { try { sessionStorage.setItem(AUTH_KEY, '1'); } catch (e) {} }
  function clearAuthed() { try { sessionStorage.removeItem(AUTH_KEY); } catch (e) {} }

  function tryLogin() {
    var code = el('admCode').value.trim();
    if (code === String(catalog.settings.adminCode)) {
      setAuthed(); showApp();
    } else {
      el('admLoginErr').textContent = 'Code incorrect.';
      el('admCode').value = ''; el('admCode').focus();
    }
  }
  function showApp() {
    el('admLogin').classList.add('hidden');
    el('admApp').classList.remove('hidden');
    updateSoundBtn();
    startOrderWatch();
    if (soundEnabled() && 'Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch (e) {}
    }
    render(currentSection);
  }
  function logout() { clearAuthed(); location.reload(); }

  /* =====================================================================
     NAVIGATION
     ===================================================================== */
  var TITLES = {
    dashboard: 'Tableau de bord', orders: 'Commandes', products: 'Produits',
    categories: 'Catégories', drinks: 'Boissons', sauces: 'Sauces',
    crudites: 'Crudités', promos: 'Promotions', customers: 'Clients',
    newsletter: 'Newsletter', settings: 'Réglages'
  };
  function render(section) {
    currentSection = section;
    catalog = M.getCatalog();
    el('admTitle').textContent = TITLES[section] || '';
    Array.prototype.forEach.call(el('admNav').querySelectorAll('button'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-sec') === section);
    });
    var c = el('admContent');
    switch (section) {
      case 'dashboard': c.innerHTML = viewDashboard(); bindDashboard(); break;
      case 'orders': c.innerHTML = viewOrders(); bindOrders(); break;
      case 'products': c.innerHTML = viewProducts(); bindProducts(); break;
      case 'categories': c.innerHTML = viewCategories(); bindCategories(); break;
      case 'drinks': c.innerHTML = viewDrinks(); bindDrinks(); break;
      case 'sauces': c.innerHTML = viewSimpleList('sauces'); bindSimpleList('sauces'); break;
      case 'crudites': c.innerHTML = viewCrudites(); bindCrudites(); break;
      case 'promos': c.innerHTML = viewPromos(); bindPromos(); break;
      case 'customers': c.innerHTML = viewCustomers(); bindCustomers(); break;
      case 'newsletter': c.innerHTML = viewNewsletter(); bindNewsletter(); break;
      case 'settings': c.innerHTML = viewSettings(); bindSettings(); break;
    }
    el('admSide').classList.remove('show'); el('admOverlay').classList.remove('show');
  }

  /* =====================================================================
     DASHBOARD
     ===================================================================== */
  function isToday(iso) { var d = new Date(iso), n = new Date(); return d.toDateString() === n.toDateString(); }
  function viewDashboard() {
    var orders = M.getOrders();
    var today = orders.filter(function (o) { return isToday(o.createdAt); });
    var revenueToday = today.filter(function (o) { return o.status !== 'Annulée'; }).reduce(function (s, o) { return s + o.total; }, 0);
    var revenueTotal = orders.filter(function (o) { return o.status !== 'Annulée'; }).reduce(function (s, o) { return s + o.total; }, 0);
    var customers = M.getCustomers();
    var news = M.getNewsletter().filter(function (n) { return n.active; });
    var activeProducts = catalog.products.filter(function (p) { return p.available; }).length;
    var newOrders = orders.filter(function (o) { return o.status === 'Nouvelle'; }).length;

    var recent = orders.slice(0, 6).map(function (o) {
      return '<tr>' +
        '<td><b>#' + o.number + '</b></td>' +
        '<td>' + esc(o.customer.firstName) + '</td>' +
        '<td>' + o.items.length + ' art.</td>' +
        '<td><b>' + money(o.total) + '</b></td>' +
        '<td>' + statusPill(o.status) + '</td>' +
        '<td class="no-print"><button class="btn btn--ghost btn--sm" data-open-order="' + o.id + '">Voir</button></td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="6" style="color:var(--muted)">Aucune commande pour le moment.</td></tr>';

    return '' +
      '<div class="stat-grid">' +
        stat(newOrders, 'Nouvelles commandes') +
        stat(today.length, "Commandes aujourd'hui") +
        stat(money(revenueToday), "CA du jour") +
        stat(money(revenueTotal), 'CA total') +
        stat(customers.length, 'Clients') +
        stat(news.length, 'Abonnés newsletter') +
        stat(activeProducts, 'Produits actifs') +
        stat(orders.length, 'Commandes totales') +
      '</div>' +
      '<div class="adm-card"><h3>Dernières commandes</h3><div class="table-wrap"><table class="table">' +
        '<thead><tr><th>N°</th><th>Client</th><th>Articles</th><th>Total</th><th>Statut</th><th></th></tr></thead>' +
        '<tbody>' + recent + '</tbody></table></div>' +
        '<button class="btn btn--red btn--sm" id="goOrders" style="margin-top:12px">Voir toutes les commandes →</button>' +
      '</div>' +
      '<div class="adm-card"><h3>🔔 Alerte sonore des commandes</h3><p style="color:var(--muted);margin:0;font-size:14px">Le bouton <b>« Son activé »</b> en haut à droite déclenche un <b>chant d\'oiseau</b> + une notification à chaque nouvelle commande reçue sur cet appareil. Gardez cette page ouverte au comptoir pour être prévenu(e). <i>Astuce : cliquez une fois sur la page pour autoriser le son.</i></p></div>' +
      '<div class="adm-card"><h3>ℹ️ Comment ça marche</h3><p style="color:var(--muted);margin:0;font-size:14px">Toutes vos modifications (prix, produits, emojis, images, sauces, boissons…) sont enregistrées et appliquées immédiatement côté client. Pensez à <b>exporter une sauvegarde</b> depuis <b>Réglages → Données</b> régulièrement.</p></div>';
  }
  function stat(n, l) { return '<div class="stat"><div class="n">' + n + '</div><div class="l">' + esc(l) + '</div></div>'; }
  function statusPill(s) {
    var map = { 'Nouvelle': 'pill--red', 'En préparation': 'pill--gold', 'Prête': 'pill--gold', 'Terminée': 'pill--ok', 'Annulée': 'pill--muted' };
    return '<span class="pill ' + (map[s] || 'pill--muted') + '">' + esc(s) + '</span>';
  }
  function bindDashboard() {
    var g = el('goOrders'); if (g) g.addEventListener('click', function () { render('orders'); });
    Array.prototype.forEach.call(el('admContent').querySelectorAll('[data-open-order]'), function (b) {
      b.addEventListener('click', function () { openOrderModal(b.getAttribute('data-open-order')); });
    });
  }

  /* =====================================================================
     COMMANDES
     ===================================================================== */
  var ORDER_STATUSES = ['Nouvelle', 'En préparation', 'Prête', 'Terminée', 'Annulée'];
  var orderFilter = 'all';
  function viewOrders() {
    var orders = M.getOrders();
    if (orderFilter !== 'all') orders = orders.filter(function (o) { return o.status === orderFilter; });

    var filters = '<div class="chip-set" style="margin-bottom:14px">' +
      ['all'].concat(ORDER_STATUSES).map(function (f) {
        return '<button class="opt-chip ' + (orderFilter === f ? 'selected' : '') + '" data-filter="' + esc(f) + '">' + (f === 'all' ? 'Toutes' : esc(f)) + '</button>';
      }).join('') + '</div>';

    var list = orders.map(orderCardHTML).join('') ||
      '<div class="adm-card" style="text-align:center;color:var(--muted)">Aucune commande dans cette catégorie.</div>';
    return filters + '<div id="ordersList">' + list + '</div>';
  }
  function orderCardHTML(o) {
    var items = o.items.map(function (l) {
      var det = [];
      if (l.isMenu && l.drink) det.push('Menu · ' + l.drink.name);
      if (l.bread) det.push(l.bread === 'galette' ? 'Galette' : 'Pain');
      if (l.sauces && l.sauces.length) det.push('Sauces: ' + l.sauces.join(', '));
      if (l.crudRemoved && l.crudRemoved.length) det.push('Sans: ' + l.crudRemoved.join(', '));
      return '<div class="order-line">' + l.qty + '× <b>' + esc(l.name) + '</b> — ' + money((Number(l.basePrice) + Number(l.menuUpgrade || 0)) * l.qty) +
        (det.length ? '<div class="sub">' + esc(det.join(' · ')) + '</div>' : '') + '</div>';
    }).join('');
    var options = ORDER_STATUSES.map(function (s) { return '<option ' + (o.status === s ? 'selected' : '') + '>' + s + '</option>'; }).join('');
    return '' +
      '<div class="order-card status-' + esc(o.status) + '" id="oc-' + o.id + '">' +
        '<div class="oc-head">' +
          '<div><b style="font-size:17px">#' + o.number + '</b> · ' + esc(o.customer.firstName) + ' ' + esc(o.customer.lastName || '') +
            '<div class="sub" style="color:var(--muted);font-size:12.5px">' + new Date(o.createdAt).toLocaleString('fr-FR') + ' · ' + esc(o.fulfillment) +
            (o.wantedTime ? ' · souhaité ' + esc(o.wantedDate) + ' ' + esc(o.wantedTime) : '') + '</div></div>' +
          '<div style="text-align:right"><div style="font-family:var(--font-display);font-size:22px;color:var(--red)">' + money(o.total) + '</div>' + statusPill(o.status) + '</div>' +
        '</div>' +
        '<div class="oc-items">' + items + '</div>' +
        (o.discount > 0 ? '<div class="sub" style="color:var(--ok)">Réduction ' + esc(o.discountLabel) + ' : -' + money(o.discount) + '</div>' : '') +
        (o.address ? '<div class="sub">📍 ' + esc(o.address) + '</div>' : '') +
        '<div class="sub">📞 ' + esc(o.customer.phone) + (o.customer.email ? ' · ✉️ ' + esc(o.customer.email) : '') + '</div>' +
        (o.note ? '<div class="sub">📝 ' + esc(o.note) + '</div>' : '') +
        '<div class="ci-actions no-print" style="margin-top:10px;gap:8px;flex-wrap:wrap">' +
          '<select class="mini-input" style="width:auto" data-status="' + o.id + '">' + options + '</select>' +
          '<button class="btn btn--ghost btn--sm" data-print="' + o.id + '">🖨️ Ticket</button>' +
          '<button class="link-danger" data-del-order="' + o.id + '">Supprimer</button>' +
        '</div>' +
      '</div>';
  }
  function bindOrders() {
    Array.prototype.forEach.call(el('admContent').querySelectorAll('[data-filter]'), function (b) {
      b.addEventListener('click', function () { orderFilter = b.getAttribute('data-filter'); render('orders'); });
    });
    Array.prototype.forEach.call(el('admContent').querySelectorAll('[data-status]'), function (sel) {
      sel.addEventListener('change', function () {
        M.updateOrder(sel.getAttribute('data-status'), { status: sel.value });
        toast('Statut mis à jour'); render('orders');
      });
    });
    Array.prototype.forEach.call(el('admContent').querySelectorAll('[data-del-order]'), function (b) {
      b.addEventListener('click', function () {
        if (!confirm('Supprimer définitivement cette commande ?')) return;
        var id = b.getAttribute('data-del-order');
        M.saveOrders(M.getOrders().filter(function (o) { return o.id !== id; }));
        toast('Commande supprimée'); render('orders');
      });
    });
    Array.prototype.forEach.call(el('admContent').querySelectorAll('[data-print]'), function (b) {
      b.addEventListener('click', function () { printOrder(b.getAttribute('data-print')); });
    });
  }
  function openOrderModal(id) {
    var o = M.getOrders().filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    openModal('<div class="modal-body" style="padding-top:20px">' + orderCardHTML(o).replace('no-print', '') + '</div><div class="modal-foot"><button class="btn btn--red btn--block" data-close>Fermer</button></div>');
    el('admModal').querySelector('[data-close]').addEventListener('click', closeModal);
  }
  function printOrder(id) {
    var o = M.getOrders().filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    var s = catalog.settings;
    var w = window.open('', '_blank', 'width=380,height=640');
    var items = o.items.map(function (l) {
      var det = [];
      if (l.isMenu && l.drink) det.push('Menu + ' + l.drink.name);
      if (l.bread) det.push(l.bread === 'galette' ? 'Galette' : 'Pain');
      if (l.sauces && l.sauces.length) det.push(l.sauces.join(', '));
      if (l.crudRemoved && l.crudRemoved.length) det.push('SANS ' + l.crudRemoved.join(', '));
      return '<tr><td>' + l.qty + '× ' + esc(l.name) + (det.length ? '<br><small>' + esc(det.join(' · ')) + '</small>' : '') + '</td><td style="text-align:right">' + money((Number(l.basePrice) + Number(l.menuUpgrade || 0)) * l.qty) + '</td></tr>';
    }).join('');
    w.document.write('<html><head><title>Ticket #' + o.number + '</title><style>body{font-family:monospace;padding:10px;font-size:13px}h2{text-align:center;margin:4px}table{width:100%;border-collapse:collapse}td{padding:3px 0;border-bottom:1px dashed #ccc;vertical-align:top}small{color:#555}.tot{font-size:16px;font-weight:bold}</style></head><body>' +
      '<h2>👑 ' + esc(s.restaurantName) + '</h2><div style="text-align:center">' + esc(s.address) + '<br>' + esc(s.phone) + '</div><hr>' +
      '<div>Commande <b>#' + o.number + '</b><br>' + new Date(o.createdAt).toLocaleString('fr-FR') + '<br>' + esc(o.fulfillment) + (o.wantedTime ? ' · ' + esc(o.wantedTime) : '') + '<br>Client: ' + esc(o.customer.firstName) + ' ' + esc(o.customer.lastName || '') + ' · ' + esc(o.customer.phone) + (o.address ? '<br>' + esc(o.address) : '') + '</div><hr>' +
      '<table>' + items + '</table><hr>' +
      (o.discount > 0 ? '<div>Sous-total: ' + money(o.subtotal) + '</div><div>Réduction: -' + money(o.discount) + '</div>' : '') +
      (o.delivery > 0 ? '<div>Livraison: ' + money(o.delivery) + '</div>' : '') +
      '<div class="tot" style="text-align:right">TOTAL: ' + money(o.total) + '</div>' +
      (o.note ? '<hr><div>Note: ' + esc(o.note) + '</div>' : '') +
      '<hr><div style="text-align:center">Merci et à bientôt ! 👑</div>' +
      '<script>window.onload=function(){window.print();}<\/script></body></html>');
    w.document.close();
  }

  /* =====================================================================
     PRODUITS
     ===================================================================== */
  function catName(id) { var c = catalog.categories.filter(function (x) { return x.id === id; })[0]; return c ? c.name : '—'; }
  function viewProducts() {
    var cards = catalog.products.slice().sort(function (a, b) {
      if (a.categoryId === b.categoryId) return (a.order || 0) - (b.order || 0);
      return a.categoryId < b.categoryId ? -1 : 1;
    }).map(productAdminCard).join('');
    return '' +
      '<div class="adm-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
        '<div><h3 style="margin:0">Gérer les produits</h3><p style="color:var(--muted);margin:0;font-size:14px">Prix, emoji, image, disponibilité, personnalisation, offre menu…</p></div>' +
        '<button class="btn btn--red" id="addProduct">+ Ajouter un produit</button>' +
      '</div>' +
      '<div class="adm-row">' + cards + '</div>';
  }
  function productMediaThumb(p) {
    if (p.image) return '<img src="' + esc(p.image) + '" alt="">';
    return esc(p.emoji || '🍽️');
  }
  function productAdminCard(p) {
    return '' +
      '<div class="prod-admin-card">' +
        '<div class="pac-head">' +
          '<div class="emoji-preview">' + productMediaThumb(p) + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<b>' + esc(p.name) + '</b><br><span class="pill pill--muted">' + esc(catName(p.categoryId)) + '</span> <b style="color:var(--red)">' + money(p.price) + '</b>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
          (p.customizable ? '<span class="pill pill--muted">Perso.</span>' : '') +
          (p.menuEligible ? '<span class="pill pill--gold">Menu +1€</span>' : '') +
          ((p.bread && p.bread.length) ? '<span class="pill pill--muted">' + p.bread.join('/') + '</span>' : '') +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
          '<label class="check" style="font-size:13px"><span class="switch"><input type="checkbox" data-avail="' + p.id + '" ' + (p.available ? 'checked' : '') + '><span class="slider"></span></span> ' + (p.available ? 'Disponible' : 'Épuisé') + '</label>' +
          '<div class="img-actions">' +
            '<button class="btn btn--ghost btn--sm" data-edit-prod="' + p.id + '">✏️ Modifier</button>' +
            '<button class="link-danger" data-del-prod="' + p.id + '">🗑️</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }
  function bindProducts() {
    el('addProduct').addEventListener('click', function () { openProductEditor(null); });
    Array.prototype.forEach.call(el('admContent').querySelectorAll('[data-edit-prod]'), function (b) {
      b.addEventListener('click', function () { openProductEditor(b.getAttribute('data-edit-prod')); });
    });
    Array.prototype.forEach.call(el('admContent').querySelectorAll('[data-del-prod]'), function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-del-prod');
        var p = catalog.products.filter(function (x) { return x.id === id; })[0];
        if (!confirm('Supprimer « ' + (p ? p.name : '') + ' » ?')) return;
        catalog.products = catalog.products.filter(function (x) { return x.id !== id; });
        persist(); render('products'); toast('Produit supprimé');
      });
    });
    Array.prototype.forEach.call(el('admContent').querySelectorAll('[data-avail]'), function (sw) {
      sw.addEventListener('change', function () {
        var p = catalog.products.filter(function (x) { return x.id === sw.getAttribute('data-avail'); })[0];
        if (p) { p.available = sw.checked; persist(); render('products'); }
      });
    });
  }

  var EMOJI_PALETTE = ['🥙','🌯','🍔','🍗','🍟','🍽️','🥗','🌭','🧆','🥪','🍕','🌮','🥤','🍺','🍰','🍦','🧒','👑','🔥','⭐'];
  function openProductEditor(id) {
    var p = id ? M.clone(catalog.products.filter(function (x) { return x.id === id; })[0]) : {
      id: M.uid('p'), categoryId: (catalog.categories[0] || {}).id, name: '', price: 0, description: '',
      emoji: '🥙', image: '', available: true, customizable: true, bread: ['pain', 'galette'], menuEligible: true, order: (catalog.products.length + 1)
    };
    var catsOpts = catalog.categories.map(function (c) { return '<option value="' + esc(c.id) + '" ' + (p.categoryId === c.id ? 'selected' : '') + '>' + esc(c.emoji || '') + ' ' + esc(c.name) + '</option>'; }).join('');

    var html = '' +
      '<div class="modal-head"><div class="modal-hero" id="peHero" style="height:96px;font-size:44px">' + (p.image ? '<img src="' + esc(p.image) + '">' : esc(p.emoji || '🍽️')) + '</div><button class="modal-close" data-close>✕</button></div>' +
      '<div class="modal-body">' +
        '<h3>' + (id ? 'Modifier le produit' : 'Nouveau produit') + '</h3>' +
        '<div class="field"><label>Nom *</label><input class="input" id="peName" value="' + esc(p.name) + '"></div>' +
        '<div class="grid-2">' +
          '<div class="field"><label>Catégorie</label><select class="select" id="peCat">' + catsOpts + '</select></div>' +
          '<div class="field"><label>Prix (€) *</label><input class="input" id="pePrice" type="number" step="0.10" min="0" value="' + esc(p.price) + '"></div>' +
        '</div>' +
        '<div class="field"><label>Description</label><textarea class="textarea" id="peDesc">' + esc(p.description || '') + '</textarea></div>' +

        '<div class="field"><label>Emoji du produit</label>' +
          '<div style="display:flex;gap:8px;align-items:center">' +
            '<input class="input" id="peEmoji" style="width:80px;text-align:center;font-size:20px" value="' + esc(p.emoji || '') + '" maxlength="4">' +
            '<button class="btn btn--ghost btn--sm" id="peEmojiClear">Aucun emoji</button>' +
          '</div>' +
          '<div class="chip-set" id="peEmojiPalette" style="margin-top:8px">' +
            EMOJI_PALETTE.map(function (e) { return '<button class="opt-chip" data-emoji="' + e + '">' + e + '</button>'; }).join('') +
          '</div>' +
        '</div>' +

        '<div class="field"><label>Image du produit</label>' +
          '<div class="img-actions">' +
            '<label class="btn btn--ghost btn--sm">📷 ' + (p.image ? 'Remplacer' : 'Ajouter une image') + '<input type="file" id="peImgInput" accept="image/*" hidden></label>' +
            '<button class="btn btn--ghost btn--sm" id="peImgRemove" ' + (p.image ? '' : 'style="display:none"') + '>Supprimer l\'image</button>' +
          '</div>' +
          '<p style="font-size:11.5px;color:var(--muted);margin:6px 0 0">L\'image (redimensionnée automatiquement) s\'affiche côté client à la place de l\'emoji. Elle est responsive (mobile/ordi).</p>' +
        '</div>' +

        '<div class="field"><label>Pain / galette proposés au client</label>' +
          '<div class="chip-set" id="peBread">' +
            '<button class="opt-chip ' + (p.bread.indexOf('pain') >= 0 ? 'selected' : '') + '" data-bread="pain">Pain</button>' +
            '<button class="opt-chip ' + (p.bread.indexOf('galette') >= 0 ? 'selected' : '') + '" data-bread="galette">Galette</button>' +
          '</div>' +
          '<p style="font-size:11.5px;color:var(--muted);margin:6px 0 0">Ex. burger = Pain uniquement. Assiette/dessert = ne cochez rien.</p>' +
        '</div>' +

        '<div class="adm-row" style="grid-template-columns:1fr 1fr">' +
          '<label class="check"><span class="switch"><input type="checkbox" id="peCustom" ' + (p.customizable ? 'checked' : '') + '><span class="slider"></span></span> Personnalisable (sauces + crudités)</label>' +
          '<label class="check"><span class="switch"><input type="checkbox" id="peMenu" ' + (p.menuEligible ? 'checked' : '') + '><span class="slider"></span></span> Éligible au Menu +1€</label>' +
          '<label class="check"><span class="switch"><input type="checkbox" id="peAvail" ' + (p.available ? 'checked' : '') + '><span class="slider"></span></span> Disponible</label>' +
          '<div class="field" style="margin:0"><label>Ordre d\'affichage</label><input class="mini-input" id="peOrder" type="number" value="' + esc(p.order || 1) + '"></div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn--ghost" data-close>Annuler</button><button class="btn btn--red btn--block" id="peSave">Enregistrer</button></div>';

    openModal(html);
    var modal = el('admModal');
    var work = { image: p.image || '', emoji: p.emoji || '' };
    modal.querySelector('[data-close]').addEventListener('click', closeModal);
    Array.prototype.forEach.call(modal.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', closeModal); });

    function refreshHero() {
      el('peHero').innerHTML = work.image ? '<img src="' + esc(work.image) + '">' : esc(el('peEmoji').value || '🍽️');
    }
    // emoji
    Array.prototype.forEach.call(modal.querySelectorAll('[data-emoji]'), function (b) {
      b.addEventListener('click', function () { el('peEmoji').value = b.getAttribute('data-emoji'); work.image = ''; el('peImgRemove').style.display = 'none'; refreshHero(); });
    });
    el('peEmoji').addEventListener('input', refreshHero);
    el('peEmojiClear').addEventListener('click', function () { el('peEmoji').value = ''; refreshHero(); });
    // bread
    Array.prototype.forEach.call(modal.querySelectorAll('#peBread [data-bread]'), function (b) {
      b.addEventListener('click', function () { b.classList.toggle('selected'); });
    });
    // image
    el('peImgInput').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      if (f.size > 6 * 1024 * 1024) { toast('Image trop lourde (max 6 Mo)', 'err'); return; }
      resizeImage(f, 640, function (dataUrl) {
        if (!dataUrl) { toast('Image illisible', 'err'); return; }
        work.image = dataUrl; el('peImgRemove').style.display = ''; refreshHero(); toast('Image prête (aperçu)');
      });
    });
    el('peImgRemove').addEventListener('click', function () { work.image = ''; this.style.display = 'none'; refreshHero(); });

    el('peSave').addEventListener('click', function () {
      var name = el('peName').value.trim();
      if (!name) { toast('Nom requis', 'err'); return; }
      var bread = [];
      Array.prototype.forEach.call(modal.querySelectorAll('#peBread [data-bread]'), function (b) { if (b.classList.contains('selected')) bread.push(b.getAttribute('data-bread')); });
      var data = {
        id: p.id, name: name, categoryId: el('peCat').value, price: num(el('pePrice').value, 0),
        description: el('peDesc').value.trim(), emoji: el('peEmoji').value.trim(), image: work.image,
        available: el('peAvail').checked, customizable: el('peCustom').checked, menuEligible: el('peMenu').checked,
        bread: bread, order: num(el('peOrder').value, 1)
      };
      var idx = -1;
      for (var i = 0; i < catalog.products.length; i++) if (catalog.products[i].id === p.id) { idx = i; break; }
      if (idx >= 0) catalog.products[idx] = data; else catalog.products.push(data);
      persist(); closeModal(); render('products'); toast(idx >= 0 ? 'Produit modifié' : 'Produit ajouté');
    });
  }

  /* =====================================================================
     CATÉGORIES
     ===================================================================== */
  function viewCategories() {
    var rows = catalog.categories.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).map(function (c) {
      var count = catalog.products.filter(function (p) { return p.categoryId === c.id; }).length;
      return '<tr>' +
        '<td><input class="mini-input" style="width:60px;text-align:center;font-size:18px" data-cat-emoji="' + c.id + '" value="' + esc(c.emoji || '') + '"></td>' +
        '<td><input class="mini-input" data-cat-name="' + c.id + '" value="' + esc(c.name) + '"></td>' +
        '<td><input class="mini-input" style="width:70px" type="number" data-cat-order="' + c.id + '" value="' + esc(c.order || 1) + '"></td>' +
        '<td>' + count + ' produit(s)</td>' +
        '<td><button class="link-danger" data-del-cat="' + c.id + '">Supprimer</button></td>' +
      '</tr>';
    }).join('');
    return '' +
      '<div class="adm-card"><h3>Catégories du menu</h3><div class="table-wrap"><table class="table">' +
        '<thead><tr><th>Emoji</th><th>Nom</th><th>Ordre</th><th>Produits</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="adm-card"><h3>Ajouter une catégorie</h3><div class="grid-2">' +
        '<div class="field"><label>Emoji</label><input class="input" id="newCatEmoji" value="🍽️" maxlength="4"></div>' +
        '<div class="field"><label>Nom</label><input class="input" id="newCatName" placeholder="Ex. Tacos"></div>' +
      '</div><button class="btn btn--red" id="addCat">+ Ajouter</button></div>';
  }
  function bindCategories() {
    Array.prototype.forEach.call(el('admContent').querySelectorAll('[data-cat-name]'), function (i) {
      i.addEventListener('change', function () { setCat(i.getAttribute('data-cat-name'), 'name', i.value.trim()); });
    });
    Array.prototype.forEach.call(el('admContent').querySelectorAll('[data-cat-emoji]'), function (i) {
      i.addEventListener('change', function () { setCat(i.getAttribute('data-cat-emoji'), 'emoji', i.value.trim()); });
    });
    Array.prototype.forEach.call(el('admContent').querySelectorAll('[data-cat-order]'), function (i) {
      i.addEventListener('change', function () { setCat(i.getAttribute('data-cat-order'), 'order', num(i.value, 1)); });
    });
    Array.prototype.forEach.call(el('admContent').querySelectorAll('[data-del-cat]'), function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-del-cat');
        var count = catalog.products.filter(function (p) { return p.categoryId === id; }).length;
        if (count > 0) { toast('Déplacez ou supprimez d\'abord les ' + count + ' produit(s) de cette catégorie.', 'err'); return; }
        if (!confirm('Supprimer cette catégorie ?')) return;
        catalog.categories = catalog.categories.filter(function (c) { return c.id !== id; });
        persist(); render('categories'); toast('Catégorie supprimée');
      });
    });
    el('addCat').addEventListener('click', function () {
      var name = el('newCatName').value.trim(); if (!name) { toast('Nom requis', 'err'); return; }
      catalog.categories.push({ id: M.uid('cat'), name: name, emoji: el('newCatEmoji').value.trim() || '🍽️', order: catalog.categories.length + 1 });
      persist(); render('categories'); toast('Catégorie ajoutée');
    });
  }
  function setCat(id, key, val) { var c = catalog.categories.filter(function (x) { return x.id === id; })[0]; if (c) { c[key] = val; persist(); } }

  /* =====================================================================
     BOISSONS
     ===================================================================== */
  function viewDrinks() {
    var rows = catalog.drinks.map(function (d) {
      return '<tr>' +
        '<td><input class="mini-input" data-d-name="' + d.id + '" value="' + esc(d.name) + '"></td>' +
        '<td><input class="mini-input" style="width:90px" type="number" step="0.10" data-d-price="' + d.id + '" value="' + esc(d.price) + '"></td>' +
        '<td><span class="switch"><input type="checkbox" data-d-avail="' + d.id + '" ' + (d.available ? 'checked' : '') + '><span class="slider"></span></span></td>' +
        '<td><span class="switch"><input type="checkbox" data-d-alc="' + d.id + '" ' + (d.alcohol ? 'checked' : '') + '><span class="slider"></span></span></td>' +
        '<td><button class="link-danger" data-del-drink="' + d.id + '">Supprimer</button></td>' +
      '</tr>';
    }).join('');
    return '' +
      '<div class="adm-card"><h3>Boissons (menu +1€ et vente à l\'unité)</h3>' +
        '<p style="color:var(--muted);font-size:14px;margin-top:0">Ces boissons sont proposées dans l\'offre « Menu +1€ » <b>et</b> vendues seules côté client. La colonne « Alcool » affiche automatiquement le contrôle d\'âge 18+ (ex. Heineken).</p>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Nom</th><th>Prix</th><th>Dispo.</th><th>Alcool 🔞</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="adm-card"><h3>Ajouter une boisson</h3><div class="adm-row" style="grid-template-columns:2fr 1fr auto">' +
        '<div class="field" style="margin:0"><label>Nom</label><input class="input" id="newDrinkName" placeholder="Ex. Ice Tea"></div>' +
        '<div class="field" style="margin:0"><label>Prix (€)</label><input class="input" id="newDrinkPrice" type="number" step="0.10" value="2.00"></div>' +
        '<label class="check" style="align-self:end;margin-bottom:12px"><input type="checkbox" id="newDrinkAlc"> Alcoolisée</label>' +
      '</div><button class="btn btn--red" id="addDrink">+ Ajouter</button></div>';
  }
  function bindDrinks() {
    var c = el('admContent');
    Array.prototype.forEach.call(c.querySelectorAll('[data-d-name]'), function (i) { i.addEventListener('change', function () { setDrink(i.getAttribute('data-d-name'), 'name', i.value.trim()); }); });
    Array.prototype.forEach.call(c.querySelectorAll('[data-d-price]'), function (i) { i.addEventListener('change', function () { setDrink(i.getAttribute('data-d-price'), 'price', num(i.value, 0)); }); });
    Array.prototype.forEach.call(c.querySelectorAll('[data-d-avail]'), function (i) { i.addEventListener('change', function () { setDrink(i.getAttribute('data-d-avail'), 'available', i.checked); }); });
    Array.prototype.forEach.call(c.querySelectorAll('[data-d-alc]'), function (i) { i.addEventListener('change', function () { setDrink(i.getAttribute('data-d-alc'), 'alcohol', i.checked); }); });
    Array.prototype.forEach.call(c.querySelectorAll('[data-del-drink]'), function (b) {
      b.addEventListener('click', function () {
        if (!confirm('Supprimer cette boisson ?')) return;
        catalog.drinks = catalog.drinks.filter(function (d) { return d.id !== b.getAttribute('data-del-drink'); });
        persist(); render('drinks'); toast('Boisson supprimée');
      });
    });
    el('addDrink').addEventListener('click', function () {
      var name = el('newDrinkName').value.trim(); if (!name) { toast('Nom requis', 'err'); return; }
      catalog.drinks.push({ id: M.uid('d'), name: name, price: num(el('newDrinkPrice').value, 2), available: true, alcohol: el('newDrinkAlc').checked });
      persist(); render('drinks'); toast('Boisson ajoutée');
    });
  }
  function setDrink(id, key, val) { var d = catalog.drinks.filter(function (x) { return x.id === id; })[0]; if (d) { d[key] = val; persist(); } }

  /* =====================================================================
     SAUCES (liste simple générique)
     ===================================================================== */
  function viewSimpleList(kind) {
    var list = catalog[kind];
    var label = 'sauce';
    var rows = list.map(function (it) {
      return '<tr>' +
        '<td><input class="mini-input" data-sl-name="' + it.id + '" value="' + esc(it.name) + '"></td>' +
        '<td><span class="switch"><input type="checkbox" data-sl-avail="' + it.id + '" ' + (it.available ? 'checked' : '') + '><span class="slider"></span></span> ' + (it.available ? 'Disponible' : 'Masquée') + '</td>' +
        '<td><button class="link-danger" data-sl-del="' + it.id + '">Supprimer</button></td>' +
      '</tr>';
    }).join('');
    return '' +
      '<div class="adm-card"><h3>Sauces proposées</h3><p style="color:var(--muted);font-size:14px;margin-top:0">Ces sauces apparaissent dans la personnalisation des sandwichs côté client.</p>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Nom</th><th>Disponibilité</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="adm-card"><h3>Ajouter une ' + label + '</h3><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">' +
        '<div class="field" style="margin:0;flex:1;min-width:180px"><label>Nom</label><input class="input" id="newSl" placeholder="Ex. Curry"></div>' +
        '<button class="btn btn--red" id="addSl">+ Ajouter</button></div></div>';
  }
  function bindSimpleList(kind) {
    var c = el('admContent');
    Array.prototype.forEach.call(c.querySelectorAll('[data-sl-name]'), function (i) {
      i.addEventListener('change', function () { var it = catalog[kind].filter(function (x) { return x.id === i.getAttribute('data-sl-name'); })[0]; if (it) { it.name = i.value.trim(); persist(); } });
    });
    Array.prototype.forEach.call(c.querySelectorAll('[data-sl-avail]'), function (i) {
      i.addEventListener('change', function () { var it = catalog[kind].filter(function (x) { return x.id === i.getAttribute('data-sl-avail'); })[0]; if (it) { it.available = i.checked; persist(); render(currentSection); } });
    });
    Array.prototype.forEach.call(c.querySelectorAll('[data-sl-del]'), function (b) {
      b.addEventListener('click', function () {
        if (!confirm('Supprimer cet élément ?')) return;
        catalog[kind] = catalog[kind].filter(function (x) { return x.id !== b.getAttribute('data-sl-del'); });
        persist(); render(currentSection); toast('Supprimé');
      });
    });
    el('addSl').addEventListener('click', function () {
      var name = el('newSl').value.trim(); if (!name) { toast('Nom requis', 'err'); return; }
      catalog[kind].push({ id: M.uid('s'), name: name, available: true });
      persist(); render(currentSection); toast('Ajouté');
    });
  }

  /* =====================================================================
     CRUDITÉS
     ===================================================================== */
  function viewCrudites() {
    var rows = catalog.crudites.map(function (it) {
      return '<tr>' +
        '<td><input class="mini-input" data-cr-name="' + it.id + '" value="' + esc(it.name) + '"></td>' +
        '<td><span class="switch"><input type="checkbox" data-cr-avail="' + it.id + '" ' + (it.available ? 'checked' : '') + '><span class="slider"></span></span></td>' +
        '<td><span class="switch"><input type="checkbox" data-cr-def="' + it.id + '" ' + (it.defaultOn !== false ? 'checked' : '') + '><span class="slider"></span></span></td>' +
        '<td><button class="link-danger" data-cr-del="' + it.id + '">Supprimer</button></td>' +
      '</tr>';
    }).join('');
    return '' +
      '<div class="adm-card"><h3>Crudités</h3><p style="color:var(--muted);font-size:14px;margin-top:0">Le client peut mettre « Avec » ou « Sans » chaque crudité. « Inclus par défaut » définit l\'état de départ.</p>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Nom</th><th>Disponible</th><th>Inclus par défaut</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="adm-card"><h3>Ajouter une crudité</h3><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">' +
        '<div class="field" style="margin:0;flex:1;min-width:180px"><label>Nom</label><input class="input" id="newCr" placeholder="Ex. Cornichons"></div>' +
        '<button class="btn btn--red" id="addCr">+ Ajouter</button></div></div>';
  }
  function bindCrudites() {
    var c = el('admContent');
    Array.prototype.forEach.call(c.querySelectorAll('[data-cr-name]'), function (i) { i.addEventListener('change', function () { setCrud(i.getAttribute('data-cr-name'), 'name', i.value.trim()); }); });
    Array.prototype.forEach.call(c.querySelectorAll('[data-cr-avail]'), function (i) { i.addEventListener('change', function () { setCrud(i.getAttribute('data-cr-avail'), 'available', i.checked); }); });
    Array.prototype.forEach.call(c.querySelectorAll('[data-cr-def]'), function (i) { i.addEventListener('change', function () { setCrud(i.getAttribute('data-cr-def'), 'defaultOn', i.checked); }); });
    Array.prototype.forEach.call(c.querySelectorAll('[data-cr-del]'), function (b) {
      b.addEventListener('click', function () {
        if (!confirm('Supprimer cette crudité ?')) return;
        catalog.crudites = catalog.crudites.filter(function (x) { return x.id !== b.getAttribute('data-cr-del'); });
        persist(); render('crudites'); toast('Supprimée');
      });
    });
    el('addCr').addEventListener('click', function () {
      var name = el('newCr').value.trim(); if (!name) { toast('Nom requis', 'err'); return; }
      catalog.crudites.push({ id: M.uid('c'), name: name, available: true, defaultOn: true });
      persist(); render('crudites'); toast('Ajoutée');
    });
  }
  function setCrud(id, key, val) { var it = catalog.crudites.filter(function (x) { return x.id === id; })[0]; if (it) { it[key] = val; persist(); } }

  /* =====================================================================
     PROMOTIONS
     ===================================================================== */
  function viewPromos() {
    var rows = catalog.promos.map(function (pr) {
      return '<tr>' +
        '<td><input class="mini-input" data-pr-code="' + pr.id + '" value="' + esc(pr.code) + '" style="text-transform:uppercase"></td>' +
        '<td><select class="mini-input" data-pr-type="' + pr.id + '"><option value="percent" ' + (pr.type === 'percent' ? 'selected' : '') + '>%</option><option value="amount" ' + (pr.type === 'amount' ? 'selected' : '') + '>€</option></select></td>' +
        '<td><input class="mini-input" style="width:80px" type="number" step="0.5" data-pr-val="' + pr.id + '" value="' + esc(pr.value) + '"></td>' +
        '<td><input class="mini-input" data-pr-desc="' + pr.id + '" value="' + esc(pr.description || '') + '"></td>' +
        '<td><span class="switch"><input type="checkbox" data-pr-active="' + pr.id + '" ' + (pr.active ? 'checked' : '') + '><span class="slider"></span></span></td>' +
        '<td><button class="link-danger" data-pr-del="' + pr.id + '">Suppr.</button></td>' +
      '</tr>';
    }).join('');
    return '' +
      '<div class="adm-card"><h3>🎁 Fidélité automatique -' + catalog.settings.loyaltyDiscountPercent + '%</h3>' +
        '<p style="color:var(--muted);font-size:14px;margin:0">La réduction fidélité de <b>-' + catalog.settings.loyaltyDiscountPercent + '%</b> est gérée automatiquement : elle s\'active <b>' + catalog.settings.loyaltyDelayHours + ' h</b> après la 1ʳᵉ commande d\'un client inscrit. Réglable dans <b>Réglages → Fidélité</b>.</p></div>' +
      '<div class="adm-card"><h3>Codes de réduction</h3>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Code</th><th>Type</th><th>Valeur</th><th>Description</th><th>Actif</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="adm-card"><h3>Ajouter un code</h3><div class="adm-row" style="grid-template-columns:1fr 1fr 1fr">' +
        '<div class="field" style="margin:0"><label>Code</label><input class="input" id="newPrCode" placeholder="ETE2025"></div>' +
        '<div class="field" style="margin:0"><label>Type</label><select class="select" id="newPrType"><option value="percent">Pourcentage %</option><option value="amount">Montant €</option></select></div>' +
        '<div class="field" style="margin:0"><label>Valeur</label><input class="input" id="newPrVal" type="number" step="0.5" value="10"></div>' +
      '</div><button class="btn btn--red" id="addPr" style="margin-top:8px">+ Ajouter</button></div>';
  }
  function bindPromos() {
    var c = el('admContent');
    function setPr(id, key, val) { var pr = catalog.promos.filter(function (x) { return x.id === id; })[0]; if (pr) { pr[key] = val; persist(); } }
    Array.prototype.forEach.call(c.querySelectorAll('[data-pr-code]'), function (i) { i.addEventListener('change', function () { setPr(i.getAttribute('data-pr-code'), 'code', i.value.trim().toUpperCase()); }); });
    Array.prototype.forEach.call(c.querySelectorAll('[data-pr-type]'), function (i) { i.addEventListener('change', function () { setPr(i.getAttribute('data-pr-type'), 'type', i.value); }); });
    Array.prototype.forEach.call(c.querySelectorAll('[data-pr-val]'), function (i) { i.addEventListener('change', function () { setPr(i.getAttribute('data-pr-val'), 'value', num(i.value, 0)); }); });
    Array.prototype.forEach.call(c.querySelectorAll('[data-pr-desc]'), function (i) { i.addEventListener('change', function () { setPr(i.getAttribute('data-pr-desc'), 'description', i.value.trim()); }); });
    Array.prototype.forEach.call(c.querySelectorAll('[data-pr-active]'), function (i) { i.addEventListener('change', function () { setPr(i.getAttribute('data-pr-active'), 'active', i.checked); }); });
    Array.prototype.forEach.call(c.querySelectorAll('[data-pr-del]'), function (b) {
      b.addEventListener('click', function () { if (!confirm('Supprimer ce code ?')) return; catalog.promos = catalog.promos.filter(function (x) { return x.id !== b.getAttribute('data-pr-del'); }); persist(); render('promos'); });
    });
    el('addPr').addEventListener('click', function () {
      var code = el('newPrCode').value.trim().toUpperCase(); if (!code) { toast('Code requis', 'err'); return; }
      catalog.promos.push({ id: M.uid('promo'), code: code, type: el('newPrType').value, value: num(el('newPrVal').value, 0), active: true, description: '' });
      persist(); render('promos'); toast('Code ajouté');
    });
  }

  /* =====================================================================
     CLIENTS
     ===================================================================== */
  function viewCustomers() {
    var list = M.getCustomers();
    if (!list.length) return '<div class="adm-card" style="text-align:center;color:var(--muted)">Aucun client inscrit pour le moment.</div>';
    var rows = list.slice().reverse().map(function (cu) {
      var st = M.loyaltyStatus(cu, catalog.settings);
      var loy = st.used ? '<span class="pill pill--muted">Utilisée</span>'
        : st.eligible ? '<span class="pill pill--ok">-' + catalog.settings.loyaltyDiscountPercent + '% dispo</span>'
        : st.availableAt ? '<span class="pill pill--gold">le ' + new Date(st.availableAt).toLocaleDateString('fr-FR') + '</span>'
        : '<span class="pill pill--muted">en attente</span>';
      return '<tr>' +
        '<td><b>' + esc(cu.firstName || '') + ' ' + esc(cu.lastName || '') + '</b></td>' +
        '<td>' + esc(cu.email || '') + '<br><span class="sub" style="color:var(--muted)">' + esc(cu.phone || '') + '</span></td>' +
        '<td>' + (cu.orderCount || 0) + '</td>' +
        '<td>' + (cu.newsletter ? '📧 Oui' : '—') + '</td>' +
        '<td>' + loy + '</td>' +
        '<td class="actions">' +
          (st.used ? '<button class="btn btn--ghost btn--sm" data-reset-loy="' + esc(cu.email) + '">Réactiver -10%</button>' : '') +
          '<button class="link-danger" data-del-cust="' + esc(cu.email) + '">Suppr.</button>' +
        '</td>' +
      '</tr>';
    }).join('');
    return '<div class="adm-card"><h3>Comptes clients (' + list.length + ')</h3><div class="table-wrap"><table class="table">' +
      '<thead><tr><th>Nom</th><th>Contact</th><th>Cmd</th><th>News.</th><th>Fidélité -10%</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
  }
  function bindCustomers() {
    var c = el('admContent');
    Array.prototype.forEach.call(c.querySelectorAll('[data-del-cust]'), function (b) {
      b.addEventListener('click', function () {
        if (!confirm('Supprimer ce client ?')) return;
        var email = b.getAttribute('data-del-cust');
        M.saveCustomers(M.getCustomers().filter(function (x) { return x.email !== email; }));
        render('customers'); toast('Client supprimé');
      });
    });
    Array.prototype.forEach.call(c.querySelectorAll('[data-reset-loy]'), function (b) {
      b.addEventListener('click', function () {
        var cu = M.findCustomerByEmail(b.getAttribute('data-reset-loy'));
        if (cu) { cu.loyaltyUsed = false; cu.firstOrderAt = new Date(Date.now() - (catalog.settings.loyaltyDelayHours * 3600 * 1000 + 60000)).toISOString(); M.upsertCustomer(cu); render('customers'); toast('Réduction réactivée'); }
      });
    });
  }

  /* =====================================================================
     NEWSLETTER
     ===================================================================== */
  function viewNewsletter() {
    var list = M.getNewsletter();
    var active = list.filter(function (n) { return n.active; });
    var rows = list.slice().reverse().map(function (n) {
      return '<tr><td>' + esc(n.email) + '</td><td>' + esc(n.name || '') + '</td><td>' + new Date(n.date).toLocaleDateString('fr-FR') + '</td>' +
        '<td>' + (n.active ? '<span class="pill pill--ok">Actif</span>' : '<span class="pill pill--muted">Désinscrit</span>') + '</td>' +
        '<td><button class="link-danger" data-del-news="' + esc(n.email) + '">Suppr.</button></td></tr>';
    }).join('') || '<tr><td colspan="5" style="color:var(--muted)">Aucun abonné.</td></tr>';
    return '' +
      '<div class="adm-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
        '<div><h3 style="margin:0">Abonnés newsletter</h3><p style="color:var(--muted);margin:0;font-size:14px">' + active.length + ' abonné(s) actif(s) sur ' + list.length + '.</p></div>' +
        '<button class="btn btn--red btn--sm" id="exportNews">⬇️ Exporter (CSV)</button>' +
      '</div>' +
      '<div class="adm-card"><div class="table-wrap"><table class="table"><thead><tr><th>E-mail</th><th>Nom</th><th>Date</th><th>Statut</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="adm-card"><h3>Ajouter un e-mail</h3><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end">' +
        '<div class="field" style="margin:0;flex:1;min-width:200px"><label>E-mail</label><input class="input" id="newNews" placeholder="client@email.fr"></div>' +
        '<button class="btn btn--red" id="addNews">+ Ajouter</button></div></div>';
  }
  function bindNewsletter() {
    var c = el('admContent');
    Array.prototype.forEach.call(c.querySelectorAll('[data-del-news]'), function (b) {
      b.addEventListener('click', function () {
        if (!confirm('Supprimer cet abonné ?')) return;
        M.saveNewsletter(M.getNewsletter().filter(function (n) { return n.email !== b.getAttribute('data-del-news'); }));
        render('newsletter');
      });
    });
    el('addNews').addEventListener('click', function () {
      var email = el('newNews').value.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('E-mail invalide', 'err'); return; }
      M.addNewsletter({ email: email }); render('newsletter'); toast('Abonné ajouté');
    });
    el('exportNews').addEventListener('click', function () {
      var list = M.getNewsletter().filter(function (n) { return n.active; });
      var csv = 'email,nom,date\n' + list.map(function (n) { return '"' + n.email + '","' + (n.name || '') + '","' + n.date + '"'; }).join('\n');
      downloadFile('newsletter-mykonos.csv', csv, 'text/csv');
    });
  }

  /* =====================================================================
     RÉGLAGES
     ===================================================================== */
  function viewSettings() {
    var s = catalog.settings;
    return '' +
      '<div class="adm-card"><h3>🏪 Informations du restaurant</h3>' +
        row2(field('Nom', 'setName', s.restaurantName), field('Slogan', 'setSlogan', s.slogan)) +
        row2(field('Téléphone', 'setPhone', s.phone), field('E-mail', 'setEmail', s.email)) +
        field('Adresse', 'setAddress', s.address) +
        field('Horaires', 'setHours', s.hours) +
      '</div>' +

      '<div class="adm-card"><h3>🔐 Accès administrateur</h3>' +
        field('Code d\'accès admin', 'setCode', s.adminCode) +
        '<p style="font-size:12px;color:var(--muted)">Modifiez ce code pour sécuriser l\'accès à cette page.</p>' +
      '</div>' +

      '<div class="adm-card"><h3>🍟 Offre Menu +1€</h3>' +
        '<label class="check" style="margin-bottom:12px"><span class="switch"><input type="checkbox" id="setMenuEnabled" ' + (s.menuUpgradeEnabled ? 'checked' : '') + '><span class="slider"></span></span> Activer l\'offre menu</label>' +
        row2(field('Prix du passage en menu (€)', 'setMenuPrice', s.menuUpgradePrice, 'number'), field('Texte de l\'offre', 'setMenuLabel', s.menuUpgradeLabel)) +
      '</div>' +

      '<div class="adm-card"><h3>🎁 Fidélité (-10%)</h3>' +
        '<label class="check" style="margin-bottom:12px"><span class="switch"><input type="checkbox" id="setLoyEnabled" ' + (s.loyaltyEnabled ? 'checked' : '') + '><span class="slider"></span></span> Activer la fidélité</label>' +
        row2(field('Réduction (%)', 'setLoyPct', s.loyaltyDiscountPercent, 'number'), field('Délai avant activation (heures)', 'setLoyDelay', s.loyaltyDelayHours, 'number')) +
        '<p style="font-size:12px;color:var(--muted)">Exemple : 24 h = la réduction est utilisable 24 heures après la 1ʳᵉ commande.</p>' +
      '</div>' +

      '<div class="adm-card"><h3>🛵 Retrait / Livraison</h3>' +
        row2(field('Modes (séparés par une virgule)', 'setFulfill', (s.fulfillment || []).join(', ')), field('Frais de livraison (€)', 'setDelivery', s.deliveryFee, 'number')) +
      '</div>' +

      '<div class="adm-card"><h3>📧 E-mails automatiques (EmailJS)</h3>' +
        '<label class="check" style="margin-bottom:12px"><span class="switch"><input type="checkbox" id="setEmailEnabled" ' + (s.email_enabled ? 'checked' : '') + '><span class="slider"></span></span> Activer l\'envoi automatique d\'e-mails</label>' +
        '<p style="font-size:13px;color:var(--muted);margin-top:0">Créez un compte gratuit sur <b>emailjs.com</b>, puis collez vos identifiants ci-dessous. Le client reçoit une confirmation, et vous recevez chaque commande par e-mail. Sans configuration, les commandes restent visibles dans « Commandes ».</p>' +
        row2(field('Clé publique (Public Key)', 'setEjKey', s.emailjs_publicKey), field('Service ID', 'setEjService', s.emailjs_serviceId)) +
        row2(field('Template ID — client', 'setEjTplClient', s.emailjs_templateClient), field('Template ID — admin', 'setEjTplAdmin', s.emailjs_templateAdmin)) +
        field('E-mail de réception des commandes (admin)', 'setEjAdminEmail', s.admin_notify_email) +
        '<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700">Variables disponibles pour vos templates</summary>' +
          '<p style="font-size:12.5px;color:var(--muted)">{{order_number}}, {{first_name}}, {{customer_name}}, {{customer_email}}, {{customer_phone}}, {{items}}, {{subtotal}}, {{discount}}, {{delivery}}, {{total}}, {{fulfillment}}, {{address}}, {{wanted}}, {{note}}, {{restaurant_name}}, {{restaurant_phone}}, {{restaurant_address}}</p></details>' +
        '<button class="btn btn--ghost btn--sm" id="testEmail" style="margin-top:8px">✉️ Envoyer un e-mail de test</button>' +
      '</div>' +

      '<div class="adm-card"><h3>💾 Données &amp; sauvegarde</h3>' +
        '<p style="color:var(--muted);font-size:14px;margin-top:0">Exportez régulièrement une sauvegarde de votre catalogue (produits, prix, réglages…). Vous pouvez la réimporter à tout moment.</p>' +
        '<div class="img-actions">' +
          '<button class="btn btn--red btn--sm" id="exportCatalog">⬇️ Exporter la sauvegarde</button>' +
          '<label class="btn btn--ghost btn--sm">⬆️ Importer<input type="file" id="importCatalog" accept="application/json" hidden></label>' +
          '<button class="btn btn--ghost btn--sm" id="resetCatalog" style="color:var(--red)">♻️ Réinitialiser le catalogue</button>' +
        '</div>' +
      '</div>' +
      '<div style="text-align:right"><button class="btn btn--red btn--lg" id="saveSettings">💾 Enregistrer les réglages</button></div>';
  }
  function field(label, id, val, type) {
    return '<div class="field"><label>' + esc(label) + '</label><input class="input" id="' + id + '" type="' + (type || 'text') + '" ' + (type === 'number' ? 'step="0.1"' : '') + ' value="' + esc(val == null ? '' : val) + '"></div>';
  }
  function row2(a, b) { return '<div class="grid-2">' + a + b + '</div>'; }

  function bindSettings() {
    el('saveSettings').addEventListener('click', function () {
      var s = catalog.settings;
      s.restaurantName = el('setName').value.trim();
      s.slogan = el('setSlogan').value.trim();
      s.phone = el('setPhone').value.trim();
      s.email = el('setEmail').value.trim();
      s.address = el('setAddress').value.trim();
      s.hours = el('setHours').value.trim();
      s.adminCode = el('setCode').value.trim() || '1305';
      s.menuUpgradeEnabled = el('setMenuEnabled').checked;
      s.menuUpgradePrice = num(el('setMenuPrice').value, 1);
      s.menuUpgradeLabel = el('setMenuLabel').value.trim();
      s.loyaltyEnabled = el('setLoyEnabled').checked;
      s.loyaltyDiscountPercent = num(el('setLoyPct').value, 10);
      s.loyaltyDelayHours = num(el('setLoyDelay').value, 24);
      s.fulfillment = el('setFulfill').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      s.deliveryFee = num(el('setDelivery').value, 0);
      s.email_enabled = el('setEmailEnabled').checked;
      s.emailjs_publicKey = el('setEjKey').value.trim();
      s.emailjs_serviceId = el('setEjService').value.trim();
      s.emailjs_templateClient = el('setEjTplClient').value.trim();
      s.emailjs_templateAdmin = el('setEjTplAdmin').value.trim();
      s.admin_notify_email = el('setEjAdminEmail').value.trim();
      persist(); toast('Réglages enregistrés ✓');
    });

    el('testEmail').addEventListener('click', function () {
      var s = catalog.settings;
      if (!window.emailjs) { toast('Librairie e-mail non chargée', 'err'); return; }
      if (!s.emailjs_publicKey || !s.emailjs_serviceId || !s.emailjs_templateAdmin) { toast('Renseignez d\'abord la clé, le service et le template admin, puis Enregistrez.', 'err'); return; }
      try {
        window.emailjs.init({ publicKey: s.emailjs_publicKey });
        window.emailjs.send(s.emailjs_serviceId, s.emailjs_templateAdmin, {
          order_number: 'TEST', first_name: 'Test', customer_name: 'Test Mykonos', items: '• 1× Kebab (test)',
          total: '9,99 €', fulfillment: 'À emporter', wanted: 'maintenant', restaurant_name: s.restaurantName,
          to_email: s.admin_notify_email || s.email, customer_email: s.admin_notify_email || s.email
        }).then(function () { toast('E-mail de test envoyé ✓'); }).catch(function (e) { toast('Échec : ' + (e && e.text ? e.text : 'vérifiez vos identifiants'), 'err'); });
      } catch (e) { toast('Erreur EmailJS', 'err'); }
    });

    el('exportCatalog').addEventListener('click', function () {
      var data = { catalog: M.getCatalog(), exportedAt: new Date().toISOString() };
      downloadFile('mykonos-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(data, null, 2), 'application/json');
      toast('Sauvegarde téléchargée');
    });
    el('importCatalog').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function (e) {
        try {
          var parsed = JSON.parse(e.target.result);
          var cat = parsed.catalog || parsed;
          if (!cat.settings || !cat.products) throw new Error('format');
          if (!confirm('Importer cette sauvegarde ? Le catalogue actuel sera remplacé.')) return;
          M.saveCatalog(cat); catalog = M.getCatalog(); render('settings'); toast('Sauvegarde importée ✓');
        } catch (err) { toast('Fichier invalide', 'err'); }
      };
      r.readAsText(f);
    });
    el('resetCatalog').addEventListener('click', function () {
      if (!confirm('Réinitialiser TOUT le catalogue aux valeurs par défaut ? (les commandes et clients sont conservés)')) return;
      catalog = M.resetCatalog(); render('settings'); toast('Catalogue réinitialisé');
    });
  }

  function downloadFile(name, content, type) {
    var blob = new Blob([content], { type: type || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 500);
  }

  /* =====================================================================
     BIND GLOBAL / INIT
     ===================================================================== */
  function bindGlobal() {
    el('admLoginBtn').addEventListener('click', tryLogin);
    el('admCode').addEventListener('keydown', function (e) { if (e.key === 'Enter') tryLogin(); });
    el('admLogout').addEventListener('click', logout);
    el('admMenuToggle').addEventListener('click', function () { el('admSide').classList.toggle('show'); el('admOverlay').classList.toggle('show'); });
    el('admOverlay').addEventListener('click', function () { el('admSide').classList.remove('show'); el('admOverlay').classList.remove('show'); });
    el('admModalBackdrop').addEventListener('click', closeModal);
    Array.prototype.forEach.call(el('admNav').querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () { render(b.getAttribute('data-sec')); });
    });
    // Bouton alerte sonore (active/coupe + test + demande de notification)
    var sb = el('admSoundToggle');
    if (sb) sb.addEventListener('click', function () {
      var willEnable = !soundEnabled();
      setSoundEnabled(willEnable);
      updateSoundBtn();
      if (willEnable) {
        getAudio(); playChirp();
        if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) {} }
        toast('Alerte sonore activée 🔔', 'ok');
      } else { toast('Alerte sonore coupée 🔕', 'info'); }
    });
    // Débloque l'audio dès la première interaction (politique navigateur)
    document.addEventListener('click', function unlock() { getAudio(); document.removeEventListener('click', unlock); });
    // rafraîchir commandes/clients si modifiés depuis un autre onglet (ex. client qui commande)
    window.addEventListener('storage', function (e) {
      if (!isAuthed()) return;
      if (e.key === M.KEYS.orders && (currentSection === 'orders' || currentSection === 'dashboard')) render(currentSection);
      if (e.key === M.KEYS.customers && currentSection === 'customers') render('customers');
      if (e.key === M.KEYS.newsletter && currentSection === 'newsletter') render('newsletter');
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  }

  function init() {
    bindGlobal();
    if (isAuthed()) showApp(); else el('admCode').focus();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
