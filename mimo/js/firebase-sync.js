/* ============================================================================
   MIMO – Synchronisation temps réel (firebase-sync.js)
   ----------------------------------------------------------------------------
   Posée PAR-DESSUS le store local (data.js), comme sur Mozaïk et MYKONOS, avec Firebase
   Realtime Database. Toutes les données sont rangées sous « mimo/ ».
     • Commandes : le client (téléphone, QR de table) écrit → l'admin les reçoit
       EN DIRECT sur n'importe quel appareil (son + notification).
     • Suivi : le client suit le statut de SA commande en direct.
     • Numéros de commande uniques entre appareils (transaction).
     • Carte / contenus : l'admin modifie → tous les clients voient la mise à jour.
     • Photos : stockées à part (mimo/media) pour garder la carte légère.
     • Clients / newsletter : visibles dans l'admin.
   Sans SDK / configuration / réseau → ne fait rien : le site reste en local.
   ==========================================================================*/
(function () {
  'use strict';

  var cfg = window.MIMO_FIREBASE;
  var M = window.MIMO;
  if (!M) return;
  if (!cfg || !cfg.apiKey || !cfg.databaseURL || typeof firebase === 'undefined' || !firebase.initializeApp) return;

  var db;
  try {
    var app = (firebase.apps && firebase.apps.length) ? firebase.app() : firebase.initializeApp(cfg);
    db = firebase.database(app);
  } catch (e) {
    console.warn('[MIMO] Firebase indisponible, mode local.', e);
    return;
  }

  var NS = 'mimo/';
  function nref(p) { return db.ref(NS + p); }
  var isAdmin = !!document.getElementById('admApp');
  var applyingRemote = false, firstOrders = true;

  function withRemote(fn) { applyingRemote = true; try { fn(); } finally { applyingRemote = false; } }
  function clean(obj) { try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; } }
  function key(email) { return String(email || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') || '_'; }
  function safe(fn) { try { return fn(); } catch (e) { console.warn('[MIMO] sync', e); } }
  function toList(val) { var out = []; if (val) Object.keys(val).forEach(function (k) { if (val[k]) out.push(val[k]); }); return out; }
  function emit(name, detail) { M.emit(name, detail); }

  /* -------- 1) Commandes -------- */
  var _addOrder = M.addOrder;
  M.addOrder = function (order, onSynced) {
    var r = _addOrder(order);
    if (!applyingRemote && order && order.id) {
      var settled = false;
      var timer = setTimeout(function () { if (!settled && onSynced) onSynced(false, 'timeout'); }, 9000);
      safe(function () {
        nref('orders/' + order.id).set(clean(order)).then(function () {
          settled = true; clearTimeout(timer); if (onSynced) onSynced(true);
        }).catch(function (err) {
          settled = true; clearTimeout(timer); console.warn('[MIMO] commande non transmise', err); if (onSynced) onSynced(false, err && err.message);
        });
      });
    }
    return r;
  };
  var _updateOrder = M.updateOrder;
  M.updateOrder = function (id, patch) {
    var r = _updateOrder(id, patch);
    if (!applyingRemote && id) safe(function () { nref('orders/' + id).update(clean(patch)); });
    return r;
  };
  var _deleteOrder = M.deleteOrder;
  M.deleteOrder = function (id) {
    _deleteOrder(id);
    if (id) safe(function () { nref('orders/' + id).remove(); });
  };

  // Numéro de commande unique pour tous les appareils
  M.allocateOrderNumber = function (cb) {
    var done = false;
    var timer = setTimeout(function () { if (!done) { done = true; cb(M.nextOrderNumber()); } }, 6000);
    safe(function () {
      nref('meta/orderSeq').transaction(function (cur) { return (Number(cur) || 1000) + 1; }, function (err, committed, snap) {
        if (done) return; done = true; clearTimeout(timer);
        cb((!err && committed && snap && snap.val()) ? snap.val() : M.nextOrderNumber());
      }, false);
    });
  };

  // Suivi en direct d'une commande (client)
  var _watchOrder = M.watchOrder;
  M.watchOrder = function (id, cb) {
    var ref = nref('orders/' + id), h;
    var fallbackStop = null;
    try {
      h = ref.on('value', function (snap) {
        var o = snap.val();
        if (o) withRemote(function () { M.mergeOrders([o]); });
        cb(o || M.findOrder(id));
      }, function () { fallbackStop = _watchOrder(id, cb); });
    } catch (e) { return _watchOrder(id, cb); }
    return function () { try { ref.off('value', h); } catch (e) {} if (fallbackStop) fallbackStop(); };
  };

  // Historique / comptabilité : chargement d'une période précise
  var _fetchRange = M.fetchOrdersRange;
  M.fetchOrdersRange = function (fromIso, toIso, cb) {
    var done = false;
    var timer = setTimeout(function () { if (!done) { done = true; _fetchRange(fromIso, toIso, cb); } }, 8000);
    safe(function () {
      nref('orders').orderByChild('createdAt').startAt(fromIso).endAt(toIso).once('value', function (snap) {
        if (done) return; done = true; clearTimeout(timer);
        cb(toList(snap.val()));
      }, function () { if (done) return; done = true; clearTimeout(timer); _fetchRange(fromIso, toIso, cb); });
    });
  };

  /* -------- 2) Carte, contenus, réglages -------- */
  function pushCatalog(cat) {
    var json; try { json = JSON.stringify(cat); } catch (e) { return; }
    if (json.length > 4000000) { console.warn('[MIMO] Catalogue trop volumineux, reste en local.'); emit('sync-error', { what: 'catalog' }); return; }
    safe(function () {
      nref('config/catalog').set(JSON.parse(json)).catch(function (err) { console.warn('[MIMO] catalogue non synchronisé', err); emit('sync-error', { what: 'catalog' }); });
    });
  }
  var _saveCatalog = M.saveCatalog;
  M.saveCatalog = function (cat) { var r = _saveCatalog(cat); if (!applyingRemote) pushCatalog(cat); return r; };
  var _resetCatalog = M.resetCatalog;
  M.resetCatalog = function () { var r = _resetCatalog(); if (!applyingRemote) pushCatalog(r); return r; };

  /* -------- 3) Photos -------- */
  var mediaMem = {};
  var _saveMedia = M.saveMedia;
  M.saveMedia = function (id, dataUrl) {
    var r = _saveMedia(id, dataUrl);
    mediaMem[id] = dataUrl;
    safe(function () { nref('media/' + id).set(dataUrl); });
    return r;
  };
  M.loadMedia = function (id, cb) {
    if (mediaMem[id]) { cb(mediaMem[id]); return; }
    safe(function () {
      nref('media/' + id).once('value', function (snap) {
        var v = snap.val() || '';
        if (v) { mediaMem[id] = v; try { localStorage.setItem(M.KEYS.media + id, v); } catch (e) {} }
        cb(v);
      }, function () { cb(''); });
    });
  };

  /* -------- 4) Clients & newsletter -------- */
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
        email: String(entry.email).trim().toLowerCase(), name: entry.name || '', date: new Date().toISOString(), active: true
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
      (list || []).forEach(function (n) { if (n && n.email) nref('newsletter/' + key(n.email)).update(clean(n)); });
    });
    return r;
  };

  /* -------- 5) Écoutes temps réel -------- */
  nref('config/catalog').on('value', function (snap) {
    if (snap.exists()) {
      var cat = M.normalize(snap.val());
      withRemote(function () { try { localStorage.setItem(M.KEYS.catalog, JSON.stringify(cat)); } catch (e) {} });
      emit('catalog-updated', { remote: true });
    } else if (isAdmin) {
      pushCatalog(M.getCatalog()); // amorçage initial par l'admin
    }
  }, function (err) { console.warn('[MIMO] catalog', err); });

  if (isAdmin) {
    nref('orders').limitToLast(500).on('value', function (snap) {
      var orders = toList(snap.val());
      withRemote(function () { M.saveOrders(orders); });
      if (firstOrders) { firstOrders = false; if (window.MIMO_syncOrderBaseline) window.MIMO_syncOrderBaseline(); }
      emit('orders-updated', { remote: true });
    }, function (err) { console.warn('[MIMO] orders', err); emit('sync-error', { what: 'orders' }); });

    nref('customers').on('value', function (snap) {
      withRemote(function () { M.saveCustomers(toList(snap.val())); });
      emit('customers-updated');
    }, function (err) { console.warn('[MIMO] customers', err); });

    nref('newsletter').on('value', function (snap) {
      withRemote(function () { M.saveNewsletter(toList(snap.val())); });
      emit('newsletter-updated');
    }, function (err) { console.warn('[MIMO] newsletter', err); });
  }

  try {
    db.ref('.info/connected').on('value', function (snap) { emit('connection', { connected: !!snap.val() }); });
  } catch (e) {}

  window.MIMO_FB = { ready: true, db: db, isAdmin: isAdmin };
  emit('fb-ready');
  console.log('[MIMO] Firebase (Realtime Database) connecté ✓ — temps réel actif (préfixe mimo/)');
})();
