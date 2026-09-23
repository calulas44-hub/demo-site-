/* ============================================================================
   PALANDÖKEN 25 – Couche de données partagée (data.js)
   ----------------------------------------------------------------------------
   Source unique de vérité pour TOUT le site (client + administrateur).
   Les données sont conservées dans le localStorage du navigateur afin que
   l'espace administrateur et l'espace client restent synchronisés :
   si l'admin change un prix / emoji / image, le client le voit immédiatement.

   Rien n'est supprimé ou écrasé sans action explicite : au premier chargement
   on installe un catalogue par défaut, ensuite on lit ce qui est enregistré.
   ==========================================================================*/
(function (global) {
  'use strict';

  var VERSION = 4;

  var KEYS = {
    catalog:    'palandoken_catalog_v1',
    orders:     'palandoken_orders_v1',
    customers:  'palandoken_customers_v1',
    newsletter: 'palandoken_newsletter_v1',
    cart:       'palandoken_cart_v1',
    session:    'palandoken_session_v1'
  };

  /* ----------------------------------------------------------------------
     Catalogue par défaut (modifiable ensuite depuis l'admin)
     ---------------------------------------------------------------------- */
  var DEFAULT_CATALOG = {
    version: VERSION,
    settings: {
      restaurantName: 'PALANDÖKEN 25',
      slogan: 'LE KEBAB QUI TE MET KO !',
      phone: '04 42 58 66 58',
      address: '22 Cours Forbin, 13120 Gardanne',
      email: 'contact@palandoken.fr',
      hours: 'Tous les jours · 11h– 22h30',
      adminCode: '1305',
      currency: '€',
      // Offre menu
      menuUpgradeEnabled: true,
      menuUpgradePrice: 1.00,
      menuUpgradeLabel: 'Passez en MENU pour 1 € de plus !',
      // Fidélité
      loyaltyEnabled: true,
      loyaltyDiscountPercent: 10,
      loyaltyDelayHours: 24,
      // Modes de retrait
      fulfillment: ['À emporter', 'Sur place', 'Livraison'],
      deliveryFee: 2.50,
      // Paramètres e-mail (EmailJS) — À CONFIGURER pour Palandöken 25.
      // Site autonome : on ne réutilise PAS le compte EmailJS de MYKONOS.
      // Renseignez ci-dessous les identifiants d'un compte EmailJS propre à
      // Palandöken 25 (depuis l'espace admin › Réglages), puis activez l'envoi.
      email_enabled: false,
      emailjs_publicKey: '',
      emailjs_serviceId: '',
      emailjs_templateClient: '',
      emailjs_templateAdmin: '',
      admin_notify_email: '',
      // Paiement en ligne (Stripe) — activé une fois le compte Stripe branché.
      // Tant que c'est false, seul le paiement sur place valide une commande.
      stripe_enabled: false,
      stripe_publishableKey: '',
      // Comptabilité — taux de TVA applicable (modifiable), 10 % par défaut
      vatRate: 10
    },

    categories: [
      { id: 'sandwichs', name: 'Sandwichs & Kebabs', emoji: '🥙', order: 1 },
      { id: 'burgers',   name: 'Burgers',            emoji: '🍔', order: 2 },
      { id: 'assiettes', name: 'Assiettes',          emoji: '🍽️', order: 3 },
      { id: 'enfant',    name: 'Menu Enfant',        emoji: '🧒', order: 4 },
      { id: 'sides',     name: 'À côté',             emoji: '🍟', order: 5 },
      { id: 'desserts',  name: 'Desserts',           emoji: '🍰', order: 6 }
    ],

    // bread: options de pain autorisées ([] = pas de pain, ex : assiettes / desserts)
    // customizable: propose sauces + crudités
    // menuEligible: peut être passé en MENU +1 €
    products: [
      { id: 'p_signature', categoryId: 'sandwichs', name: 'Le Palandöken 25', emoji: '👑', image: '',
        price: 8.50, description: 'Notre kebab signature : viande maison, cheddar fondu, sauce au choix.',
        available: true, customizable: true, bread: ['pain', 'galette'], menuEligible: true, order: 1 },
      { id: 'p_kebab', categoryId: 'sandwichs', name: 'Kebab Classique', emoji: '🥙', image: '',
        price: 6.50, description: 'Le grand classique, généreux et savoureux.',
        available: true, customizable: true, bread: ['pain', 'galette'], menuEligible: true, order: 2 },
      { id: 'p_tacos', categoryId: 'sandwichs', name: 'Tacos Poulet', emoji: '🌯', image: '',
        price: 7.00, description: 'Galette garnie, poulet mariné, sauce fromagère.',
        available: true, customizable: true, bread: ['galette'], menuEligible: true, order: 3 },

      { id: 'p_cheese', categoryId: 'burgers', name: 'Cheeseburger', emoji: '🍔', image: '',
        price: 6.00, description: 'Steak haché, cheddar, servi dans son pain moelleux.',
        available: true, customizable: true, bread: ['pain'], menuEligible: true, order: 1 },
      { id: 'p_double', categoryId: 'burgers', name: 'Double Steak', emoji: '🍔', image: '',
        price: 8.50, description: 'Double steak, double cheddar, pour les grosses faims.',
        available: true, customizable: true, bread: ['pain'], menuEligible: true, order: 2 },
      { id: 'p_chicken', categoryId: 'burgers', name: 'Chicken Burger', emoji: '🍗', image: '',
        price: 6.50, description: 'Filet de poulet croustillant, sauce maison.',
        available: true, customizable: true, bread: ['pain'], menuEligible: true, order: 3 },

      { id: 'p_ass_kebab', categoryId: 'assiettes', name: 'Assiette Kebab', emoji: '🍽️', image: '',
        price: 10.50, description: 'Viande, frites maison, crudités et sauce.',
        available: true, customizable: true, bread: [], menuEligible: true, order: 1 },
      { id: 'p_ass_mixte', categoryId: 'assiettes', name: 'Assiette Mixte', emoji: '🍽️', image: '',
        price: 12.00, description: 'Kebab + poulet mariné, frites et crudités.',
        available: true, customizable: true, bread: [], menuEligible: true, order: 2 },

      { id: 'p_enfant', categoryId: 'enfant', name: 'Menu Enfant', emoji: '🧒', image: '',
        price: 5.50, description: 'Un petit burger ou nuggets + frites + une boisson.',
        available: true, customizable: true, bread: ['pain'], menuEligible: false, order: 1 },

      { id: 'p_frites', categoryId: 'sides', name: 'Frites Maison', emoji: '🍟', image: '',
        price: 3.00, description: 'Frites fraîches, croustillantes.',
        available: true, customizable: false, bread: [], menuEligible: false, order: 1 },
      { id: 'p_nuggets', categoryId: 'sides', name: 'Nuggets x6', emoji: '🍗', image: '',
        price: 4.00, description: '6 nuggets de poulet dorés.',
        available: true, customizable: false, bread: [], menuEligible: false, order: 2 },

      { id: 'p_tiramisu', categoryId: 'desserts', name: 'Tiramisu', emoji: '🍰', image: '',
        price: 3.50, description: 'Tiramisu maison café / cacao.',
        available: true, customizable: false, bread: [], menuEligible: false, order: 1 }
    ],

    sauces: [
      { id: 's_blanche',   name: 'Blanche',    available: true },
      { id: 's_algerienne',name: 'Algérienne', available: true },
      { id: 's_harissa',   name: 'Harissa',    available: true },
      { id: 's_mayo',      name: 'Mayonnaise', available: true },
      { id: 's_ketchup',   name: 'Ketchup',    available: true },
      { id: 's_samourai',  name: 'Samouraï',   available: true },
      { id: 's_bbq',       name: 'Barbecue',   available: true },
      { id: 's_andalouse', name: 'Andalouse',  available: true }
    ],

    crudites: [
      { id: 'c_salade',  name: 'Salade',  available: true, defaultOn: true },
      { id: 'c_tomates', name: 'Tomates', available: true, defaultOn: true },
      { id: 'c_oignons', name: 'Oignons', available: true, defaultOn: true }
    ],

    // Boissons : source unique (menu +1 € ET vente à l'unité)
    drinks: [
      { id: 'd_coca',        name: 'Coca-Cola',        price: 2.00, available: true, alcohol: false },
      { id: 'd_coca_cherry', name: 'Coca-Cola Cherry', price: 2.20, available: true, alcohol: false },
      { id: 'd_oasis',       name: 'Oasis',            price: 2.00, available: true, alcohol: false },
      { id: 'd_ayran',       name: 'Ayran',            price: 1.80, available: true, alcohol: false },
      { id: 'd_heineken',    name: 'Heineken',         price: 3.00, available: true, alcohol: true  },
      { id: 'd_eau',         name: 'Eau',              price: 1.50, available: true, alcohol: false },
      { id: 'd_fanta',       name: 'Fanta',            price: 2.00, available: true, alcohol: false }
    ],

    // Promotions / codes de réduction gérés par l'admin
    promos: [
      { id: 'promo_welcome', code: 'BIENVENUE10', type: 'percent', value: 10,
        active: false, description: 'Réduction de bienvenue', autoLoyalty: false }
    ]
  };

  /* ----------------------------------------------------------------------
     Utilitaires localStorage sûrs
     ---------------------------------------------------------------------- */
  function clone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; }
  }
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return clone(fallback);
      return JSON.parse(raw);
    } catch (e) { return clone(fallback); }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.warn('[PALANDOKEN] stockage indisponible', e); return false; }
  }

  /* ----------------------------------------------------------------------
     Catalogue : lecture / écriture + fusion douce des réglages par défaut
     (pour que les nouvelles clés de config apparaissent après mise à jour)
     ---------------------------------------------------------------------- */
  function getCatalog() {
    var stored = null;
    try {
      var raw = localStorage.getItem(KEYS.catalog);
      if (raw) stored = JSON.parse(raw);
    } catch (e) { stored = null; }

    if (!stored) {
      var seed = clone(DEFAULT_CATALOG);
      write(KEYS.catalog, seed);
      return seed;
    }
    // Fusion douce des settings : garde les valeurs de l'admin,
    // ajoute uniquement les clés manquantes venues des défauts.
    stored.settings = stored.settings || {};
    for (var k in DEFAULT_CATALOG.settings) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_CATALOG.settings, k) &&
          !Object.prototype.hasOwnProperty.call(stored.settings, k)) {
        stored.settings[k] = DEFAULT_CATALOG.settings[k];
      }
    }
    ['categories', 'products', 'sauces', 'crudites', 'drinks', 'promos'].forEach(function (key) {
      if (!Array.isArray(stored[key])) stored[key] = clone(DEFAULT_CATALOG[key]);
    });
    // Migration v4 : rafraîchit la configuration e-mail (EmailJS) sur les
    // navigateurs déjà visités, pour que les e-mails partent partout.
    if ((stored.version || 0) < 4) {
      ['email_enabled', 'emailjs_publicKey', 'emailjs_serviceId',
       'emailjs_templateClient', 'emailjs_templateAdmin', 'admin_notify_email']
        .forEach(function (k) { stored.settings[k] = DEFAULT_CATALOG.settings[k]; });
      stored.version = VERSION;
      write(KEYS.catalog, stored);
    }
    return stored;
  }
  function saveCatalog(catalog) {
    catalog.version = VERSION;
    var ok = write(KEYS.catalog, catalog);
    // Notifie les autres onglets/pages ouverts
    try { global.dispatchEvent(new CustomEvent('palandoken:catalog-updated')); } catch (e) {}
    return ok;
  }
  function resetCatalog() {
    var seed = clone(DEFAULT_CATALOG);
    write(KEYS.catalog, seed);
    try { global.dispatchEvent(new CustomEvent('palandoken:catalog-updated')); } catch (e) {}
    return seed;
  }

  /* ----------------------------------------------------------------------
     Collections annexes : commandes, clients, newsletter
     ---------------------------------------------------------------------- */
  function getOrders()   { return read(KEYS.orders, []); }
  function saveOrders(o) { return write(KEYS.orders, o); }
  function addOrder(order) {
    var orders = getOrders();
    orders.unshift(order);
    saveOrders(orders);
    return order;
  }
  function updateOrder(id, patch) {
    var orders = getOrders();
    for (var i = 0; i < orders.length; i++) {
      if (orders[i].id === id) { for (var k in patch) orders[i][k] = patch[k]; break; }
    }
    saveOrders(orders);
    return orders;
  }

  function getCustomers()   { return read(KEYS.customers, []); }
  function saveCustomers(c) { return write(KEYS.customers, c); }
  function findCustomerByEmail(email) {
    if (!email) return null;
    var list = getCustomers(), e = String(email).trim().toLowerCase();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].email).trim().toLowerCase() === e) return list[i];
    }
    return null;
  }
  function upsertCustomer(customer) {
    var list = getCustomers();
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].email).trim().toLowerCase() ===
          String(customer.email).trim().toLowerCase()) { idx = i; break; }
    }
    if (idx >= 0) { for (var k in customer) list[idx][k] = customer[k]; }
    else { list.push(customer); }
    saveCustomers(list);
    return customer;
  }

  function getNewsletter()   { return read(KEYS.newsletter, []); }
  function saveNewsletter(n) { return write(KEYS.newsletter, n); }
  function addNewsletter(entry) {
    var list = getNewsletter();
    var e = String(entry.email || '').trim().toLowerCase();
    if (!e) return list;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].email).trim().toLowerCase() === e) {
        list[i].active = true; saveNewsletter(list); return list;
      }
    }
    list.push({ email: e, name: entry.name || '', date: new Date().toISOString(), active: true });
    saveNewsletter(list);
    return list;
  }

  /* ----------------------------------------------------------------------
     Panier & session client
     ---------------------------------------------------------------------- */
  function getCart()   { return read(KEYS.cart, []); }
  function saveCart(c) {
    write(KEYS.cart, c);
    try { global.dispatchEvent(new CustomEvent('palandoken:cart-updated')); } catch (e) {}
    return c;
  }
  function clearCart() { return saveCart([]); }

  function getSession()   { return read(KEYS.session, null); }
  function saveSession(s) { return write(KEYS.session, s); }
  function clearSession() { try { localStorage.removeItem(KEYS.session); } catch (e) {} }

  /* ----------------------------------------------------------------------
     Helpers métier
     ---------------------------------------------------------------------- */
  function money(n) {
    var v = Number(n || 0);
    return v.toFixed(2).replace('.', ',') + ' €';
  }
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' +
           Math.random().toString(36).slice(2, 7);
  }
  function nextOrderNumber() {
    var orders = getOrders();
    var max = 1000;
    orders.forEach(function (o) {
      var n = parseInt(o.number, 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return max + 1;
  }

  // Est-ce que la réduction fidélité -10 % est disponible pour ce client ?
  function loyaltyStatus(customer, settings) {
    settings = settings || getCatalog().settings;
    var out = { eligible: false, availableAt: null, remainingMs: 0, used: false };
    if (!customer || !settings.loyaltyEnabled) return out;
    if (customer.loyaltyUsed) { out.used = true; return out; }
    if (!customer.firstOrderAt) return out;
    var start = new Date(customer.firstOrderAt).getTime();
    var readyAt = start + (Number(settings.loyaltyDelayHours) || 24) * 3600 * 1000;
    out.availableAt = new Date(readyAt).toISOString();
    var now = Date.now();
    if (now >= readyAt) { out.eligible = true; }
    else { out.remainingMs = readyAt - now; }
    return out;
  }

  /* ----------------------------------------------------------------------
     API publique
     ---------------------------------------------------------------------- */
  global.PALANDOKEN = {
    VERSION: VERSION,
    KEYS: KEYS,
    DEFAULT_CATALOG: DEFAULT_CATALOG,

    // catalogue
    getCatalog: getCatalog,
    saveCatalog: saveCatalog,
    resetCatalog: resetCatalog,

    // collections
    getOrders: getOrders, saveOrders: saveOrders, addOrder: addOrder, updateOrder: updateOrder,
    getCustomers: getCustomers, saveCustomers: saveCustomers,
    findCustomerByEmail: findCustomerByEmail, upsertCustomer: upsertCustomer,
    getNewsletter: getNewsletter, saveNewsletter: saveNewsletter, addNewsletter: addNewsletter,

    // panier / session
    getCart: getCart, saveCart: saveCart, clearCart: clearCart,
    getSession: getSession, saveSession: saveSession, clearSession: clearSession,

    // helpers
    money: money, uid: uid, clone: clone,
    nextOrderNumber: nextOrderNumber, loyaltyStatus: loyaltyStatus
  };

})(window);
