/* ============================================================================
   MOZAÏK – Couche de données partagée (data.js)
   ----------------------------------------------------------------------------
   Source unique de vérité pour le site client ET l'administration (même
   fonctionnement que MYKONOS) : localStorage côté navigateur, synchronisé en
   temps réel par firebase-sync.js (données rangées sous « mozaik/ »).

   La carte par défaut reprend fidèlement la carte « MENU BOISSONS » affichée
   en boutique (prix officiels). Les gourmandises connues (baklava pistache,
   künefe, pâtisseries maison) n'ont PAS de prix publié : elles sont présentes
   sans prix et ne sont pas commandables tant que l'admin n'a pas saisi le prix.
   ==========================================================================*/
(function (global) {
  'use strict';

  var VERSION = 1;
  var NS = 'mozaik';

  var KEYS = {
    catalog:    NS + '_catalog_v1',
    orders:     NS + '_orders_v1',
    customers:  NS + '_customers_v1',
    newsletter: NS + '_newsletter_v1',
    cart:       NS + '_cart_v1',
    session:    NS + '_session_v1',
    myOrders:   NS + '_my_orders_v1',
    table:      NS + '_table_v1',
    media:      NS + '_media_'
  };
  var ORDERS_CACHE_MAX = 1500;

  /* ----------------------------------------------------------------------
     SHA-256 (hachage du code administrateur — jamais stocké en clair)
     ---------------------------------------------------------------------- */
  function sha256(str) {
    var ascii = unescape(encodeURIComponent(String(str)));
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var maxWord = Math.pow(2, 32), i, j, result = '';
    var words = [], bitLen = ascii.length * 8;
    var hash = [], k = [], primeCounter = 0, isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    hash = hash.slice(0, 8);
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((bitLen / maxWord) | 0);
    words[words.length] = bitLen;
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { var b = (hash[i] >> (j * 8)) & 255; result += ((b < 16) ? '0' : '') + b.toString(16); }
    return result;
  }
  function hashAdminCode(code) { return sha256('mozaik|' + String(code || '').trim()); }

  /* ----------------------------------------------------------------------
     Options & suppléments (carte officielle : « + EXTRAS & OPTIONS »)
     ---------------------------------------------------------------------- */
  var OPTION_GROUPS = [
    { id: 'og_temp', name: 'Chaud ou froid', type: 'single', required: true,
      help: 'Nos lattes signatures se servent au choix, chauds ou glacés.',
      choices: [
        { id: 'c_chaud', name: 'Chaud', price: 0, available: true },
        { id: 'c_froid', name: 'Froid (glacé)', price: 0, available: true }
      ] },
    { id: 'og_turc', name: 'Parfum du café turc', type: 'single', required: false,
      help: 'Au choix : cardamome, fleur d\'oranger, cannelle ou muscade.',
      choices: [
        { id: 'c_cardamome', name: 'Cardamome', price: 0.5, available: true },
        { id: 'c_fleur', name: 'Fleur d\'oranger', price: 0.5, available: true },
        { id: 'c_cannelle', name: 'Cannelle', price: 0.5, available: true },
        { id: 'c_muscade', name: 'Muscade', price: 0.5, available: true }
      ] },
    { id: 'og_oralet', name: 'Parfum de l\'oralet', type: 'single', required: true, help: '',
      choices: [
        { id: 'c_orange', name: 'Orange', price: 0, available: true },
        { id: 'c_kiwi', name: 'Kiwi', price: 0, available: true }
      ] },
    { id: 'og_lait', name: 'Lait végétal', type: 'single', required: false, help: '',
      choices: [
        { id: 'c_avoine', name: 'Avoine', price: 0.5, available: true },
        { id: 'c_amande', name: 'Amande', price: 0.5, available: true }
      ] },
    { id: 'og_sirop', name: 'Sirop BIO', type: 'single', required: false, help: '',
      choices: [
        { id: 'c_vanille', name: 'Vanille', price: 0.5, available: true },
        { id: 'c_caramel', name: 'Caramel', price: 0.5, available: true },
        { id: 'c_noisette', name: 'Noisette', price: 0.5, available: true }
      ] },
    { id: 'og_extra', name: 'Extra', type: 'multi', required: false, help: '',
      choices: [
        { id: 'c_extra_espresso', name: 'Extra espresso BIO', price: 1, available: true }
      ] }
  ];

  /* ----------------------------------------------------------------------
     Carte officielle (photo « MENU BOISSONS » — prix affichés en boutique)
     ---------------------------------------------------------------------- */
  var CATEGORIES = [
    { id: 'turc',         name: 'Cafés turcs & tradition',     icon: 'turkish', description: 'Le café turc BIO, préparé à la cezve dans le sable chaud.', order: 1, active: true },
    { id: 'signature',    name: 'Signature Lattes',             icon: 'glass',   description: 'Soit froid, soit chaud : nos lattes signatures aux saveurs d\'Anatolie.', order: 2, active: true },
    { id: 'matcha',       name: 'Bar à matcha',                 icon: 'glass',   description: 'Classic, Cream, Fruit & Signature Collections.', order: 3, active: true },
    { id: 'color',        name: 'Color Lattes & Mini Flights',  icon: 'flight',  description: 'Ube, Golden, Blue… et le trio découverte.', order: 4, active: true },
    { id: 'espresso',     name: 'Bar à espresso BIO & V60',     icon: 'espresso',description: 'Café de spécialité BIO, en espresso ou en filtre V60.', order: 5, active: true },
    { id: 'chaudes',      name: 'Boissons chaudes',             icon: 'cup',     description: 'Chocolats, thé turc, oralet, chai & lattes de saison.', order: 6, active: true },
    { id: 'froides',      name: 'Boissons froides de saison',   icon: 'lemonade',description: 'Refreshers iced drinks & lemonades.', order: 7, active: true },
    { id: 'gourmandises', name: 'Pâtisseries maison',           icon: 'baklava', description: 'Pâtisseries maison & saveurs d\'Anatolie.', order: 8, active: true },
    { id: 'brunch',       name: 'Brunch & salé',                icon: 'pastry',  description: 'À compléter depuis l\'administration.', order: 9, active: false }
  ];

  var orderSeq = 0;
  function P(cat, id, name, price, desc, x) {
    var p = {
      id: id, categoryId: cat, name: name, price: price, description: desc || '',
      image: '', tint: '#b07a4f', vessel: 'cup', temp: 'hot', layer: false,
      tags: [], optionGroupIds: [], available: true, active: true, featured: false,
      order: ++orderSeq
    };
    for (var k in (x || {})) p[k] = x[k];
    return p;
  }
  var MILK = ['og_lait'], LATTE = ['og_lait', 'og_sirop', 'og_extra'];
  var SIG = ['og_temp', 'og_lait', 'og_extra'];

  var PRODUCTS = [
    // ---- Cafés turcs & tradition
    P('turc', 'p_turkish_coffee', 'Turkish Coffee BIO sur sable', 4.5,
      'Moulu très fin, préparé à la cezve en cuivre dans le sable chauffé entre 160 et 180 °C : un café dense, onctueux et aromatique. Parfum au choix (+0,50 €).',
      { tint: '#3a2416', vessel: 'cezve', tags: ['BIO', 'Préparé dans le sable'], optionGroupIds: ['og_turc'], featured: true }),
    P('turc', 'p_menengic', 'Menengiç (sans caféine)', 4.5,
      'Boisson traditionnelle d\'Anatolie à base de pistachier térébinthe, douce et ronde.',
      { tint: '#7a6a3a', vessel: 'turkish', tags: ['Sans caféine'] }),
    P('turc', 'p_dibek', 'Hazelnut Dibek coffee', 4.5,
      'Café dibek à la noisette, servi dans sa tasse traditionnelle.',
      { tint: '#7b4b26', vessel: 'turkish' }),
    P('turc', 'p_salep', 'Salep', 5,
      'Boisson traditionnelle chaude & crémeuse, à la cannelle.',
      { tint: '#efe1c6', vessel: 'cup', art: false, optionGroupIds: [] }),

    // ---- Signature Lattes (soit froid, soit chaud)
    P('signature', 'p_banana_bread', 'Banana Bread Latte', 6, 'Latte signature aux saveurs de banana bread.', { tint: '#d9b26a', vessel: 'glass', temp: 'both', layer: true, optionGroupIds: SIG }),
    P('signature', 'p_biscoff', 'Biscoff Latte', 6, 'Latte signature au Biscoff.', { tint: '#b86f3a', vessel: 'glass', temp: 'both', layer: true, optionGroupIds: SIG }),
    P('signature', 'p_lokum', 'Lokum Latte', 6, 'Latte signature aux notes de loukoum.', { tint: '#e8a0b4', vessel: 'glass', temp: 'both', layer: true, optionGroupIds: SIG, featured: true }),
    P('signature', 'p_menengic_latte', 'Menengiç Espresso Latte', 6, 'Latte signature au menengiç et à l\'espresso.', { tint: '#9a7a45', vessel: 'glass', temp: 'both', layer: true, optionGroupIds: SIG }),
    P('signature', 'p_baklava_latte', 'Baklava Latte', 6.5, 'Latte signature inspiré du baklava.', { tint: '#c9a24a', vessel: 'glass', temp: 'both', layer: true, optionGroupIds: SIG }),
    P('signature', 'p_date_latte', 'Date Latte', 6, 'Latte signature à la datte.', { tint: '#8a5a3a', vessel: 'glass', temp: 'both', layer: true, optionGroupIds: SIG }),
    P('signature', 'p_vanilla_latte', 'Vanilla Cream Latte', 6, 'Latte signature à la crème vanille.', { tint: '#ead7a6', vessel: 'glass', temp: 'both', layer: true, optionGroupIds: SIG }),
    P('signature', 'p_mocha', 'Mocha Latte', 6, 'Latte signature chocolat & espresso.', { tint: '#6b3f2a', vessel: 'glass', temp: 'both', layer: true, optionGroupIds: SIG }),
    P('signature', 'p_pistachio_latte', 'Pistachio Cream Latte', 6.5, 'Latte crémeux & gourmand à la pistache.', { tint: '#9cb36a', vessel: 'glass', temp: 'both', layer: true, optionGroupIds: SIG, featured: true }),
    P('signature', 'p_tahini_pekmez', 'Tahini & Pekmez Latte', 6, 'Espresso, lait, tahini, mélasse de raisin & miel.', { tint: '#9b6b45', vessel: 'glass', temp: 'both', layer: true, optionGroupIds: SIG }),

    // ---- Bar à matcha
    P('matcha', 'p_matcha', 'Matcha latte', 5.5, 'Classic — le matcha latte tout en douceur.', { tint: '#7fa650', vessel: 'glass', temp: 'cold', layer: true, tags: ['Classic'], optionGroupIds: ['og_lait', 'og_sirop'] }),
    P('matcha', 'p_vanilla_matcha', 'Vanilla Cream Matcha', 6, 'Cream Collection — matcha et crème vanille.', { tint: '#a9c27a', vessel: 'glass', temp: 'cold', layer: true, tags: ['Cream Collection'], optionGroupIds: MILK }),
    P('matcha', 'p_pistachio_matcha', 'Pistachio Matcha', 6.5, 'Cream Collection — matcha et pistache.', { tint: '#8fae55', vessel: 'glass', temp: 'cold', layer: true, tags: ['Cream Collection'], optionGroupIds: MILK }),
    P('matcha', 'p_biscoff_matcha', 'Biscoff Matcha', 6, 'Cream Collection — matcha et Biscoff.', { tint: '#9aa65a', vessel: 'glass', temp: 'cold', layer: true, tags: ['Cream Collection'], optionGroupIds: MILK }),
    P('matcha', 'p_strawberry_matcha', 'Strawberry Matcha', 6, 'Fruit Collection — matcha et fraise.', { tint: '#e2617a', vessel: 'glass', temp: 'cold', layer: true, tags: ['Fruit Collection'], optionGroupIds: MILK }),
    P('matcha', 'p_mango_matcha', 'Mango Matcha', 6, 'Fruit Collection — matcha et mangue.', { tint: '#f2a33a', vessel: 'glass', temp: 'cold', layer: true, tags: ['Fruit Collection'], optionGroupIds: MILK }),
    P('matcha', 'p_lavender_matcha', 'Lavender Matcha', 6, 'Signature Collection — matcha et lavande.', { tint: '#a78bd1', vessel: 'glass', temp: 'cold', layer: true, tags: ['Signature Collection'], optionGroupIds: MILK }),
    P('matcha', 'p_ube_matcha', 'Ube Cream Matcha', 6, 'Signature Collection — matcha et crème d\'ube.', { tint: '#8e6bbf', vessel: 'glass', temp: 'cold', layer: true, tags: ['Signature Collection'], optionGroupIds: MILK, featured: true }),

    // ---- Color Lattes & Mini Flights
    P('color', 'p_mini_flights', 'Mini Flights', 10, '3 mini boissons de 80 ml : Matcha · Ube · Golden. Parfait pour découvrir !', { tint: '#c9b27a', vessel: 'flight', temp: 'cold', tints: ['#7fa650', '#8e6bbf', '#e3a72f'], tags: ['3 × 80 ml'], featured: true }),
    P('color', 'p_ube_latte', 'Ube Latte', 5.5, 'Color latte à l\'ube, l\'igname violette.', { tint: '#8e6bbf', vessel: 'cup', optionGroupIds: MILK }),
    P('color', 'p_golden_latte', 'Golden Latte', 5.5, 'Curcuma, gingembre & cannelle.', { tint: '#e3a72f', vessel: 'cup', optionGroupIds: MILK }),
    P('color', 'p_blue_latte', 'Blue Latte', 5.5, 'Color latte d\'un bleu éclatant.', { tint: '#4a7fc1', vessel: 'cup', optionGroupIds: MILK }),
    P('color', 'p_coconut_ube', 'Coconut Ube Latte', 5.5, 'Color latte ube & coco.', { tint: '#b79ad6', vessel: 'cup', optionGroupIds: MILK }),

    // ---- Bar à espresso BIO & V60
    P('espresso', 'p_espresso', 'Espresso', 2.2, 'Café de spécialité BIO.', { tint: '#4a2c1a', vessel: 'espresso', tags: ['BIO'] }),
    P('espresso', 'p_double_espresso', 'Double Espresso', 3.2, 'Deux fois plus d\'intensité.', { tint: '#4a2c1a', vessel: 'espresso', tags: ['BIO'] }),
    P('espresso', 'p_americano', 'Americano', 3.2, 'Espresso allongé d\'eau chaude.', { tint: '#5a3620', vessel: 'cup', art: false, tags: ['BIO'], optionGroupIds: ['og_extra'] }),
    P('espresso', 'p_cappuccino', 'Cappuccino', 4.5, 'Espresso, lait et mousse onctueuse.', { tint: '#b07a4f', vessel: 'cup', tags: ['BIO'], optionGroupIds: LATTE }),
    P('espresso', 'p_flat_white', 'Flat white', 5, 'Double ristretto et lait micro-moussé.', { tint: '#a8744a', vessel: 'cup', tags: ['BIO'], optionGroupIds: LATTE }),
    P('espresso', 'p_cafe_latte', 'Café latte', 5, 'Espresso et beaucoup de lait chaud.', { tint: '#c89b6d', vessel: 'cup', tags: ['BIO'], optionGroupIds: LATTE }),
    P('espresso', 'p_v60', 'V60 BIO', 6.5, 'Café filtre BIO extrait à la V60, en douceur.', { tint: '#6b4226', vessel: 'v60', tags: ['BIO'] }),

    // ---- Boissons chaudes
    P('chaudes', 'p_chocolat', 'Chocolat chaud', 5, 'Un chocolat chaud réconfortant.', { tint: '#5a3a28', vessel: 'cup', art: false, optionGroupIds: MILK }),
    P('chaudes', 'p_chocolat_pistache', 'Chocolat chaud Pistache', 6, 'Chocolat chaud à la pistache.', { tint: '#8aa05a', vessel: 'cup', art: false, optionGroupIds: MILK }),
    P('chaudes', 'p_chocolat_tahini', 'Chocolat chaud tahini', 6, 'Chocolat chaud au tahini.', { tint: '#a77d55', vessel: 'cup', art: false, optionGroupIds: MILK }),
    P('chaudes', 'p_chocolat_turc', 'Chocolat chaud à la turc', 5, 'Chocolat chaud onctueux, cannelle & cardamome.', { tint: '#6a4030', vessel: 'cup', art: false, optionGroupIds: MILK }),
    P('chaudes', 'p_the_turc', 'Thé turc à la bergamote', 1.5, 'Thé noir turc parfumé à la bergamote, servi dans son verre tulipe.', { tint: '#b5471f', vessel: 'tea' }),
    P('chaudes', 'p_oralet', 'Oralet (orange - kiwi)', 1.5, 'Boisson chaude fruitée à l\'orange ou au kiwi.', { tint: '#f08a24', vessel: 'tea', optionGroupIds: ['og_oralet'] }),
    P('chaudes', 'p_chai', 'Chai Latte', 5.5, 'Cannelle, cardamome, gingembre & épices.', { tint: '#b9835a', vessel: 'cup', optionGroupIds: MILK }),
    P('chaudes', 'p_miel_cannelle', 'Miel & Cannelle Latte', 6, 'Espresso, lait chaud, miel & cannelle.', { tint: '#d7a24a', vessel: 'cup', optionGroupIds: ['og_lait', 'og_extra'] }),
    P('chaudes', 'p_pumpkin', 'Pumpkin Spice Latte', 5.5, 'Espresso, lait chaud, citrouille & épices.', { tint: '#d9792b', vessel: 'cup', tags: ['De saison'], optionGroupIds: ['og_lait', 'og_extra'] }),

    // ---- Boissons froides de saison
    P('froides', 'p_cool_lime', 'Cool Lime', 5.5, 'Refresher glacé au citron vert.', { tint: '#8cc152', vessel: 'lemonade', temp: 'cold', fruit: '#9ccc4a', tags: ['Refresher'] }),
    P('froides', 'p_citrus_cold_brew', 'Citrus Cold Brew', 6.5, 'Cold brew et agrumes, sur glace.', { tint: '#c9822d', vessel: 'glass', temp: 'cold', tags: ['Refresher'] }),
    P('froides', 'p_peach_tonic', 'Peach Espresso Tonic', 6.5, 'Espresso, tonic et pêche, sur glace.', { tint: '#e79a6a', vessel: 'glass', temp: 'cold', layer: true, tags: ['Refresher'] }),
    P('froides', 'p_cucumber', 'Cucumber Sparkling', 5.5, 'Pétillant et rafraîchissant au concombre.', { tint: '#a8d5a2', vessel: 'lemonade', temp: 'cold', fruit: '#bfe3a8', tags: ['Refresher'] }),
    P('froides', 'p_jasmine', 'Golden Jasmine Green Tea', 5.5, 'Thé vert au jasmin, glacé.', { tint: '#d9c46a', vessel: 'glass', temp: 'cold', tags: ['Refresher'] }),
    P('froides', 'p_peach_green_tea', 'Peach Green Tea', 5.5, 'Thé vert glacé à la pêche.', { tint: '#f4a27c', vessel: 'glass', temp: 'cold', tags: ['Refresher'] }),
    P('froides', 'p_lavender_tea', 'Lavender Iced Tea', 5.5, 'Thé glacé à la lavande.', { tint: '#a78bd1', vessel: 'glass', temp: 'cold', tags: ['Refresher'] }),
    P('froides', 'p_turkish_lemonade', 'Turkish Lemonade', 5.5, 'La limonade à la turque.', { tint: '#f3d250', vessel: 'lemonade', temp: 'cold', tags: ['Lemonade'], featured: true }),
    P('froides', 'p_strawberry_lemonade', 'Strawberry Lemonade', 5.5, 'Limonade à la fraise.', { tint: '#e2617a', vessel: 'lemonade', temp: 'cold', tags: ['Lemonade'] }),
    P('froides', 'p_mango_lemonade', 'Mango Lemonade', 5.5, 'Limonade à la mangue.', { tint: '#f2a33a', vessel: 'lemonade', temp: 'cold', tags: ['Lemonade'] }),
    P('froides', 'p_peach_lemonade', 'Peach Lemonade', 5.5, 'Limonade à la pêche.', { tint: '#f4a27c', vessel: 'lemonade', temp: 'cold', tags: ['Lemonade'] }),
    P('froides', 'p_hibiscus_lemonade', 'Hibiscus Lemonade', 5.5, 'Limonade à l\'hibiscus.', { tint: '#b8324f', vessel: 'lemonade', temp: 'cold', tags: ['Lemonade'] }),

    // ---- Pâtisseries maison — PRIX NON PUBLIÉS : à compléter dans l'admin
    P('gourmandises', 'p_baklava', 'Baklava à la pistache', null, 'Pâtisserie maison feuilletée à la pistache, l\'accord parfait avec un café turc.', { tint: '#d9a441', vessel: 'baklava', tags: ['Fait maison'] }),
    P('gourmandises', 'p_kunefe', 'Künefe', null, 'Dessert traditionnel de pâte très fine et de fromage, servi chaud. Préparé minute (comptez environ 10 min).', { tint: '#e08a2c', vessel: 'kunefe', tags: ['Fait maison', 'Servi chaud'] }),
    P('gourmandises', 'p_patisserie_jour', 'Pâtisserie maison du jour', null, 'Pâtisseries maison & saveurs d\'Anatolie : demandez la sélection du jour.', { tint: '#d9b26a', vessel: 'pastry', tags: ['Fait maison'] })
  ];

  /* ----------------------------------------------------------------------
     Suggestions du panier (modifiables dans l'admin)
     Les produits sans prix / indisponibles / déjà au panier sont ignorés.
     ---------------------------------------------------------------------- */
  var SUGGESTIONS = {
    enabled: true,
    afterAdd: true,
    max: 3,
    title: 'Ça irait parfaitement avec…',
    rules: [
      { id: 'sg_turc', name: 'Café turc → douceur maison', active: true,
        triggerCategoryIds: ['turc'], triggerProductIds: [],
        suggestProductIds: ['p_baklava', 'p_kunefe', 'p_patisserie_jour', 'p_the_turc'],
        message: 'Le café turc se savoure avec une douceur.' },
      { id: 'sg_latte', name: 'Latte / matcha → pâtisserie', active: true,
        triggerCategoryIds: ['signature', 'matcha', 'color', 'espresso', 'chaudes'], triggerProductIds: [],
        suggestProductIds: ['p_baklava', 'p_kunefe', 'p_patisserie_jour'],
        message: 'Une pâtisserie maison avec votre boisson ?' },
      { id: 'sg_froid', name: 'Boisson fraîche → douceur', active: true,
        triggerCategoryIds: ['froides'], triggerProductIds: [],
        suggestProductIds: ['p_baklava', 'p_patisserie_jour', 'p_mini_flights'],
        message: 'Et une petite douceur ?' },
      { id: 'sg_patisserie', name: 'Pâtisserie → café turc ou thé', active: true,
        triggerCategoryIds: ['gourmandises'], triggerProductIds: [],
        suggestProductIds: ['p_turkish_coffee', 'p_the_turc', 'p_menengic'],
        message: 'Le duo parfait : douceur & café turc.' }
    ],
    // Complément quand les règles ne suffisent pas
    fallbackProductIds: ['p_turkish_coffee', 'p_the_turc', 'p_mini_flights', 'p_pistachio_latte']
  };

  /* ----------------------------------------------------------------------
     Catalogue par défaut
     ---------------------------------------------------------------------- */
  var DEFAULT_CATALOG = {
    version: VERSION,
    settings: {
      restaurantName: 'MOZAÏK',
      tagline: 'Bio Coffee Shop',
      slogan: 'Savourez la nature dans chaque gorgée !',
      phone: '07 51 29 07 30',
      address: '35 rue Boulegon, 13100 Aix-en-Provence',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Mozaik+Coffee+35+rue+Boulegon+13100+Aix-en-Provence',
      email: '',
      instagram: 'mozaik.coffee',
      // 0 = dimanche … 6 = samedi (bio Instagram : Dim–Lun 9h30–18h · Mer–Sam 9h–20h · mardi fermé)
      openingHours: [
        { open: '09:30', close: '18:00', closed: false },
        { open: '09:30', close: '18:00', closed: false },
        { open: '09:00', close: '20:00', closed: true },
        { open: '09:00', close: '20:00', closed: false },
        { open: '09:00', close: '20:00', closed: false },
        { open: '09:00', close: '20:00', closed: false },
        { open: '09:00', close: '20:00', closed: false }
      ],
      adminCodeHash: hashAdminCode('3513'),
      currency: '€',
      siteUrl: '',
      // Commandes
      ordersPaused: false,
      restrictToOpeningHours: false,
      fulfillment: ['Sur place', 'À emporter'],
      deliveryFee: 0,
      // Offres
      studentEnabled: true,
      studentDiscountPercent: 10,
      loyaltyEnabled: true,
      loyaltyDiscountPercent: 10,
      loyaltyDelayHours: 24,
      // E-mails (EmailJS) — même compte que MYKONOS / Palandöken : les modèles
      // utilisent {{restaurant_name}}, chaque site affiche donc son propre nom.
      email_enabled: true,
      emailjs_publicKey: 'BxBYmURytGUsgurdI',
      emailjs_serviceId: 'service_djinnos',
      emailjs_templateClient: 'template_dz7ksew',
      emailjs_templateAdmin: 'template_lbk1c7z',
      admin_notify_email: 'calulas44@gmail.com',
      // Paiement en ligne : nécessite un compte Stripe + un serveur de paiement.
      // Tant que ce n'est pas branché, seul le paiement sur place valide une commande.
      stripe_enabled: false,
      stripe_publishableKey: '',
      vatRate: 10
    },

    content: {
      announcement: '',
      marquee: [
        '−10 % pour tous les étudiants',
        'Café turc préparé dans le sable chaud',
        '100 % bio & naturel',
        'Pâtisseries maison & saveurs d\'Anatolie',
        'À emporter ou sur place',
        'Savourez la nature dans chaque gorgée ♡'
      ],
      heroKicker: 'Bio Coffee Shop · Aix-en-Provence',
      heroTitle: 'Le café turc, préparé dans le sable chaud.',
      heroText: 'Büşra et Fatih vous font voyager en Anatolie : café turc sur sable, matchas, lattes signatures et pâtisseries maison. Commandez en deux minutes, on s\'occupe du reste.',
      heroImage: '',
      posterTitle: 'Hoş geldiniz !',
      posterText: 'Büşra & Fatih vous accueillent rue Boulegon',
      teamNames: 'Büşra & Fatih',
      sandTitle: 'Le café turc, comme en Anatolie',
      sandText: 'Fatih prépare chaque café turc à la cezve en cuivre, dans un bac de sable chauffé entre 160 et 180 °C. La chaleur douce et enveloppante laisse le temps aux arômes de se développer, jusqu\'à ce que la mousse monte. Une méthode ancestrale, une vraie tradition.',
      sandSteps: [
        'Un café BIO moulu extra-fin',
        'Chauffé doucement dans le sable (160–180 °C)',
        'La mousse monte : il est servi aussitôt',
        'Et, si vous le souhaitez, Büşra lit votre avenir dans le marc'
      ],
      storyTitle: 'Büşra & Fatih, un rêve devenu café',
      storyText: 'Originaires de Turquie, Büşra et Fatih sont arrivés en France il y a quelques années et ont appris le français à l\'université avant de réaliser leur rêve : ouvrir un café multiculturel à Aix-en-Provence. Accompagnés par SINGA Marseille, ils ont ouvert Mozaïk rue Boulegon : un lieu chaleureux où l\'on partage le café turc, des spécialités maison et des produits bio et locaux.',
      workshopsTitle: 'Ateliers & rencontres',
      workshopsText: 'Ateliers céramique et crochet, rencontres linguistiques autour d\'un café, soirées « No Phone Night »… Mozaïk est aussi un lieu de partage. Suivez @mozaik.coffee pour connaître les prochaines dates.',
      promises: ['Fait maison avec amour', 'Ingrédients sélectionnés avec soin', '100 % bio & naturel', 'À emporter ou sur place'],
      studentText: 'Sur présentation de votre carte étudiante au comptoir.',
      thanksText: 'Teşekkürler ! Savourez la nature dans chaque gorgée ♡'
    },

    categories: CATEGORIES,
    products: PRODUCTS,
    optionGroups: OPTION_GROUPS,
    suggestions: SUGGESTIONS,

    tables: [
      { id: '1', label: 'Table 1', zone: 'Salle', active: true },
      { id: '2', label: 'Table 2', zone: 'Salle', active: true },
      { id: '3', label: 'Table 3', zone: 'Salle', active: true },
      { id: '4', label: 'Table 4', zone: 'Salle', active: true },
      { id: '5', label: 'Table 5', zone: 'Salle', active: true },
      { id: '6', label: 'Table 6', zone: 'Salle', active: true },
      { id: 'T1', label: 'Terrasse 1', zone: 'Terrasse', active: true },
      { id: 'T2', label: 'Terrasse 2', zone: 'Terrasse', active: true }
    ],

    promos: [
      { id: 'promo_bienvenue', code: 'HOSGELDIN', type: 'percent', value: 10, active: false,
        minAmount: 0, description: 'Exemple de code (désactivé) — à adapter' }
    ]
  };

  /* ----------------------------------------------------------------------
     Utilitaires localStorage sûrs
     ---------------------------------------------------------------------- */
  function clone(obj) { try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; } }
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return clone(fallback);
      return JSON.parse(raw);
    } catch (e) { return clone(fallback); }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.warn('[MOZAIK] stockage indisponible', e); return false; }
  }
  function emit(name, detail) { try { global.dispatchEvent(new CustomEvent('mozaik:' + name, { detail: detail })); } catch (e) {} }

  /* ----------------------------------------------------------------------
     Catalogue : lecture / écriture + fusion douce des valeurs par défaut
     ---------------------------------------------------------------------- */
  function normalize(stored) {
    stored.settings = stored.settings || {};
    stored.content = stored.content || {};
    var k;
    for (k in DEFAULT_CATALOG.settings) {
      if (!Object.prototype.hasOwnProperty.call(stored.settings, k)) stored.settings[k] = clone(DEFAULT_CATALOG.settings[k]);
    }
    for (k in DEFAULT_CATALOG.content) {
      if (!Object.prototype.hasOwnProperty.call(stored.content, k)) stored.content[k] = clone(DEFAULT_CATALOG.content[k]);
    }
    ['categories', 'products', 'optionGroups', 'tables', 'promos'].forEach(function (key) {
      if (!Array.isArray(stored[key])) stored[key] = clone(DEFAULT_CATALOG[key]);
    });
    if (!stored.suggestions || typeof stored.suggestions !== 'object') stored.suggestions = clone(DEFAULT_CATALOG.suggestions);
    if (!Array.isArray(stored.suggestions.rules)) stored.suggestions.rules = [];
    if (!Array.isArray(stored.suggestions.fallbackProductIds)) stored.suggestions.fallbackProductIds = [];
    // Firebase supprime les tableaux vides : on les restaure
    stored.products.forEach(function (p) {
      if (!Array.isArray(p.tags)) p.tags = [];
      if (!Array.isArray(p.optionGroupIds)) p.optionGroupIds = [];
      if (p.price === undefined || p.price === '') p.price = null;
    });
    stored.optionGroups.forEach(function (g) { if (!Array.isArray(g.choices)) g.choices = []; });
    stored.suggestions.rules.forEach(function (r) {
      ['triggerCategoryIds', 'triggerProductIds', 'suggestProductIds'].forEach(function (f) { if (!Array.isArray(r[f])) r[f] = []; });
    });
    if (!Array.isArray(stored.settings.openingHours) || stored.settings.openingHours.length !== 7) stored.settings.openingHours = clone(DEFAULT_CATALOG.settings.openingHours);
    if (!Array.isArray(stored.settings.fulfillment) || !stored.settings.fulfillment.length) stored.settings.fulfillment = clone(DEFAULT_CATALOG.settings.fulfillment);
    ['marquee', 'sandSteps', 'promises'].forEach(function (f) { if (!Array.isArray(stored.content[f])) stored.content[f] = []; });
    return stored;
  }
  function getCatalog() {
    var stored = null;
    try { var raw = localStorage.getItem(KEYS.catalog); if (raw) stored = JSON.parse(raw); } catch (e) { stored = null; }
    if (!stored) { var seed = clone(DEFAULT_CATALOG); write(KEYS.catalog, seed); return seed; }
    return normalize(stored);
  }
  function saveCatalog(catalog) {
    catalog.version = VERSION;
    catalog.updatedAt = new Date().toISOString();
    var ok = write(KEYS.catalog, catalog);
    emit('catalog-updated');
    return ok;
  }
  function resetCatalog() {
    var seed = clone(DEFAULT_CATALOG);
    seed.updatedAt = new Date().toISOString();
    write(KEYS.catalog, seed);
    emit('catalog-updated');
    return seed;
  }

  /* ----------------------------------------------------------------------
     Commandes (cache local ; Firebase = source partagée)
     ---------------------------------------------------------------------- */
  function sortOrders(list) {
    return list.sort(function (a, b) { return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); });
  }
  function getOrders() { return read(KEYS.orders, []); }
  function saveOrders(list) { // cache local uniquement
    list = sortOrders((list || []).filter(Boolean)).slice(0, ORDERS_CACHE_MAX);
    return write(KEYS.orders, list);
  }
  function findOrder(id) { var l = getOrders(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function addOrder(order) {
    var orders = getOrders().filter(function (o) { return o.id !== order.id; });
    orders.unshift(order);
    saveOrders(orders);
    emit('orders-updated');
    return order;
  }
  function updateOrder(id, patch) {
    var orders = getOrders();
    for (var i = 0; i < orders.length; i++) {
      if (orders[i].id === id) { for (var k in patch) orders[i][k] = patch[k]; break; }
    }
    saveOrders(orders);
    emit('orders-updated');
    return orders;
  }
  function deleteOrder(id) {
    saveOrders(getOrders().filter(function (o) { return o.id !== id; }));
    emit('orders-updated');
  }
  function mergeOrders(list) { // fusion de commandes reçues (Firebase) dans le cache
    var map = {};
    getOrders().forEach(function (o) { map[o.id] = o; });
    (list || []).forEach(function (o) { if (o && o.id) map[o.id] = o; });
    saveOrders(Object.keys(map).map(function (k) { return map[k]; }));
  }
  function nextOrderNumber() {
    var max = 1000;
    getOrders().forEach(function (o) { var n = parseInt(o.number, 10); if (!isNaN(n) && n > max) max = n; });
    return max + 1;
  }
  // Remplacé par une transaction Firebase (numéros uniques entre appareils)
  function allocateOrderNumber(cb) { cb(nextOrderNumber()); }
  // Suivi d'une commande (remplacé par une écoute Firebase si disponible)
  function watchOrder(id, cb) {
    var last = '';
    function tick() { var o = findOrder(id); var s = JSON.stringify(o || null); if (s !== last) { last = s; cb(o); } }
    tick();
    var t = setInterval(tick, 3000);
    function onStorage(e) { if (e.key === KEYS.orders) tick(); }
    global.addEventListener('storage', onStorage);
    return function () { clearInterval(t); global.removeEventListener('storage', onStorage); };
  }
  // Chargement d'une période (remplacé par une requête Firebase si disponible)
  function fetchOrdersRange(fromIso, toIso, cb) {
    cb(getOrders().filter(function (o) { var c = String(o.createdAt || ''); return c >= fromIso && c <= toIso; }));
  }

  /* ----------------------------------------------------------------------
     Clients, newsletter
     ---------------------------------------------------------------------- */
  function getCustomers() { return read(KEYS.customers, []); }
  function saveCustomers(c) { return write(KEYS.customers, c); }
  function findCustomerByEmail(email) {
    if (!email) return null;
    var list = getCustomers(), e = String(email).trim().toLowerCase();
    for (var i = 0; i < list.length; i++) if (String(list[i].email).trim().toLowerCase() === e) return list[i];
    return null;
  }
  function upsertCustomer(customer) {
    var list = getCustomers(), idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].email).trim().toLowerCase() === String(customer.email).trim().toLowerCase()) { idx = i; break; }
    }
    if (idx >= 0) { for (var k in customer) list[idx][k] = customer[k]; } else list.push(customer);
    saveCustomers(list);
    return customer;
  }
  function getNewsletter() { return read(KEYS.newsletter, []); }
  function saveNewsletter(n) { return write(KEYS.newsletter, n); }
  function addNewsletter(entry) {
    var list = getNewsletter(), e = String(entry.email || '').trim().toLowerCase();
    if (!e) return list;
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].email).trim().toLowerCase() === e) { list[i].active = true; saveNewsletter(list); return list; }
    }
    list.push({ email: e, name: entry.name || '', date: new Date().toISOString(), active: true });
    saveNewsletter(list);
    return list;
  }

  /* ----------------------------------------------------------------------
     Panier, session, table, mes commandes
     ---------------------------------------------------------------------- */
  function getCart() { return read(KEYS.cart, []); }
  function saveCart(c) { write(KEYS.cart, c); emit('cart-updated'); return c; }
  function clearCart() { return saveCart([]); }

  function getSession() { return read(KEYS.session, null); }
  function saveSession(s) { return write(KEYS.session, s); }
  function clearSession() { try { localStorage.removeItem(KEYS.session); } catch (e) {} }

  var TABLE_TTL = 4 * 3600 * 1000; // la table scannée reste mémorisée 4 h
  function getTable() {
    var t = read(KEYS.table, null);
    if (!t || !t.id) return null;
    if (Date.now() - new Date(t.at).getTime() > TABLE_TTL) { clearTable(); return null; }
    return t;
  }
  function saveTable(t) { return write(KEYS.table, { id: t.id, label: t.label, at: new Date().toISOString() }); }
  function clearTable() { try { localStorage.removeItem(KEYS.table); } catch (e) {} }

  function getMyOrders() {
    var list = read(KEYS.myOrders, []);
    var limit = Date.now() - 3 * 24 * 3600 * 1000;
    return list.filter(function (x) { return new Date(x.createdAt).getTime() > limit; });
  }
  function addMyOrder(o) {
    var list = getMyOrders().filter(function (x) { return x.id !== o.id; });
    list.unshift({ id: o.id, number: o.number, createdAt: o.createdAt, total: o.total });
    write(KEYS.myOrders, list.slice(0, 20));
  }

  /* ----------------------------------------------------------------------
     Médias (photos ajoutées dans l'admin) — stockés à part du catalogue pour
     que le menu reste léger et se synchronise toujours.
     ---------------------------------------------------------------------- */
  function getMedia(id) { try { return localStorage.getItem(KEYS.media + id) || ''; } catch (e) { return ''; } }
  function saveMedia(id, dataUrl) {
    try { localStorage.setItem(KEYS.media + id, dataUrl); } catch (e) { console.warn('[MOZAIK] média trop lourd pour le stockage local'); }
    return 'media:' + id;
  }
  function loadMedia(id, cb) { cb(getMedia(id)); } // remplacé par Firebase
  // Résout une source d'image : URL directe ou « media:<id> »
  function resolveImage(src, cb) {
    if (!src) { cb(''); return; }
    if (String(src).indexOf('media:') !== 0) { cb(src); return; }
    var id = String(src).slice(6), local = getMedia(id);
    if (local) { cb(local); return; }
    M.loadMedia(id, function (data) { cb(data || ''); });
  }

  /* ----------------------------------------------------------------------
     Calculs (communs client + admin : les montants sont identiques partout)
     ---------------------------------------------------------------------- */
  function round2(n) { return Math.round((Number(n) || 0) * 100 + 1e-9) / 100; }
  function money(n) { return round2(n).toFixed(2).replace('.', ',') + ' €'; }
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }
  function lineOptionsPrice(line) {
    return round2((line.options || []).reduce(function (s, o) { return s + (Number(o.price) || 0); }, 0));
  }
  function lineUnitPrice(line) { return round2(Number(line.basePrice || 0) + lineOptionsPrice(line)); }
  function lineTotal(line) { return round2(lineUnitPrice(line) * (Number(line.qty) || 0)); }
  function lineOptionsText(line) {
    return (line.options || []).map(function (o) { return o.name + (Number(o.price) ? ' (+' + money(o.price) + ')' : ''); }).join(' · ');
  }

  function findPromo(code, catalog) {
    var c = String(code || '').trim().toUpperCase();
    if (!c) return null;
    var list = (catalog || getCatalog()).promos || [];
    for (var i = 0; i < list.length; i++) if (String(list[i].code).toUpperCase() === c) return list[i];
    return null;
  }
  function validatePromo(code, subtotal, catalog) {
    var p = findPromo(code, catalog);
    if (!p) return { ok: false, error: 'Code inconnu' };
    if (!p.active) return { ok: false, error: 'Ce code n\'est plus actif' };
    if (p.expiresAt && new Date(p.expiresAt + 'T23:59:59').getTime() < Date.now()) return { ok: false, error: 'Ce code a expiré' };
    if (Number(p.minAmount) > 0 && subtotal < Number(p.minAmount)) return { ok: false, error: 'Minimum de commande : ' + money(p.minAmount) };
    return { ok: true, promo: p };
  }

  /* opts : { discountType: 'student'|'loyalty'|'promo'|null, promoCode, fulfillment } */
  function computeTotals(lines, opts, catalog) {
    catalog = catalog || getCatalog();
    opts = opts || {};
    var s = catalog.settings;
    var subtotal = round2((lines || []).reduce(function (sum, l) { return sum + lineTotal(l); }, 0));
    var discount = 0, label = '', type = null, promoCode = '';
    if (opts.discountType === 'student' && s.studentEnabled) {
      type = 'student'; discount = subtotal * (Number(s.studentDiscountPercent) || 0) / 100;
      label = 'Étudiant −' + s.studentDiscountPercent + ' %';
    } else if (opts.discountType === 'loyalty' && s.loyaltyEnabled) {
      type = 'loyalty'; discount = subtotal * (Number(s.loyaltyDiscountPercent) || 0) / 100;
      label = 'Fidélité −' + s.loyaltyDiscountPercent + ' %';
    } else if (opts.discountType === 'promo' && opts.promoCode) {
      var v = validatePromo(opts.promoCode, subtotal, catalog);
      if (v.ok) {
        type = 'promo'; promoCode = v.promo.code;
        discount = v.promo.type === 'percent' ? subtotal * Number(v.promo.value) / 100 : Math.min(Number(v.promo.value), subtotal);
        label = 'Code ' + v.promo.code;
      }
    }
    discount = Math.min(round2(discount), subtotal);
    var delivery = (opts.fulfillment === 'Livraison') ? round2(s.deliveryFee || 0) : 0;
    var total = round2(Math.max(0, subtotal - discount) + delivery);
    return { subtotal: subtotal, discount: discount, discountLabel: label, discountType: type, promoCode: promoCode, delivery: delivery, total: total };
  }

  /* ---------- fidélité (identique à MYKONOS) ---------- */
  function loyaltyStatus(customer, settings) {
    settings = settings || getCatalog().settings;
    var out = { eligible: false, availableAt: null, remainingMs: 0, used: false };
    if (!customer || !settings.loyaltyEnabled) return out;
    if (customer.loyaltyUsed) { out.used = true; return out; }
    if (!customer.firstOrderAt) return out;
    var readyAt = new Date(customer.firstOrderAt).getTime() + (Number(settings.loyaltyDelayHours) || 24) * 3600 * 1000;
    out.availableAt = new Date(readyAt).toISOString();
    if (Date.now() >= readyAt) out.eligible = true; else out.remainingMs = readyAt - Date.now();
    return out;
  }

  /* ---------- horaires ---------- */
  var DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  function hm(str) { var p = String(str || '0:0').split(':'); return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0); }
  function fmtHour(str) { var p = String(str || '').split(':'); return parseInt(p[0], 10) + 'h' + (p[1] && p[1] !== '00' ? p[1] : ''); }
  function openState(settings, date) {
    settings = settings || getCatalog().settings;
    var d = date || new Date(), oh = settings.openingHours || [];
    var today = oh[d.getDay()], mins = d.getHours() * 60 + d.getMinutes();
    var open = !!(today && !today.closed && mins >= hm(today.open) && mins < hm(today.close));
    var next = null;
    if (!open) {
      for (var i = 0; i < 8; i++) {
        var dd = (d.getDay() + i) % 7, h = oh[dd];
        if (!h || h.closed) continue;
        if (i === 0 && mins >= hm(h.open)) continue;
        next = { day: dd, dayLabel: i === 0 ? 'aujourd\'hui' : (i === 1 ? 'demain' : DAYS[dd].toLowerCase()), at: fmtHour(h.open) };
        break;
      }
    }
    return { open: open, today: today, closesAt: today && !today.closed ? fmtHour(today.close) : null, next: next };
  }
  // Texte lisible des horaires, regroupé (ex. « Mer–Sam 9h–20h »)
  function hoursSummary(settings) {
    settings = settings || getCatalog().settings;
    var oh = settings.openingHours || [], order = [1, 2, 3, 4, 5, 6, 0], short = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    var groups = [];
    order.forEach(function (d) {
      var h = oh[d] || { closed: true }, key = h.closed ? 'closed' : h.open + '-' + h.close;
      var g = groups[groups.length - 1];
      if (g && g.key === key) g.days.push(d); else groups.push({ key: key, days: [d], h: h });
    });
    // Regroupe dimanche + lundi s'ils ont les mêmes horaires (« Dim–Lun »)
    if (groups.length > 1 && groups[0].key === groups[groups.length - 1].key) {
      var last = groups.pop(); groups[0].days = last.days.concat(groups[0].days);
    }
    groups.sort(function (a, b) { return (a.h.closed ? 1 : 0) - (b.h.closed ? 1 : 0); });
    return groups.map(function (g) {
      var label = g.days.length > 1 ? short[g.days[0]] + '–' + short[g.days[g.days.length - 1]] : short[g.days[0]];
      if (g.h.closed) return g.days.length === 1 ? 'Fermé le ' + DAYS[g.days[0]].toLowerCase() : label + ' fermé';
      return label + ' ' + fmtHour(g.h.open) + '–' + fmtHour(g.h.close);
    }).join(' · ');
  }

  /* ----------------------------------------------------------------------
     Comptabilité (partagée : tableau de bord, tickets, exports)
     ---------------------------------------------------------------------- */
  var PAY_METHODS = {
    sur_place: 'Paiement sur place', card: 'Carte (en ligne)', apple_pay: 'Apple Pay', google_pay: 'Google Pay',
    cash: 'Espèces', card_tpe: 'Carte bancaire (TPE)', ticket_resto: 'Titre-restaurant', other: 'Autre'
  };
  function orderRefunded(o) { return round2((o.refunds || []).reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0)); }
  function orderNet(o) { return Math.max(0, round2(Number(o.total || 0) - orderRefunded(o))); }
  function isPaid(o) { return !!o.paidAt; }
  function paymentLabel(o) { return PAY_METHODS[o.paidWith] || PAY_METHODS[o.paymentMethod] || '—'; }
  function ts(iso) { var t = new Date(iso).getTime(); return isNaN(t) ? 0 : t; }
  function dayKey(iso) {
    var d = new Date(iso);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  /* Synthèse d'une période [from, to] (millisecondes) :
     • CA (commandes non annulées créées sur la période, remboursements déduits)
     • Encaissé (paiements reçus sur la période − remboursements effectués sur la période)
     • Annulations, remboursements, reste à encaisser, répartition par moyen de paiement */
  function summarize(orders, from, to, vatRate) {
    var r = {
      count: 0, gross: 0, refundsOnSales: 0, net: 0, ht: 0, tva: 0, avg: 0,
      discounts: 0, cancelledCount: 0, cancelledAmount: 0,
      toCollect: 0, toCollectCount: 0,
      collectedGross: 0, refunds: 0, refundsCount: 0, collected: 0,
      byPayment: {}, byDay: {}, byMode: {}, products: {}
    };
    function pay(key) { if (!r.byPayment[key]) r.byPayment[key] = { label: PAY_METHODS[key] || key, in: 0, out: 0, net: 0, count: 0 }; return r.byPayment[key]; }
    (orders || []).forEach(function (o) {
      var t = ts(o.createdAt), inRange = t >= from && t <= to;
      if (inRange) {
        if (o.status === 'Annulée') { r.cancelledCount++; r.cancelledAmount += Number(o.total || 0); }
        else {
          var refunded = orderRefunded(o), net = orderNet(o);
          r.count++; r.gross += Number(o.total || 0); r.refundsOnSales += refunded; r.net += net;
          r.discounts += Number(o.discount || 0);
          var dk = dayKey(o.createdAt);
          if (!r.byDay[dk]) r.byDay[dk] = { count: 0, net: 0 };
          r.byDay[dk].count++; r.byDay[dk].net += net;
          var mode = o.fulfillment || '—';
          if (!r.byMode[mode]) r.byMode[mode] = { count: 0, net: 0 };
          r.byMode[mode].count++; r.byMode[mode].net += net;
          if (!isPaid(o)) { r.toCollect += net; r.toCollectCount++; }
          (o.items || []).forEach(function (l) {
            var k = l.productId || l.name;
            if (!r.products[k]) r.products[k] = { name: l.name, qty: 0, amount: 0 };
            r.products[k].qty += Number(l.qty) || 0; r.products[k].amount += lineTotal(l);
          });
        }
      }
      if (o.paidAt) {
        var pt = ts(o.paidAt);
        if (pt >= from && pt <= to) { r.collectedGross += Number(o.total || 0); var b = pay(o.paidWith || o.paymentMethod || 'other'); b.in += Number(o.total || 0); b.count++; }
      }
      (o.refunds || []).forEach(function (rf) {
        var rt = ts(rf.at);
        if (rt >= from && rt <= to) { r.refunds += Number(rf.amount || 0); r.refundsCount++; pay(rf.method || o.paidWith || 'other').out += Number(rf.amount || 0); }
      });
    });
    ['gross', 'refundsOnSales', 'net', 'discounts', 'cancelledAmount', 'toCollect', 'collectedGross', 'refunds'].forEach(function (k) { r[k] = round2(r[k]); });
    r.collected = round2(r.collectedGross - r.refunds);
    var rate = Number(vatRate) || 0;
    r.ht = round2(r.net / (1 + rate / 100)); r.tva = round2(r.net - r.ht);
    r.avg = r.count ? round2(r.net / r.count) : 0;
    Object.keys(r.byPayment).forEach(function (k) { var b = r.byPayment[k]; b.in = round2(b.in); b.out = round2(b.out); b.net = round2(b.in - b.out); });
    Object.keys(r.byDay).forEach(function (k) { r.byDay[k].net = round2(r.byDay[k].net); });
    return r;
  }

  /* ----------------------------------------------------------------------
     Disponibilité & suggestions (même moteur pour le client et l'aperçu admin)
     ---------------------------------------------------------------------- */
  function findIn(list, id) { for (var i = 0; i < (list || []).length; i++) if (list[i].id === id) return list[i]; return null; }
  function hasPrice(p) { return !!p && p.price !== null && p.price !== undefined && p.price !== '' && !isNaN(Number(p.price)); }
  function isVisible(p, catalog) {
    if (!p || p.active === false) return false;
    var c = findIn(catalog.categories, p.categoryId);
    return !!(c && c.active !== false);
  }
  function isOrderable(p, catalog) { return isVisible(p, catalog) && p.available !== false && hasPrice(p); }
  function computeSuggestions(cart, catalog) {
    catalog = catalog || getCatalog();
    var sg = catalog.suggestions || {};
    if (!sg.enabled || !cart || !cart.length) return { items: [], message: '' };
    var max = Math.max(1, Number(sg.max) || 3), inCart = {}, cats = {};
    cart.forEach(function (l) { inCart[l.productId] = 1; var p = findIn(catalog.products, l.productId); if (p) cats[p.categoryId] = 1; });
    var items = [], seen = {}, message = '';
    function push(id) {
      if (items.length >= max || seen[id] || inCart[id]) return;
      var p = findIn(catalog.products, id);
      if (!p || !isOrderable(p, catalog)) return;
      seen[id] = 1; items.push(p);
    }
    (sg.rules || []).forEach(function (r) {
      if (!r.active) return;
      var hit = (r.triggerProductIds || []).some(function (id) { return inCart[id]; }) ||
                (r.triggerCategoryIds || []).some(function (c) { return cats[c]; });
      if (!hit) return;
      var before = items.length;
      (r.suggestProductIds || []).forEach(push);
      if (!message && items.length > before) message = r.message || '';
    });
    (sg.fallbackProductIds || []).forEach(push);
    return { items: items, message: message };
  }

  /* ----------------------------------------------------------------------
     API publique
     ---------------------------------------------------------------------- */
  var M = global.MOZAIK = {
    VERSION: VERSION, KEYS: KEYS, NS: NS, DEFAULT_CATALOG: DEFAULT_CATALOG,
    getCatalog: getCatalog, saveCatalog: saveCatalog, resetCatalog: resetCatalog, normalize: normalize,
    getOrders: getOrders, saveOrders: saveOrders, addOrder: addOrder, updateOrder: updateOrder,
    deleteOrder: deleteOrder, mergeOrders: mergeOrders, findOrder: findOrder,
    nextOrderNumber: nextOrderNumber, allocateOrderNumber: allocateOrderNumber,
    watchOrder: watchOrder, fetchOrdersRange: fetchOrdersRange,
    getCustomers: getCustomers, saveCustomers: saveCustomers, findCustomerByEmail: findCustomerByEmail, upsertCustomer: upsertCustomer,
    getNewsletter: getNewsletter, saveNewsletter: saveNewsletter, addNewsletter: addNewsletter,
    getCart: getCart, saveCart: saveCart, clearCart: clearCart,
    getSession: getSession, saveSession: saveSession, clearSession: clearSession,
    getTable: getTable, saveTable: saveTable, clearTable: clearTable,
    getMyOrders: getMyOrders, addMyOrder: addMyOrder,
    getMedia: getMedia, saveMedia: saveMedia, loadMedia: loadMedia, resolveImage: resolveImage,
    money: money, round2: round2, uid: uid, clone: clone, emit: emit,
    lineUnitPrice: lineUnitPrice, lineTotal: lineTotal, lineOptionsText: lineOptionsText,
    computeTotals: computeTotals, validatePromo: validatePromo,
    loyaltyStatus: loyaltyStatus, openState: openState, hoursSummary: hoursSummary, DAYS: DAYS, fmtHour: fmtHour,
    sha256: sha256, hashAdminCode: hashAdminCode,
    PAY_METHODS: PAY_METHODS, orderRefunded: orderRefunded, orderNet: orderNet, isPaid: isPaid,
    paymentLabel: paymentLabel, summarize: summarize, dayKey: dayKey,
    hasPrice: hasPrice, isVisible: isVisible, isOrderable: isOrderable, computeSuggestions: computeSuggestions
  };
})(window);
