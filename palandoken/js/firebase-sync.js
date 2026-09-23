/* ============================================================================
   PALANDÖKEN 25 – Synchronisation temps réel (firebase-sync.js)
   ----------------------------------------------------------------------------
   Couche de synchronisation posée PAR-DESSUS le store local (data.js), basée
   sur Firebase **Realtime Database**.
   Objectif :
     • Commandes : le client écrit → l'admin les reçoit EN DIRECT (n'importe
       quel appareil) → déclenche le son 🐦.
     • Catalogue : l'admin écrit → TOUS les clients voient les changements.
     • Clients / newsletter : le client écrit → l'admin voit tout.

   Robustesse : sans SDK / config / base → NE FAIT RIEN, le site continue en
   localStorage. Les lectures de données perso sont réservées à la page admin.
   ==========================================================================*/
(function () {
  'use strict';

  var cfg = window.PALANDOKEN_FIREBASE;
  var M = window.PALANDOKEN;

  if (!M) return;
  if (!cfg || !cfg.apiKey || !cfg.databaseURL ||
      typeof firebase === 'undefined' || !firebase.initializeApp) {
    return; // mode local uniquement
  }

  var db;
  try {
    firebase.initializeApp(cfg);
    db = firebase.database();
  } catch (e) {
    console.warn('[PALANDOKEN] Firebase indisponible, mode local.', e);
    return;
  }

  var isAdmin = !!document.getElementById('admApp'); // vrai seulement sur admin.html
  var applyingRemote = false, firstOrders = true;

  // Toutes les données de Palandöken 25 sont rangées sous « palandoken/ » afin
  // de partager le projet Firebase de MYKONOS sans jamais mélanger les données.
  var NS = 'palandoken/';
  function nref(p) { return db.ref(NS + p); }

  function withRemote(fn) { applyingRemote = true; try { fn(); } finally { applyingRemote = false; } }
  function clean(obj) { try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; } }
  // Clé Realtime DB : interdits . # $ [ ] / → on ne garde que a-z 0-9 _ -
  function key(email) { return String(email || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') || '_'; }
  function safe(fn) { try { fn(); } catch (e) { console.warn('[PALANDOKEN] sync', e); } }
  function toList(val) { var out = []; if (val) Object.keys(val).forEach(function (k) { if (val[k]) out.push(val[k]); }); return out; }

  /* -------- 1) Écritures locales → Realtime Database -------- */
  var _addOrder = M.addOrder;
  M.addOrder = function (order) {
    var r = _addOrder(order);
    if (!applyingRemote && order && order.id) safe(function () { nref('orders/' + order.id).set(clean(order)); });
    return r;
  };
  var _updateOrder = M.updateOrder;
  M.updateOrder = function (id, patch) {
    var r = _updateOrder(id, patch);
    if (!applyingRemote && id) safe(function () { nref('orders/' + id).update(clean(patch)); });
    return r;
  };
  var _saveOrders = M.saveOrders;
  M.saveOrders = function (list) {
    var prev = M.getOrders();
    var r = _saveOrders(list);
    if (!applyingRemote) safe(function () {
      var ids = {}; (list || []).forEach(function (o) { ids[o.id] = 1; });
      prev.forEach(function (o) { if (o && o.id && !ids[o.id]) nref('orders/' + o.id).remove(); });
    });
    return r;
  };

  function pushCatalog(cat) {
    var json; try { json = JSON.stringify(cat); } catch (e) { return; }
    if (json.length > 900000) { console.warn('[PALANDOKEN] Catalogue trop volumineux (images ?). Reste en local.'); return; }
    safe(function () { nref('config/catalog').set(JSON.parse(json)); });
  }
  var _saveCatalog = M.saveCatalog;
  M.saveCatalog = function (cat) { var r = _saveCatalog(cat); if (!applyingRemote) pushCatalog(cat); return r; };
  var _resetCatalog = M.resetCatalog;
  M.resetCatalog = function () { var r = _resetCatalog(); if (!applyingRemote) pushCatalog(r); return r; };

  var _upsertCustomer = M.upsertCustomer;
  M.upsertCustomer = function (c) {
    var r = _upsertCustomer(c);
    if (!applyingRemote && c && c.email) safe(function () { nref('customers/' + key(c.email)).update(clean(c)); });
    return r;
  };
  var _saveCustomers = M.saveCustomers;
  M.saveCustomers = function (list) {
    var prev = M.getCustomers();
    var r = _saveCustomers(list);
    if (!applyingRemote) safe(function () {
      var keys = {}; (list || []).forEach(function (c) { keys[key(c.email)] = 1; });
      prev.forEach(function (c) { if (c && c.email && !keys[key(c.email)]) nref('customers/' + key(c.email)).remove(); });
    });
    return r;
  };

  var _addNewsletter = M.addNewsletter;
  M.addNewsletter = function (entry) {
    var r = _addNewsletter(entry);
    if (!applyingRemote && entry && entry.email) safe(function () {
      nref('newsletter/' + key(entry.email)).update(clean({
        email: String(entry.email).trim().toLowerCase(), name: entry.name || '',
        date: new Date().toISOString(), active: true
      }));
    });
    return r;
  };
  var _saveNewsletter = M.saveNewsletter;
  M.saveNewsletter = function (list) {
    var prev = M.getNewsletter();
    var r = _saveNewsletter(list);
    if (!applyingRemote) safe(function () {
      var keys = {}; (list || []).forEach(function (n) { keys[key(n.email)] = 1; });
      prev.forEach(function (n) { if (n && n.email && !keys[key(n.email)]) nref('newsletter/' + key(n.email)).remove(); });
    });
    return r;
  };

  /* -------- 2) Écoutes temps réel (Realtime Database → store local) -------- */
  nref('config/catalog').on('value', function (snap) {
    if (snap.exists()) {
      var cat = snap.val();
      withRemote(function () { try { localStorage.setItem(M.KEYS.catalog, JSON.stringify(cat)); } catch (e) {} });
      try { window.dispatchEvent(new CustomEvent('palandoken:catalog-updated')); } catch (e) {}
    } else if (isAdmin) {
      pushCatalog(M.getCatalog()); // amorçage initial par l'admin
    }
  }, function (err) { console.warn('[PALANDOKEN] catalog', err); });

  if (isAdmin) {
    nref('orders').limitToLast(300).on('value', function (snap) {
      var orders = toList(snap.val());
      orders.sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
      withRemote(function () { M.saveOrders(orders); });
      if (firstOrders) { firstOrders = false; if (window.PALANDOKEN_syncOrderBaseline) window.PALANDOKEN_syncOrderBaseline(); }
      try { window.dispatchEvent(new CustomEvent('palandoken:orders-updated')); } catch (e) {}
    }, function (err) { console.warn('[PALANDOKEN] orders', err); });

    nref('customers').on('value', function (snap) {
      withRemote(function () { M.saveCustomers(toList(snap.val())); });
      try { window.dispatchEvent(new CustomEvent('palandoken:customers-updated')); } catch (e) {}
    }, function (err) { console.warn('[PALANDOKEN] customers', err); });

    nref('newsletter').on('value', function (snap) {
      withRemote(function () { M.saveNewsletter(toList(snap.val())); });
      try { window.dispatchEvent(new CustomEvent('palandoken:newsletter-updated')); } catch (e) {}
    }, function (err) { console.warn('[PALANDOKEN] newsletter', err); });
  }

  window.PALANDOKEN_FB = { ready: true, db: db, isAdmin: isAdmin };
  try { window.dispatchEvent(new CustomEvent('palandoken:fb-ready')); } catch (e) {}
  console.log('[PALANDOKEN] Firebase (Realtime Database) connecté ✓ — temps réel actif');
})();
