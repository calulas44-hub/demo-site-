/* ============================================================================
   MIMO – Couche de données partagée (data.js)
   ----------------------------------------------------------------------------
   Source unique de vérité pour le site client ET l'espace gérant (même
   fonctionnement que Mozaïk / MYKONOS) : localStorage côté navigateur,
   synchronisé en temps réel par firebase-sync.js (données sous « mimo/ »).

   La carte par défaut reprend fidèlement la carte affichée chez Mimo (photo
   fournie) : 34 produits, dont 32 aux prix officiels. Deux gâteaux sont indiqués
   « voir ardoise » sans prix (cookie sans gluten, gâteau du jour) : ils sont
   visibles mais non commandables tant que l'admin n'a pas saisi un prix.
   ==========================================================================*/
(function (global) {
  'use strict';

  var VERSION = 1;
  var NS = 'mimo';

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
  function hashAdminCode(code) { return sha256('mimo|' + String(code || '').trim()); }

  /* ----------------------------------------------------------------------
     Options & suppléments (mentions de la carte de Mimo :
     « Nos boissons sont disponibles avec du lait : Amande/Avoine/Coco sans
     supplément » · « Sirops : +0,5 » · « Extra shot : +0,5 »)
     ---------------------------------------------------------------------- */
  var OPTION_GROUPS = [
    { id: 'og_temp', name: 'Chaud ou glacé', type: 'single', required: true,
      help: 'Le latte se sert chaud, ou glacé (Ice Latte).',
      choices: [
        { id: 'c_chaud', name: 'Chaud', price: 0, available: true },
        { id: 'c_glace', name: 'Glacé', price: 0, available: true }
      ] },
    { id: 'og_lait', name: 'Lait végétal', type: 'single', required: false,
      help: 'Amande, avoine ou coco : sans supplément.',
      choices: [
        { id: 'c_amande', name: 'Amande', price: 0, available: true },
        { id: 'c_avoine', name: 'Avoine', price: 0, available: true },
        { id: 'c_coco', name: 'Coco', price: 0, available: true }
      ] },
    { id: 'og_sirop', name: 'Sirop', type: 'single', required: false,
      help: 'Parfums du moment au comptoir : précisez votre envie dans la note de commande.',
      choices: [
        { id: 'c_sirop', name: 'Ajouter un sirop', price: 0.5, available: true }
      ] },
    { id: 'og_extra', name: 'Extra shot', type: 'multi', required: false, help: '',
      choices: [
        { id: 'c_extra_shot', name: 'Extra shot d\'espresso', price: 0.5, available: true }
      ] }
  ];

  /* ----------------------------------------------------------------------
     Carte officielle (photo de la carte de Mimo — prix affichés en boutique)
     « image » / « story » : bloc éditorial de la catégorie sur l'accueil.
     ---------------------------------------------------------------------- */
  var CATEGORIES = [
    { id: 'classiques', name: 'Les classiques', icon: 'espresso', order: 1, active: true,
      description: 'Espresso, cappuccino, flat white, latte chaud ou glacé.',
      kicker: 'Tous les jours', image: 'assets/photos/s-iced-trio.webp',
      imageAlt: 'Iced latte, citronnade et cold brew posés sur un plateau en inox avec un cookie matcha',
      story: 'De l\'espresso au flat white, les essentiels du coffee shop. Le latte se prend chaud ou glacé, avec du lait amande, avoine ou coco sans supplément.' },
    { id: 'coffee', name: 'Coffee', icon: 'glass', order: 2, active: true,
      description: 'Les lattes gourmands de Mimo.',
      kicker: 'Lattes signatures', image: 'assets/photos/s-duo-lattes.webp',
      imageAlt: 'Raspberry latte et peanut butter latte glacés, avec un cookie matcha au chocolat blanc',
      story: 'Vanille de Madagascar et cold foam, miel et fleur de sel, framboise, pistache, beurre de cacahuète ou banana bread et cannelle : six lattes à base d\'espresso.' },
    { id: 'matcha', name: 'Matcha', icon: 'layered', order: 3, active: true,
      description: 'Matcha cérémonie, purées de fruits, coco ou cold foam vanille.',
      kicker: 'Matcha cérémonie', image: 'assets/photos/s-duo-matcha.webp',
      imageAlt: 'Strawberry matcha et peach matcha en trois couches, sur un plateau en inox',
      story: 'Un matcha cérémonie posé sur une purée de fraise, de mangue, de banane ou de pêche — ou adouci à la vanille de Madagascar, à la crème et à l\'eau de coco.' },
    { id: 'sanscafe', name: 'Sans café', icon: 'lemonade', order: 4, active: true,
      description: 'Citronnade et jus frais maison, chocolat chaud, lattes colorés.',
      kicker: '', image: '', imageAlt: '', story: '' },
    { id: 'gateaux', name: 'Gâteaux', icon: 'cookie', order: 5, active: true,
      description: 'Tous nos gâteaux sont faits maison.',
      kicker: 'Faits maison', image: 'assets/photos/s-banana-bread.webp',
      imageAlt: 'Trois parts de banana bread aux pépites de chocolat sur des assiettes en inox',
      story: 'Cookies, marbré, banana bread, carrot cake, brownie sans gluten et gâteau du jour : tous les gâteaux de Mimo sont faits maison.' }
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
  var PH = 'assets/photos/';
  var MILK = ['og_lait', 'og_sirop'];                      // boissons lactées
  var COFFEE = ['og_lait', 'og_sirop', 'og_extra'];       // boissons lactées à base d'espresso
  var MATCHA_GREEN = '#6f9b34';

  var PRODUCTS = [
    // ---- Les classiques
    P('classiques', 'p_espresso', 'Espresso', 2, '', { tint: '#4a2c1a', vessel: 'espresso', optionGroupIds: ['og_extra'] }),
    P('classiques', 'p_double_espresso', 'Double espresso', 2.5, '', { tint: '#4a2c1a', vessel: 'espresso' }),
    P('classiques', 'p_americano', 'Americano', 3, '', { tint: '#5a3620', vessel: 'cup', art: false, optionGroupIds: ['og_sirop', 'og_extra'] }),
    P('classiques', 'p_cappuccino', 'Cappuccino', 4, '', { tint: '#b07a4f', vessel: 'cup', optionGroupIds: COFFEE }),
    P('classiques', 'p_flat_white', 'Flat White', 4.5, '', { tint: '#a8744a', vessel: 'cup', optionGroupIds: COFFEE }),
    P('classiques', 'p_latte', 'Latte / Ice Latte', 4.5, 'Chaud, ou glacé en Ice Latte.',
      { tint: '#b98a5e', vessel: 'glass', temp: 'both', layer: true, image: PH + 'p-iced-latte.webp', optionGroupIds: ['og_temp'].concat(COFFEE) }),
    // Vu dans les stories (« Cold Brew ») mais absent de la carte : masqué, prix à confirmer
    P('classiques', 'p_cold_brew', 'Cold Brew', null, 'Café infusé à froid, servi sur glace.',
      { tint: '#3e2414', vessel: 'glass', temp: 'cold', image: PH + 'p-cold-brew.webp', active: false }),

    // ---- Coffee (lattes signatures, 5,50 €)
    P('coffee', 'p_vanilla_cloud_latte', 'Vanilla Cloud Latte', 5.5, 'Double espresso, vanille de Madagascar, cold foam vanille.',
      { tint: '#d8b98a', vessel: 'glass', temp: 'cold', layer: true, optionGroupIds: COFFEE }),
    P('coffee', 'p_sea_salt_honey_latte', 'Sea Salt Honey Latte', 5.5, 'Double espresso, miel et fleur de sel.',
      { tint: '#c8924a', vessel: 'cup', optionGroupIds: COFFEE }),
    P('coffee', 'p_raspberry_latte', 'Raspberry Latte', 5.5, 'Espresso, purée de framboise.',
      { tint: '#9a6a48', fruit: '#c8283f', vessel: 'layered', temp: 'cold', image: PH + 'p-raspberry-latte.webp', optionGroupIds: COFFEE, featured: true }),
    P('coffee', 'p_pistachio_latte', 'Pistachio Latte', 5.5, 'Espresso, crème de pistache.',
      { tint: '#a4b46a', vessel: 'cup', optionGroupIds: COFFEE }),
    P('coffee', 'p_peanut_butter_latte', 'Peanut Butter Latte', 5.5, 'Espresso, beurre de cacahuète.',
      { tint: '#a9733f', vessel: 'glass', temp: 'cold', layer: true, image: PH + 'p-peanut-butter-latte.webp', optionGroupIds: COFFEE, featured: true }),
    P('coffee', 'p_banana_bread_latte', 'Banana Bread Latte', 5.5, 'Espresso, notes de banana bread et cannelle.',
      { tint: '#a87b4c', vessel: 'glass', temp: 'cold', layer: true, image: PH + 'p-banana-bread-latte.webp', optionGroupIds: COFFEE }),

    // ---- Matcha (6 €)
    P('matcha', 'p_matcha_vanilla_cloud', 'Matcha Vanilla Cloud', 6, 'Matcha cérémonie, vanille de Madagascar, cold foam vanille.',
      { tint: MATCHA_GREEN, fruit: '#f3e6c4', vessel: 'layered', temp: 'cold', optionGroupIds: MILK }),
    P('matcha', 'p_mango_matcha', 'Mango Matcha', 6, 'Matcha cérémonie, purée de mangue.',
      { tint: MATCHA_GREEN, fruit: '#f2a33a', vessel: 'layered', temp: 'cold', optionGroupIds: MILK }),
    P('matcha', 'p_strawberry_matcha', 'Strawberry Matcha', 6, 'Matcha cérémonie, purée de fraise.',
      { tint: MATCHA_GREEN, fruit: '#d6303f', vessel: 'layered', temp: 'cold', image: PH + 'p-strawberry-matcha.webp', optionGroupIds: MILK, featured: true }),
    P('matcha', 'p_banana_matcha', 'Banana Matcha', 6, 'Matcha cérémonie, purée de banane.',
      { tint: MATCHA_GREEN, fruit: '#e8cf8f', vessel: 'layered', temp: 'cold', image: PH + 'p-banana-matcha.webp', optionGroupIds: MILK, featured: true }),
    P('matcha', 'p_peach_matcha', 'Peach Matcha', 6, 'Matcha cérémonie, purée de pêche.',
      { tint: MATCHA_GREEN, fruit: '#f09a7a', vessel: 'layered', temp: 'cold', image: PH + 'p-peach-matcha.webp', optionGroupIds: MILK, featured: true }),
    P('matcha', 'p_matcha_coco_cloud', 'Matcha Coco Cloud', 6, 'Matcha cérémonie, crème de coco, eau de coco.',
      { tint: MATCHA_GREEN, fruit: '#f7f3ea', vessel: 'layered', temp: 'cold', optionGroupIds: MILK }),

    // ---- Sans café
    P('sanscafe', 'p_citronnade', 'Citronnade du moment maison', 3, 'Faite maison, la recette change selon le moment.',
      { tint: '#efe7a2', fruit: '#f4d34c', vessel: 'lemonade', temp: 'cold', image: PH + 'p-citronnade.webp' }),
    P('sanscafe', 'p_jus_frais', 'Jus frais maison', 3, 'Jus frais fait maison.',
      { tint: '#f2a33a', fruit: '#f28c28', vessel: 'lemonade', temp: 'cold' }),
    P('sanscafe', 'p_chocolat_chaud', 'Chocolat chaud', 4.5, '', { tint: '#5a3a28', vessel: 'cup', art: false, optionGroupIds: MILK }),
    P('sanscafe', 'p_chai_latte', 'Chai Latte', 5, '', { tint: '#b9835a', vessel: 'cup', optionGroupIds: MILK }),
    P('sanscafe', 'p_hojicha_latte', 'Hojicha Latte', 5, '', { tint: '#9a6a44', vessel: 'cup', optionGroupIds: MILK }),
    P('sanscafe', 'p_ube_latte', 'Ube Latte', 5, '', { tint: '#8e6bbf', vessel: 'cup', optionGroupIds: MILK }),
    P('sanscafe', 'p_golden_latte', 'Golden Latte', 5, '', { tint: '#e3a72f', vessel: 'cup', optionGroupIds: MILK }),
    P('sanscafe', 'p_black_sesame_latte', 'Black Sesame Latte', 5, '', { tint: '#6b6560', vessel: 'cup', optionGroupIds: MILK }),

    // ---- Gâteaux (3,50 €) — « Tous nos gâteaux sont faits maison »
    P('gateaux', 'p_cookie_chocolat', 'Cookie chocolat noir / fleur de sel', 3.5, '',
      { tint: '#d9a56a', fruit: '#3a2416', vessel: 'cookie', tags: ['Fait maison'] }),
    P('gateaux', 'p_cookie_matcha', 'Cookie matcha / chocolat blanc', 3.5, '',
      { tint: '#a8b46a', fruit: '#fbf3df', vessel: 'cookie', tags: ['Fait maison'], image: PH + 'p-cookie-matcha.webp', featured: true }),
    P('gateaux', 'p_marbre', 'Marbré', 3.5, '', { tint: '#e2c59a', fruit: '#5a3a28', vessel: 'loaf', tags: ['Fait maison'] }),
    P('gateaux', 'p_banana_bread', 'Banana bread', 3.5, '',
      { tint: '#b98552', vessel: 'loaf', tags: ['Fait maison'], image: PH + 'p-banana-bread.webp', featured: true }),
    P('gateaux', 'p_carrot_cake', 'Carrot Cake', 3.5, '', { tint: '#d49a5c', fruit: '#f28c28', vessel: 'slice', tags: ['Fait maison'] }),
    // Prix non indiqué sur la carte (« voir ardoise ») : visible, non commandable
    P('gateaux', 'p_cookie_sans_gluten', 'Cookie sans gluten', null, 'Parfum du moment : voir l\'ardoise en boutique.',
      { tint: '#d9a56a', fruit: '#3a2416', vessel: 'cookie', tags: ['Fait maison', 'Sans gluten'] }),
    P('gateaux', 'p_brownie_sans_gluten', 'Brownie sans gluten', 3.5, '', { tint: '#4a2c1e', vessel: 'brownie', tags: ['Fait maison', 'Sans gluten'] }),
    P('gateaux', 'p_gateau_du_jour', 'Gâteau du jour', null, 'Voir l\'ardoise en boutique.', { tint: '#e8c48a', vessel: 'slice', tags: ['Fait maison'] })
  ];

  /* ----------------------------------------------------------------------
     Suggestions du panier (modifiables dans l'admin)
     Les produits sans prix / indisponibles / déjà au panier sont ignorés.
     ---------------------------------------------------------------------- */
  var SUGGESTIONS = {
    enabled: true,
    afterAdd: true,
    max: 3,
    title: 'Avec ça, un petit plaisir ?',
    rules: [
      { id: 'sg_matcha', name: 'Matcha → cookie matcha', active: true,
        triggerCategoryIds: ['matcha'], triggerProductIds: [],
        suggestProductIds: ['p_cookie_matcha', 'p_banana_bread', 'p_cookie_chocolat'],
        message: 'Un cookie matcha / chocolat blanc avec votre matcha ?' },
      { id: 'sg_boisson', name: 'Boisson → gâteau fait maison', active: true,
        triggerCategoryIds: ['classiques', 'coffee', 'sanscafe'], triggerProductIds: [],
        suggestProductIds: ['p_banana_bread', 'p_cookie_chocolat', 'p_cookie_matcha', 'p_carrot_cake'],
        message: 'Une part de gâteau fait maison avec votre boisson ?' },
      { id: 'sg_gateau', name: 'Gâteau → boisson', active: true,
        triggerCategoryIds: ['gateaux'], triggerProductIds: [],
        suggestProductIds: ['p_latte', 'p_strawberry_matcha', 'p_vanilla_cloud_latte'],
        message: 'Et une boisson pour l\'accompagner ?' }
    ],
    // Complément quand les règles ne suffisent pas
    fallbackProductIds: ['p_banana_bread', 'p_cookie_chocolat', 'p_strawberry_matcha']
  };

  /* ----------------------------------------------------------------------
     Catalogue par défaut
     ---------------------------------------------------------------------- */
  var OLD_ADDRESS = '5 rue Château de l\'Horloge, 13090 Aix-en-Provence';
  var DEFAULT_CATALOG = {
    version: VERSION,
    settings: {
      restaurantName: 'Mimo',
      tagline: 'Coffee shop',
      slogan: 'Matcha, lattes & gâteaux faits maison.',
      phone: '',
      // Adresse confirmée (siège et établissement, RNE)
      address: '62 rue Boulegon, 13100 Aix-en-Provence',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Mimo+coffee+shop+62+rue+Boulegon+13100+Aix-en-Provence',
      email: '',
      instagram: 'mimo.aix',
      // 0 = dimanche … 6 = samedi — Love Spots : du mercredi au lundi 10h–18h, fermé le mardi
      openingHours: [
        { open: '10:00', close: '18:00', closed: false },
        { open: '10:00', close: '18:00', closed: false },
        { open: '10:00', close: '18:00', closed: true },
        { open: '10:00', close: '18:00', closed: false },
        { open: '10:00', close: '18:00', closed: false },
        { open: '10:00', close: '18:00', closed: false },
        { open: '10:00', close: '18:00', closed: false }
      ],
      adminCodeHash: hashAdminCode('6466'),
      currency: '€',
      siteUrl: '',
      // Commandes
      ordersPaused: false,
      restrictToOpeningHours: false,
      fulfillment: ['Sur place', 'À emporter'],
      deliveryFee: 0,
      // Offres : désactivées par défaut (aucune offre n'est annoncée par Mimo)
      studentEnabled: false,
      studentDiscountPercent: 10,
      loyaltyEnabled: false,
      loyaltyDiscountPercent: 10,
      loyaltyDelayHours: 24,
      // E-mails (EmailJS) — même compte que MYKONOS / Mozaïk : les modèles
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
      vatRate: 10,
      // Mentions légales (affichées sur mentions-legales.html) — source : RNE / Insee
      // via societe.com (mise à jour du 13/10/2026). E-mail et médiateur : à compléter.
      legal: {
        companyName: 'MIMO', legalForm: 'Société à responsabilité limitée (SARL)', capital: '5 000 €',
        siret: '103 217 048 00018', rcs: 'SIREN 103 217 048 — immatriculée au RNE le 2 avril 2026',
        vatNumber: 'FR93103217048', headOffice: '62 rue Boulegon, 13100 Aix-en-Provence',
        director: 'Chloé Serre, gérante', contactEmail: '', contactPhone: '', mediator: ''
      }
    },

    content: {
      announcement: '',
      // Bandeau défilant : ingrédients et mentions relevés sur la carte de Mimo
      marquee: [
        'Matcha cérémonie',
        'Vanille de Madagascar',
        'Miel & fleur de sel',
        'Purée de framboise',
        'Crème de pistache',
        'Beurre de cacahuète',
        'Ube · Hojicha · Sésame noir',
        'Gâteaux faits maison',
        'Lait amande, avoine ou coco sans supplément'
      ],
      heroKicker: 'Coffee shop · Aix-en-Provence',
      heroTitle: 'Matcha. Latte. Cookie.',
      heroText: 'Des matchas cérémonie aux purées de fruits, des lattes gourmands et des gâteaux faits maison. Commandez depuis votre table, ou à emporter.',
      heroImage: '',
      heroBadge: 'Gâteaux faits maison',
      featuredTitle: 'Les incontournables',
      featuredText: 'Les boissons et douceurs que Mimo met à l\'honneur, photographiées telles qu\'elles sont servies.',
      menuTitle: 'La carte',
      menuText: 'Les prix sont ceux de la carte affichée chez Mimo. Lait amande, avoine ou coco sans supplément · sirop +0,50 € · extra shot +0,50 €.',
      experienceKicker: 'L\'expérience Mimo',
      storyTitle: 'Derrière la façade jaune',
      storyText: 'Mimo, c\'est le coffee shop de Chloé à Aix-en-Provence. Derrière une façade jaune qu\'on ne peut pas rater : des matchas en couches, des lattes gourmands et des gâteaux faits maison, à savourer sur place ou à emporter.',
      teamNames: 'Chloé',
      pillars: ['Gâteaux faits maison', 'Matcha cérémonie', 'Lait végétal sans supplément', 'Sur place ou à emporter'],
      stepsTitle: 'Commander à table, en 1 minute',
      steps: [
        'Scannez le QR code posé sur votre table',
        'Choisissez et personnalisez votre boisson',
        'Validez : la commande part directement au comptoir',
        'Suivez sa préparation en direct sur votre téléphone'
      ],
      eventsTitle: '',
      eventsText: '',
      galleryTitle: 'Univers Mimo',
      galleryText: 'Plateaux en inox, verres en couches et parts de banana bread : un aperçu en images. La suite sur Instagram.',
      ctaTitle: 'Un matcha vous attend.',
      ctaText: 'Commandez en ligne depuis votre table, ou passez simplement nous voir.',
      studentText: 'Sur présentation de votre carte étudiante au comptoir.',
      thanksText: 'Merci ! Belle dégustation ☀️'
    },

    categories: CATEGORIES,
    products: PRODUCTS,
    optionGroups: OPTION_GROUPS,
    suggestions: SUGGESTIONS,

    // Nombre de tables à confirmer (Love Spots mentionne une terrasse)
    tables: [
      { id: '1', label: 'Table 1', zone: 'Salle', active: true },
      { id: '2', label: 'Table 2', zone: 'Salle', active: true },
      { id: '3', label: 'Table 3', zone: 'Salle', active: true },
      { id: '4', label: 'Table 4', zone: 'Salle', active: true },
      { id: 'T1', label: 'Terrasse 1', zone: 'Terrasse', active: true },
      { id: 'T2', label: 'Terrasse 2', zone: 'Terrasse', active: true }
    ],

    promos: []
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
    catch (e) { console.warn('[MIMO] stockage indisponible', e); return false; }
  }
  function emit(name, detail) { try { global.dispatchEvent(new CustomEvent('mimo:' + name, { detail: detail })); } catch (e) {} }

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
    if (!stored.settings.legal || typeof stored.settings.legal !== 'object') stored.settings.legal = {};
    for (k in DEFAULT_CATALOG.settings.legal) {
      if (!stored.settings.legal[k]) stored.settings.legal[k] = DEFAULT_CATALOG.settings.legal[k];
    }
    // Ancienne adresse provisoire (Love Spots) → adresse confirmée
    if (stored.settings.address === OLD_ADDRESS) {
      stored.settings.address = DEFAULT_CATALOG.settings.address;
      stored.settings.mapsUrl = DEFAULT_CATALOG.settings.mapsUrl;
    }
    delete stored.settings.showTurkish;
    stored.categories.forEach(function (c) { ['kicker', 'image', 'imageAlt', 'story', 'description'].forEach(function (f) { if (c[f] === undefined || c[f] === null) c[f] = ''; }); });
    if (!Array.isArray(stored.settings.openingHours) || stored.settings.openingHours.length !== 7) stored.settings.openingHours = clone(DEFAULT_CATALOG.settings.openingHours);
    if (!Array.isArray(stored.settings.fulfillment) || !stored.settings.fulfillment.length) stored.settings.fulfillment = clone(DEFAULT_CATALOG.settings.fulfillment);
    ['marquee', 'steps', 'pillars'].forEach(function (f) { if (!Array.isArray(stored.content[f])) stored.content[f] = []; });
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
    try { localStorage.setItem(KEYS.media + id, dataUrl); } catch (e) { console.warn('[MIMO] média trop lourd pour le stockage local'); }
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
  var M = global.MIMO = {
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
