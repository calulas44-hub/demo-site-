/* ============================================================================
   MYKONOS – Synchronisation temps réel (firebase-sync.js)
   ----------------------------------------------------------------------------
   Couche de synchronisation posée PAR-DESSUS le store local (data.js).
   Objectif :
     • Commandes : le client écrit dans Firestore → l'admin les reçoit EN DIRECT
       (depuis n'importe quel appareil) → déclenche le son 🐦.
     • Catalogue : l'admin écrit → TOUS les clients voient les changements (prix…).
     • Clients / newsletter : le client écrit → l'admin voit tout.

   Sécurité / robustesse :
     • Si le SDK Firebase n'est pas chargé ou la config absente → NE FAIT RIEN,
       le site continue de fonctionner en localStorage (aucune régression).
     • Les lectures de commandes/clients (données personnelles) sont réservées à
       la page admin ; les pages client n'y accèdent jamais.
   ==========================================================================*/
(function () {
  'use strict';

  var cfg = window.MYKONOS_FIREBASE;
  var M = window.MYKONOS;

  // Garde-fou : sans SDK, sans config, ou sans store → mode local uniquement.
  if (!M) return;
  if (!cfg || !cfg.apiKey || typeof firebase === 'undefined' || !firebase.initializeApp) {
    return;
  }

  var db;
  try {
    firebase.initializeApp(cfg);
    db = firebase.firestore();
  } catch (e) {
    console.warn('[MYKONOS] Firebase indisponible, mode local.', e);
    return;
  }

  var isAdmin = !!document.getElementById('admApp'); // vrai uniquement sur admin.html
  var applyingRemote = false;                        // évite les boucles d'écriture
  var firstOrders = true;

  function withRemote(fn) { applyingRemote = true; try { fn(); } finally { applyingRemote = false; } }
  function clean(obj) { try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; } }
  function emailKey(email) { return String(email || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_') || '_'; }
  function safe(fn) { try { fn(); } catch (e) { console.warn('[MYKONOS] sync', e); } }

  var ORDERS = 'orders', CUSTOMERS = 'customers', NEWSLETTER = 'newsletter', CONFIG = 'config';

  /* -------------------------------------------------------------------------
     1) On décore les fonctions d'écriture du store pour pousser vers Firestore
     ------------------------------------------------------------------------- */
  var _addOrder = M.addOrder;
  M.addOrder = function (order) {
    var r = _addOrder(order);
    if (!applyingRemote && order && order.id) safe(function () { db.collection(ORDERS).doc(order.id).set(clean(order)); });
    return r;
  };

  var _updateOrder = M.updateOrder;
  M.updateOrder = function (id, patch) {
    var r = _updateOrder(id, patch);
    if (!applyingRemote && id) safe(function () { db.collection(ORDERS).doc(id).set(clean(patch), { merge: true }); });
    return r;
  };

  var _saveOrders = M.saveOrders;
  M.saveOrders = function (list) {
    var prev = M.getOrders();
    var r = _saveOrders(list);
    if (!applyingRemote) safe(function () {
      var ids = {}; (list || []).forEach(function (o) { ids[o.id] = 1; });
      prev.forEach(function (o) { if (o && o.id && !ids[o.id]) db.collection(ORDERS).doc(o.id).delete(); });
    });
    return r;
  };

  function pushCatalog(cat) {
    var json;
    try { json = JSON.stringify(cat); } catch (e) { return; }
    // Firestore limite un document à ~1 Mo. On évite un échec silencieux
    // si le catalogue contient de grosses images en base64.
    if (json.length > 900000) {
      console.warn('[MYKONOS] Catalogue trop volumineux pour la sync temps réel (images ?). Reste en local.');
      return;
    }
    safe(function () { db.collection(CONFIG).doc('catalog').set(JSON.parse(json)); });
  }
  var _saveCatalog = M.saveCatalog;
  M.saveCatalog = function (cat) {
    var r = _saveCatalog(cat);
    if (!applyingRemote) pushCatalog(cat);
    return r;
  };
  var _resetCatalog = M.resetCatalog;
  M.resetCatalog = function () {
    var r = _resetCatalog();
    if (!applyingRemote) pushCatalog(r);
    return r;
  };

  var _upsertCustomer = M.upsertCustomer;
  M.upsertCustomer = function (c) {
    var r = _upsertCustomer(c);
    if (!applyingRemote && c && c.email) safe(function () { db.collection(CUSTOMERS).doc(emailKey(c.email)).set(clean(c), { merge: true }); });
    return r;
  };
  var _saveCustomers = M.saveCustomers;
  M.saveCustomers = function (list) {
    var prev = M.getCustomers();
    var r = _saveCustomers(list);
    if (!applyingRemote) safe(function () {
      var keys = {}; (list || []).forEach(function (c) { keys[emailKey(c.email)] = 1; });
      prev.forEach(function (c) { if (c && c.email && !keys[emailKey(c.email)]) db.collection(CUSTOMERS).doc(emailKey(c.email)).delete(); });
    });
    return r;
  };

  var _addNewsletter = M.addNewsletter;
  M.addNewsletter = function (entry) {
    var r = _addNewsletter(entry);
    if (!applyingRemote && entry && entry.email) safe(function () {
      db.collection(NEWSLETTER).doc(emailKey(entry.email)).set(clean({
        email: String(entry.email).trim().toLowerCase(), name: entry.name || '',
        date: new Date().toISOString(), active: true
      }), { merge: true });
    });
    return r;
  };
  var _saveNewsletter = M.saveNewsletter;
  M.saveNewsletter = function (list) {
    var prev = M.getNewsletter();
    var r = _saveNewsletter(list);
    if (!applyingRemote) safe(function () {
      var keys = {}; (list || []).forEach(function (n) { keys[emailKey(n.email)] = 1; });
      prev.forEach(function (n) { if (n && n.email && !keys[emailKey(n.email)]) db.collection(NEWSLETTER).doc(emailKey(n.email)).delete(); });
    });
    return r;
  };

  /* -------------------------------------------------------------------------
     2) Écoutes temps réel (Firestore → store local)
     ------------------------------------------------------------------------- */
  // Catalogue : tout le monde lit. L'admin sème le document s'il n'existe pas.
  db.collection(CONFIG).doc('catalog').onSnapshot(function (doc) {
    if (doc.exists) {
      var cat = doc.data();
      withRemote(function () {
        try { localStorage.setItem(M.KEYS.catalog, JSON.stringify(cat)); } catch (e) {}
      });
      try { window.dispatchEvent(new CustomEvent('mykonos:catalog-updated')); } catch (e) {}
    } else if (isAdmin) {
      pushCatalog(M.getCatalog()); // amorçage initial par l'admin
    }
  }, function (err) { console.warn('[MYKONOS] catalog snapshot', err); });

  // Commandes / clients / newsletter : réservés à la page admin (données perso).
  if (isAdmin) {
    db.collection(ORDERS).onSnapshot(function (snap) {
      var orders = [];
      snap.forEach(function (d) { orders.push(d.data()); });
      orders.sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
      withRemote(function () { M.saveOrders(orders); });
      if (firstOrders) { firstOrders = false; if (window.MYKONOS_syncOrderBaseline) window.MYKONOS_syncOrderBaseline(); }
      try { window.dispatchEvent(new CustomEvent('mykonos:orders-updated')); } catch (e) {}
    }, function (err) { console.warn('[MYKONOS] orders snapshot', err); });

    db.collection(CUSTOMERS).onSnapshot(function (snap) {
      var list = []; snap.forEach(function (d) { list.push(d.data()); });
      withRemote(function () { M.saveCustomers(list); });
      try { window.dispatchEvent(new CustomEvent('mykonos:customers-updated')); } catch (e) {}
    }, function (err) { console.warn('[MYKONOS] customers snapshot', err); });

    db.collection(NEWSLETTER).onSnapshot(function (snap) {
      var list = []; snap.forEach(function (d) { list.push(d.data()); });
      withRemote(function () { M.saveNewsletter(list); });
      try { window.dispatchEvent(new CustomEvent('mykonos:newsletter-updated')); } catch (e) {}
    }, function (err) { console.warn('[MYKONOS] newsletter snapshot', err); });
  }

  window.MYKONOS_FB = { ready: true, db: db, isAdmin: isAdmin };
  try { window.dispatchEvent(new CustomEvent('mykonos:fb-ready')); } catch (e) {}
  console.log('[MYKONOS] Firebase connecté ✓ (temps réel actif)');
})();
