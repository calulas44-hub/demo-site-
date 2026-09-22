/* ============================================================================
   MYKONOS – Application client (client.js)
   Parcours : Accueil → produit → personnalisation → panier → Menu +1€ →
   validation → compte facultatif → commande → confirmation + e-mail.
   ==========================================================================*/
(function () {
  'use strict';
  var M = window.MYKONOS;

  /* ---------- état ---------- */
  var catalog = M.getCatalog();
  var modalState = null;   // config produit en cours dans la modale
  var checkoutState = null;

  /* ---------- moyens de paiement ---------- */
  var PAYMENTS = [
    { id: 'sur_place',  emoji: '💶', label: 'Paiement sur place', desc: 'Vous réglez au retrait / sur place' },
    { id: 'card',       emoji: '💳', label: 'Carte bancaire',     desc: 'Visa, Mastercard, CB' },
    { id: 'apple_pay',  emoji: '🍎', label: 'Apple Pay',          desc: 'iPhone / Mac' },
    { id: 'google_pay', emoji: '📲', label: 'Google Pay',         desc: 'Android' }
  ];
  function isOnlinePay(id) { return id === 'card' || id === 'apple_pay' || id === 'google_pay'; }
  function onlineReady() { var s = catalog.settings; return !!(s.stripe_enabled && s.stripe_publishableKey); }

  /* ---------- utilitaires ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function money(n) { return M.money(n); }

  function toast(msg, type) {
    var wrap = el('toastWrap');
    var t = document.createElement('div');
    t.className = 'toast ' + (type || 'ok');
    t.innerHTML = (type === 'err' ? '⚠️ ' : (type === 'info' ? 'ℹ️ ' : '✅ ')) + esc(msg);
    wrap.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; }, 2600);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3000);
  }

  function reloadCatalog() { catalog = M.getCatalog(); }

  /* ---------- rendu infos / réglages ---------- */
  function renderStaticInfo() {
    var s = catalog.settings;
    if (el('heroHours')) el('heroHours').innerHTML = '🕒 ' + esc(s.hours);
    if (el('infoAddress')) el('infoAddress').textContent = s.address;
    if (el('infoHours')) el('infoHours').textContent = s.hours;
    if (el('infoContact')) el('infoContact').innerHTML = '📞 ' + esc(s.phone) + '<br>✉️ ' + esc(s.email);
    if (el('footerInfos')) el('footerInfos').innerHTML = esc(s.address) + '<br>' + esc(s.phone) + '<br>' + esc(s.hours);
    if (el('year')) el('year').textContent = new Date().getFullYear();
    // Offre visible / masquée
    if (!s.menuUpgradeEnabled) { var o = el('offre'); if (o) o.style.display = 'none'; }
  }

  /* ---------- MENU ---------- */
  function sortedCategories() {
    return catalog.categories.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }
  function productsOf(catId) {
    return catalog.products
      .filter(function (p) { return p.categoryId === catId; })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }
  function availableDrinks() { return catalog.drinks.filter(function (d) { return d.available; }); }

  function productMediaHTML(p) {
    if (p.image) return '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">';
    return esc(p.emoji || '🍽️');
  }

  function productCardHTML(p) {
    var tags = [];
    if (p.menuEligible && catalog.settings.menuUpgradeEnabled) tags.push('<span class="pill pill--gold">Menu +1€</span>');
    if (p.customizable) tags.push('<span class="pill pill--muted">Personnalisable</span>');
    var soldout = !p.available;
    return '' +
      '<article class="product-card">' +
        '<div class="product-media">' + productMediaHTML(p) +
          (soldout ? '<div class="unavailable">Épuisé</div>' : '') +
        '</div>' +
        '<div class="product-body">' +
          '<h4>' + esc(p.name) + '</h4>' +
          '<p class="product-desc">' + esc(p.description || '') + '</p>' +
          (tags.length ? '<div class="tag-row">' + tags.join('') + '</div>' : '') +
          '<div class="product-foot">' +
            '<span class="price">' + money(p.price) + '</span>' +
            (soldout
              ? '<button class="btn btn--sm" disabled>Indisponible</button>'
              : '<button class="btn btn--red btn--sm" data-add-product="' + esc(p.id) + '">+ Ajouter</button>') +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function drinkCardHTML(d) {
    return '' +
      '<article class="product-card">' +
        '<div class="product-media">' + (d.alcohol ? '🍺' : '🥤') + '</div>' +
        '<div class="product-body">' +
          '<h4>' + esc(d.name) + '</h4>' +
          '<p class="product-desc">' + (d.alcohol ? 'Boisson alcoolisée · vente interdite aux -18 ans.' : 'Boisson fraîche.') + '</p>' +
          '<div class="product-foot">' +
            '<span class="price">' + money(d.price) + '</span>' +
            '<button class="btn btn--red btn--sm" data-add-drink="' + esc(d.id) + '">+ Ajouter</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function renderMenu() {
    var cats = sortedCategories();
    var bar = el('catBar');
    var cont = el('menuContainer');
    var chips = '', html = '';

    cats.forEach(function (c) {
      var prods = productsOf(c.id);
      if (!prods.length) return;
      chips += '<button class="cat-chip" data-cat="' + esc(c.id) + '">' + esc(c.emoji || '') + ' ' + esc(c.name) + '</button>';
      html += '<div class="section-title-row" id="cat-' + esc(c.id) + '"><span class="em">' + esc(c.emoji || '') + '</span><h3>' + esc(c.name) + '</h3></div>';
      html += '<div class="menu-grid">' + prods.map(productCardHTML).join('') + '</div>';
    });

    // Boissons (depuis la liste unique des boissons)
    var drinks = availableDrinks();
    if (drinks.length) {
      chips += '<button class="cat-chip" data-cat="boissons">🥤 Boissons</button>';
      html += '<div class="section-title-row" id="cat-boissons"><span class="em">🥤</span><h3>Boissons</h3></div>';
      html += '<div class="menu-grid">' + drinks.map(drinkCardHTML).join('') + '</div>';
    }

    bar.innerHTML = chips;
    cont.innerHTML = html || '<p style="text-align:center;color:var(--muted)">Le menu est momentanément indisponible.</p>';

    // clic chips → scroll
    Array.prototype.forEach.call(bar.querySelectorAll('.cat-chip'), function (chip) {
      chip.addEventListener('click', function () {
        var t = el('cat-' + chip.getAttribute('data-cat'));
        if (t) { var y = t.getBoundingClientRect().top + window.pageYOffset - 130; window.scrollTo({ top: y, behavior: 'smooth' }); }
      });
    });

    // boutons ajouter
    Array.prototype.forEach.call(cont.querySelectorAll('[data-add-product]'), function (b) {
      b.addEventListener('click', function () { openProductModal(b.getAttribute('data-add-product')); });
    });
    Array.prototype.forEach.call(cont.querySelectorAll('[data-add-drink]'), function (b) {
      b.addEventListener('click', function () { addDrinkFromMenu(b.getAttribute('data-add-drink')); });
    });

    setupCatSpy();
  }

  function setupCatSpy() {
    var chips = el('catBar').querySelectorAll('.cat-chip');
    function onScroll() {
      var pos = window.pageYOffset + 150, current = null;
      Array.prototype.forEach.call(chips, function (chip) {
        var t = el('cat-' + chip.getAttribute('data-cat'));
        if (t && t.offsetTop <= pos) current = chip;
      });
      Array.prototype.forEach.call(chips, function (c) { c.classList.remove('active'); });
      if (current) current.classList.add('active');
    }
    window.removeEventListener('scroll', window.__catSpy || function () {});
    window.__catSpy = onScroll;
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- MODALE générique ---------- */
  function openModal(html) {
    el('modal').innerHTML = html;
    el('modalWrap').classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    el('modalWrap').classList.remove('show');
    document.body.style.overflow = '';
    modalState = null;
  }

  /* ---------- MODALE produit (personnalisation) ---------- */
  function findProduct(id) {
    for (var i = 0; i < catalog.products.length; i++) if (catalog.products[i].id === id) return catalog.products[i];
    return null;
  }
  function findDrink(id) {
    for (var i = 0; i < catalog.drinks.length; i++) if (catalog.drinks[i].id === id) return catalog.drinks[i];
    return null;
  }

  function openProductModal(productId) {
    var p = findProduct(productId);
    if (!p || !p.available) return;

    var needsModal = p.customizable || (p.bread && p.bread.length > 1) ||
                     (p.menuEligible && catalog.settings.menuUpgradeEnabled);

    // init config
    var crud = {};
    if (p.customizable) {
      catalog.crudites.filter(function (c) { return c.available; }).forEach(function (c) {
        crud[c.id] = (c.defaultOn !== false); // true = avec
      });
    }
    modalState = {
      product: p,
      qty: 1,
      bread: (p.bread && p.bread.length) ? p.bread[0] : null,
      sauces: [],
      crudites: crud,
      isMenu: false,
      drinkId: null,
      ageOk: false
    };

    if (!needsModal) { // ajout direct (frites, desserts…)
      addToCartFromState();
      toast(p.name + ' ajouté au panier');
      return;
    }
    renderProductModal();
  }

  function renderProductModal() {
    var p = modalState.product, s = catalog.settings;
    var mediaHTML = p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '">' : esc(p.emoji || '🍽️');

    var html = '' +
      '<div class="modal-head">' +
        '<div class="modal-hero">' + mediaHTML + '</div>' +
        '<button class="modal-close" data-close>✕</button>' +
      '</div>' +
      '<div class="modal-body">' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<p class="m-desc">' + esc(p.description || '') + '</p>';

    // Pain / galette
    if (p.bread && p.bread.length) {
      if (p.bread.length > 1) {
        html += '<div class="opt-group"><h5>🥖 Pain ou galette</h5><div class="radio-row" id="breadGroup">';
        p.bread.forEach(function (b) {
          html += '<button class="opt-chip ' + (modalState.bread === b ? 'selected' : '') + '" data-bread="' + b + '">' + (b === 'pain' ? 'Pain' : 'Galette') + '</button>';
        });
        html += '</div></div>';
      } else {
        html += '<div class="opt-group"><h5>🥖 Base</h5><span class="pill pill--muted">Servi ' + (p.bread[0] === 'galette' ? 'en galette' : 'dans son pain') + '</span></div>';
      }
    }

    // Sauces
    if (p.customizable) {
      var sauces = catalog.sauces.filter(function (x) { return x.available; });
      if (sauces.length) {
        html += '<div class="opt-group"><h5>🌶️ Sauces <span style="text-transform:none;font-weight:600">(plusieurs possibles)</span></h5><div class="chip-set" id="sauceGroup">';
        sauces.forEach(function (sa) {
          html += '<button class="opt-chip" data-sauce="' + esc(sa.id) + '">' + esc(sa.name) + '</button>';
        });
        html += '</div></div>';
      }

      // Crudités
      var crud = catalog.crudites.filter(function (x) { return x.available; });
      if (crud.length) {
        html += '<div class="opt-group"><h5>🥗 Crudités</h5>';
        crud.forEach(function (c) {
          var on = modalState.crudites[c.id];
          html += '' +
            '<div class="crud-row">' +
              '<span class="name">' + esc(c.name) + '</span>' +
              '<span class="seg" data-crud="' + esc(c.id) + '">' +
                '<button data-v="yes" class="' + (on ? 'on-yes' : '') + '">Avec</button>' +
                '<button data-v="no" class="' + (!on ? 'on-no' : '') + '">Sans</button>' +
              '</span>' +
            '</div>';
        });
        html += '</div>';
      }
    }

    // Menu +1€
    if (p.menuEligible && s.menuUpgradeEnabled) {
      html += '' +
        '<div class="opt-group">' +
          '<div class="upsell" style="margin:0">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">' +
              '<div><div class="u-title">🍟 Passer en MENU</div><div class="u-sub">+ 1 boisson au choix pour ' + money(s.menuUpgradePrice) + ' de plus</div></div>' +
              '<label class="switch"><input type="checkbox" id="menuToggle" ' + (modalState.isMenu ? 'checked' : '') + '><span class="slider"></span></label>' +
            '</div>' +
            '<div id="menuDrinkArea" class="' + (modalState.isMenu ? '' : 'hidden') + '" style="margin-top:12px"></div>' +
          '</div>' +
        '</div>';
    }

    // Quantité
    html += '' +
      '<div class="opt-group"><h5>Quantité</h5>' +
        '<div class="qty" style="border:1px solid var(--line)">' +
          '<button data-qty="-1">−</button><span id="mQty">' + modalState.qty + '</span><button data-qty="1">+</button>' +
        '</div>' +
      '</div>';

    html += '</div>' + // modal-body
      '<div class="modal-foot">' +
        '<button class="btn btn--ghost" data-close>Annuler</button>' +
        '<button class="btn btn--red btn--block" id="addToCartBtn">Ajouter · <span id="mPrice">' + money(currentModalPrice()) + '</span></button>' +
      '</div>';

    openModal(html);
    bindProductModal();
    if (modalState.isMenu) renderMenuDrinkArea();
  }

  function currentModalPrice() {
    var p = modalState.product;
    var unit = Number(p.price) + (modalState.isMenu ? Number(catalog.settings.menuUpgradePrice) : 0);
    return unit * modalState.qty;
  }
  function refreshModalPrice() {
    var mp = el('mPrice'); if (mp) mp.textContent = money(currentModalPrice());
    var addBtn = el('addToCartBtn');
    if (addBtn) {
      var blocked = modalState.isMenu && needsAgeCheck() && !modalState.ageOk;
      addBtn.disabled = blocked;
    }
  }
  function needsAgeCheck() {
    if (!modalState.isMenu || !modalState.drinkId) return false;
    var d = findDrink(modalState.drinkId);
    return !!(d && d.alcohol);
  }

  function renderMenuDrinkArea() {
    var area = el('menuDrinkArea');
    if (!area) return;
    var drinks = availableDrinks();
    var html = '<div class="u-sub" style="margin-bottom:6px;font-weight:700;color:#7a5a00">Choisis ta boisson :</div><div class="chip-set" id="menuDrinkGroup">';
    drinks.forEach(function (d) {
      html += '<button class="opt-chip ' + (modalState.drinkId === d.id ? 'selected' : '') + '" data-drink="' + esc(d.id) + '">' + (d.alcohol ? '🍺 ' : '') + esc(d.name) + '</button>';
    });
    html += '</div>';
    if (needsAgeCheck()) {
      html += '' +
        '<div class="alcohol-note">🔞 <b>Boisson alcoolisée.</b> La vente d\'alcool est interdite aux mineurs de moins de 18 ans.' +
          '<label><input type="checkbox" id="ageCheck" ' + (modalState.ageOk ? 'checked' : '') + '> Je certifie avoir 18 ans ou plus.</label>' +
        '</div>';
    }
    area.innerHTML = html;
    Array.prototype.forEach.call(area.querySelectorAll('[data-drink]'), function (b) {
      b.addEventListener('click', function () {
        modalState.drinkId = b.getAttribute('data-drink');
        modalState.ageOk = false;
        renderMenuDrinkArea();
        refreshModalPrice();
      });
    });
    var ac = el('ageCheck');
    if (ac) ac.addEventListener('change', function () { modalState.ageOk = ac.checked; refreshModalPrice(); });
    refreshModalPrice();
  }

  function bindProductModal() {
    var modal = el('modal');
    Array.prototype.forEach.call(modal.querySelectorAll('[data-close]'), function (b) {
      b.addEventListener('click', closeModal);
    });
    // pain
    Array.prototype.forEach.call(modal.querySelectorAll('[data-bread]'), function (b) {
      b.addEventListener('click', function () {
        modalState.bread = b.getAttribute('data-bread');
        Array.prototype.forEach.call(modal.querySelectorAll('[data-bread]'), function (x) { x.classList.remove('selected'); });
        b.classList.add('selected');
      });
    });
    // sauces
    Array.prototype.forEach.call(modal.querySelectorAll('[data-sauce]'), function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-sauce');
        var i = modalState.sauces.indexOf(id);
        if (i >= 0) { modalState.sauces.splice(i, 1); b.classList.remove('selected'); }
        else { modalState.sauces.push(id); b.classList.add('selected'); }
      });
    });
    // crudités
    Array.prototype.forEach.call(modal.querySelectorAll('[data-crud]'), function (seg) {
      var id = seg.getAttribute('data-crud');
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function (btn) {
        btn.addEventListener('click', function () {
          var v = btn.getAttribute('data-v') === 'yes';
          modalState.crudites[id] = v;
          seg.querySelector('[data-v="yes"]').classList.toggle('on-yes', v);
          seg.querySelector('[data-v="no"]').classList.toggle('on-no', !v);
        });
      });
    });
    // menu toggle
    var mt = el('menuToggle');
    if (mt) mt.addEventListener('change', function () {
      modalState.isMenu = mt.checked;
      if (modalState.isMenu && !modalState.drinkId) {
        var d = availableDrinks(); modalState.drinkId = d.length ? d[0].id : null;
      }
      el('menuDrinkArea').classList.toggle('hidden', !modalState.isMenu);
      if (modalState.isMenu) renderMenuDrinkArea();
      refreshModalPrice();
    });
    // quantité
    Array.prototype.forEach.call(modal.querySelectorAll('[data-qty]'), function (b) {
      b.addEventListener('click', function () {
        var delta = parseInt(b.getAttribute('data-qty'), 10);
        modalState.qty = Math.max(1, modalState.qty + delta);
        el('mQty').textContent = modalState.qty;
        refreshModalPrice();
      });
    });
    // ajouter
    el('addToCartBtn').addEventListener('click', function () {
      if (modalState.isMenu && !modalState.drinkId) { toast('Choisis ta boisson pour le menu', 'info'); return; }
      if (needsAgeCheck() && !modalState.ageOk) { toast('Confirme que tu as 18 ans ou plus', 'err'); return; }
      addToCartFromState();
      var p = modalState.product;
      var hadMenuDrink = !!(modalState.isMenu && modalState.drinkId);
      toast(p.name + ' ajouté au panier');
      // Après un plat principal : proposer boisson → accompagnement → dessert
      if (isMainDish(p)) { startUpsell(hadMenuDrink); }
      else { closeModal(); openCart(); }
    });
  }

  /* ---------- construction ligne panier ---------- */
  function buildLineFromState() {
    var p = modalState.product;
    var sauceNames = modalState.sauces.map(function (id) {
      var s = catalog.sauces.filter(function (x) { return x.id === id; })[0]; return s ? s.name : '';
    }).filter(Boolean);
    var crudRemoved = [], crudKept = [];
    catalog.crudites.filter(function (c) { return c.available; }).forEach(function (c) {
      if (modalState.crudites[c.id]) crudKept.push(c.name); else crudRemoved.push(c.name);
    });
    var drink = modalState.isMenu && modalState.drinkId ? findDrink(modalState.drinkId) : null;
    return {
      uid: M.uid('line'),
      productId: p.id,
      name: p.name,
      emoji: p.emoji,
      image: p.image,
      basePrice: Number(p.price),
      qty: modalState.qty,
      bread: (p.bread && p.bread.length) ? modalState.bread : null,
      sauces: sauceNames,
      crudRemoved: crudRemoved,
      crudKept: crudKept,
      isMenu: !!drink,
      menuUpgrade: drink ? Number(catalog.settings.menuUpgradePrice) : 0,
      drink: drink ? { id: drink.id, name: drink.name, alcohol: !!drink.alcohol } : null,
      kind: 'product'
    };
  }
  function lineUnitPrice(line) { return Number(line.basePrice) + Number(line.menuUpgrade || 0); }
  function lineTotal(line) { return lineUnitPrice(line) * line.qty; }

  function addToCartFromState() {
    var cart = M.getCart();
    cart.push(buildLineFromState());
    M.saveCart(cart);
  }

  function addDrinkFromMenu(drinkId) {
    var d = findDrink(drinkId);
    if (!d || !d.available) return;
    if (d.alcohol) { openAlcoholConfirm(d); return; }
    pushDrinkLine(d);
    toast(d.name + ' ajouté au panier');
  }
  function openAlcoholConfirm(d) {
    var html = '' +
      '<div class="modal-body" style="padding-top:22px">' +
        '<h3>🔞 ' + esc(d.name) + '</h3>' +
        '<p class="m-desc">Boisson alcoolisée. La vente d\'alcool est interdite aux mineurs de moins de 18 ans (article L.3342-1 du Code de la santé publique).</p>' +
        '<div class="alcohol-note"><label><input type="checkbox" id="ageConfirm"> Je certifie avoir <b>18 ans ou plus</b>.</label></div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn btn--ghost" data-close>Annuler</button>' +
        '<button class="btn btn--red btn--block" id="confirmAlcohol" disabled>Ajouter ' + money(d.price) + '</button>' +
      '</div>';
    openModal(html);
    var modal = el('modal');
    Array.prototype.forEach.call(modal.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', closeModal); });
    el('ageConfirm').addEventListener('change', function () { el('confirmAlcohol').disabled = !this.checked; });
    el('confirmAlcohol').addEventListener('click', function () {
      pushDrinkLine(d); closeModal(); toast(d.name + ' ajouté au panier');
    });
  }
  function pushDrinkLine(d) {
    var cart = M.getCart();
    cart.push({
      uid: M.uid('line'), productId: d.id, name: d.name, emoji: d.alcohol ? '🍺' : '🥤', image: '',
      basePrice: Number(d.price), qty: 1, bread: null, sauces: [], crudRemoved: [], crudKept: [],
      isMenu: false, menuUpgrade: 0, drink: null, kind: 'drink', alcohol: !!d.alcohol
    });
    M.saveCart(cart);
  }

  /* ---------- Produits simples ajoutés en extra (accompagnement / dessert) ---------- */
  function pushProductLine(p) {
    var cart = M.getCart();
    cart.push({
      uid: M.uid('line'), productId: p.id, name: p.name, emoji: p.emoji || '🍽️', image: p.image || '',
      basePrice: Number(p.price), qty: 1, bread: null, sauces: [], crudRemoved: [], crudKept: [],
      isMenu: false, menuUpgrade: 0, drink: null, kind: 'extra'
    });
    M.saveCart(cart);
  }
  function productsInCat(catId) { return catalog.products.filter(function (p) { return p.categoryId === catId && p.available; }); }
  function isMainDish(p) { return !!p && p.categoryId !== 'sides' && p.categoryId !== 'desserts'; }

  /* =========================================================================
     Parcours de propositions complémentaires : boisson → accompagnement → dessert
     Chaque étape est facultative (Ajouter ou Passer). Fin → retour au panier.
     ========================================================================= */
  var upsellState = null;
  var UPSELL_CFG = {
    drink:   { emoji: '🥤', title: 'Boisson',        q: 'Souhaitez-vous ajouter une boisson ?',      kind: 'drink' },
    side:    { emoji: '🍟', title: 'Accompagnement', q: 'Souhaitez-vous ajouter un accompagnement ?', kind: 'product' },
    dessert: { emoji: '🍰', title: 'Dessert',        q: 'Souhaitez-vous ajouter un dessert ?',        kind: 'product' }
  };
  function startUpsell(skipDrink) {
    var steps = [];
    if (!skipDrink && availableDrinks().length) steps.push('drink');
    if (productsInCat('sides').length) steps.push('side');
    if (productsInCat('desserts').length) steps.push('dessert');
    if (!steps.length) { closeModal(); openCart(); return; }
    upsellState = { steps: steps, i: 0, pending: null };
    renderUpsellStep();
  }
  function upsellItems(key) {
    if (key === 'drink') return availableDrinks().map(function (d) {
      return { id: d.id, name: d.name, price: d.price, emoji: d.alcohol ? '🍺' : '🥤', image: '', alcohol: !!d.alcohol };
    });
    var cat = key === 'side' ? 'sides' : 'desserts';
    return productsInCat(cat).map(function (p) {
      return { id: p.id, name: p.name, price: p.price, emoji: p.emoji || (key === 'side' ? '🍟' : '🍰'), image: p.image || '', alcohol: false };
    });
  }
  function renderUpsellStep() {
    var st = upsellState, key = st.steps[st.i], cfg = UPSELL_CFG[key], items = upsellItems(key);
    var prog = st.steps.map(function (s, idx) {
      var lbl = UPSELL_CFG[s].emoji + ' ' + UPSELL_CFG[s].title;
      if (idx === st.i) return '<b>' + esc(lbl) + '</b>';
      if (idx < st.i) return '<span style="opacity:.5;text-decoration:line-through">' + esc(lbl) + '</span>';
      return '<span style="opacity:.6">' + esc(lbl) + '</span>';
    }).join(' <span style="opacity:.4">›</span> ');

    var body;
    if (st.pending) {
      body = '<div class="alcohol-note">🔞 <b>' + esc(st.pending.name) + '</b> — boisson alcoolisée, vente interdite aux moins de 18 ans.' +
        '<label style="margin-top:8px"><input type="checkbox" id="upsAge"> Je certifie avoir 18 ans ou plus.</label></div>';
    } else {
      body = items.map(function (it) {
        var media = it.image ? '<img src="' + esc(it.image) + '" alt="">' : esc(it.emoji);
        return '<div class="ups-row">' +
          '<span class="ups-emoji">' + media + '</span>' +
          '<span class="ups-name">' + esc(it.name) + (it.alcohol ? ' <span class="pill pill--gold" style="font-size:10px">18+</span>' : '') + '</span>' +
          '<span class="ups-price">' + money(it.price) + '</span>' +
          '<button class="btn btn--red btn--sm" data-ups-add="' + esc(it.id) + '">+ Ajouter</button>' +
        '</div>';
      }).join('');
    }
    var lastStep = st.i >= st.steps.length - 1;
    var html = '' +
      '<div class="modal-head"><div class="modal-hero" style="height:76px;font-size:36px">' + cfg.emoji + '</div><button class="modal-close" data-ups-close>✕</button></div>' +
      '<div class="modal-body">' +
        '<div class="ups-progress">' + prog + '</div>' +
        '<h3>' + esc(cfg.q) + '</h3>' +
        '<p class="m-desc">C\'est facultatif — ajoutez si vous voulez, sinon passez à la suite.</p>' +
        body +
      '</div>' +
      '<div class="modal-foot">' +
        (st.pending
          ? '<button class="btn btn--ghost" id="upsAgeCancel">Annuler</button><button class="btn btn--red btn--block" id="upsAgeOk" disabled>Ajouter</button>'
          : '<button class="btn btn--ghost btn--block" data-ups-skip>' + (lastStep ? 'Non merci → voir le panier' : 'Non merci / Passer →') + '</button>') +
      '</div>';
    openModal(html);
    var modal = el('modal');
    Array.prototype.forEach.call(modal.querySelectorAll('[data-ups-close]'), function (b) { b.addEventListener('click', finishUpsell); });
    var skip = modal.querySelector('[data-ups-skip]'); if (skip) skip.addEventListener('click', advanceUpsell);
    Array.prototype.forEach.call(modal.querySelectorAll('[data-ups-add]'), function (b) {
      b.addEventListener('click', function () {
        var it = items.filter(function (x) { return x.id === b.getAttribute('data-ups-add'); })[0];
        if (!it) return;
        if (it.alcohol) { st.pending = it; renderUpsellStep(); return; }
        addUpsellItem(it, cfg.kind); advanceUpsell();
      });
    });
    var age = el('upsAge'), ok = el('upsAgeOk'), cancel = el('upsAgeCancel');
    if (age && ok) age.addEventListener('change', function () { ok.disabled = !this.checked; });
    if (ok) ok.addEventListener('click', function () { var it = st.pending; st.pending = null; addUpsellItem(it, 'drink'); advanceUpsell(); });
    if (cancel) cancel.addEventListener('click', function () { st.pending = null; renderUpsellStep(); });
  }
  function addUpsellItem(it, kind) {
    if (kind === 'drink') { var d = findDrink(it.id); if (d) pushDrinkLine(d); }
    else { var p = findProduct(it.id); if (p) pushProductLine(p); }
    toast(it.name + ' ajouté ✓');
  }
  function advanceUpsell() {
    if (!upsellState) { finishUpsell(); return; }
    upsellState.pending = null;
    upsellState.i++;
    if (upsellState.i >= upsellState.steps.length) finishUpsell();
    else renderUpsellStep();
  }
  function finishUpsell() {
    upsellState = null;
    closeModal();
    openCart();
  }

  /* ---------- PANIER ---------- */
  function cartCount() {
    return M.getCart().reduce(function (n, l) { return n + l.qty; }, 0);
  }
  function updateCartBadges() {
    var n = cartCount();
    el('cartCount').textContent = n;
    var bar = el('mobileCartBar');
    if (n > 0) {
      bar.classList.add('show'); document.body.classList.add('has-mobile-bar');
      el('mobileCartText').textContent = n + (n > 1 ? ' articles' : ' article') + ' · ' + money(cartTotals().total);
    } else { bar.classList.remove('show'); document.body.classList.remove('has-mobile-bar'); }
  }

  function cartTotals(opts) {
    opts = opts || {};
    var cart = M.getCart();
    var subtotal = cart.reduce(function (s, l) { return s + lineTotal(l); }, 0);
    var delivery = (checkoutState && checkoutState.fulfillment === 'Livraison') ? Number(catalog.settings.deliveryFee || 0) : 0;
    var discount = 0, discountLabel = '';
    // fidélité
    if (checkoutState && checkoutState.loyaltyApplied) {
      discount = subtotal * (Number(catalog.settings.loyaltyDiscountPercent) || 0) / 100;
      discountLabel = '-' + catalog.settings.loyaltyDiscountPercent + '% fidélité';
    } else if (checkoutState && checkoutState.promo) {
      var pr = checkoutState.promo;
      discount = pr.type === 'percent' ? subtotal * pr.value / 100 : Number(pr.value);
      discountLabel = 'Code ' + pr.code;
    }
    var total = Math.max(0, subtotal - discount) + delivery;
    return { subtotal: subtotal, delivery: delivery, discount: discount, discountLabel: discountLabel, total: total };
  }

  function lineDetailText(l) {
    var parts = [];
    if (l.isMenu && l.drink) parts.push('Menu 🍟 · Boisson : ' + l.drink.name);
    if (l.bread) parts.push(l.bread === 'galette' ? 'Galette' : 'Pain');
    if (l.sauces && l.sauces.length) parts.push('Sauces : ' + l.sauces.join(', '));
    if (l.sauces && !l.sauces.length && l.kind === 'product') parts.push('Sans sauce');
    if (l.crudRemoved && l.crudRemoved.length) parts.push('Sans : ' + l.crudRemoved.join(', '));
    return parts.join(' · ');
  }

  function renderCart() {
    var cart = M.getCart();
    var body = el('cartBody'), foot = el('cartFoot');

    if (!cart.length) {
      body.innerHTML = '<div class="cart-empty"><div class="big">🛒</div><p>Ton panier est vide.<br>Ajoute un bon kebab ! 👑</p></div>';
      foot.innerHTML = '<a href="#menu" class="btn btn--red btn--block" id="gotoMenu">Voir la carte</a>';
      var g = el('gotoMenu'); if (g) g.addEventListener('click', closeCart);
      updateCartBadges();
      return;
    }

    var s = catalog.settings;
    var html = '';
    cart.forEach(function (l) {
      var canUpsell = false;
      if (s.menuUpgradeEnabled && l.kind === 'product' && !l.isMenu) {
        var p = findProduct(l.productId);
        canUpsell = !!(p && p.menuEligible);
      }
      html += '' +
        '<div class="cart-item">' +
          '<div class="ci-head">' +
            '<span class="ci-name">' + (l.emoji ? esc(l.emoji) + ' ' : '') + esc(l.name) + (l.isMenu ? ' <span class="pill pill--gold">Menu</span>' : '') + '</span>' +
            '<span class="ci-price">' + money(lineTotal(l)) + '</span>' +
          '</div>' +
          (lineDetailText(l) ? '<div class="ci-detail">' + esc(lineDetailText(l)) + '</div>' : '') +
          '<div class="ci-actions">' +
            '<span class="qty"><button data-dec="' + l.uid + '">−</button><span>' + l.qty + '</span><button data-inc="' + l.uid + '">+</button></span>' +
            '<button class="link-danger" data-del="' + l.uid + '">Retirer</button>' +
          '</div>' +
          (canUpsell
            ? '<button class="btn btn--gold btn--sm" data-upsell="' + l.uid + '" style="margin-top:10px;width:100%">🍟 Passer en menu +' + money(s.menuUpgradePrice) + '</button>'
            : '') +
        '</div>';
    });

    // rappel upsell global
    body.innerHTML = html;

    var t = cartTotals();
    var loyaltyBox = renderCartLoyalty();
    var footHTML = loyaltyBox +
      '<div class="summary-row"><span>Sous-total</span><span>' + money(t.subtotal) + '</span></div>' +
      (t.discount > 0 ? '<div class="summary-row discount"><span>' + esc(t.discountLabel) + '</span><span>-' + money(t.discount) + '</span></div>' : '') +
      (t.delivery > 0 ? '<div class="summary-row"><span>Livraison</span><span>' + money(t.delivery) + '</span></div>' : '') +
      '<div class="summary-row total"><span>Total</span><span>' + money(t.total) + '</span></div>' +
      '<button class="btn btn--red btn--block btn--lg" id="checkoutBtn" style="margin-top:12px">Valider ma commande →</button>';
    foot.innerHTML = footHTML;

    el('checkoutBtn').addEventListener('click', openCheckout);
    bindCartEvents();
    updateCartBadges();
  }

  function renderCartLoyalty() {
    var session = M.getSession();
    if (!session) return '';
    var cust = M.findCustomerByEmail(session.email);
    if (!cust) return '';
    var st = M.loyaltyStatus(cust, catalog.settings);
    if (st.used) return '<div class="upsell" style="background:#eef7ef;border-color:#bfe3c6"><div class="u-title">✅ Bonjour ' + esc(cust.firstName || '') + '</div><div class="u-sub">Réduction fidélité déjà utilisée. Merci !</div></div>';
    if (st.eligible) {
      var applied = checkoutState && checkoutState.loyaltyApplied;
      return '<div class="upsell" style="background:#eef7ef;border-color:#bfe3c6">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">' +
          '<div><div class="u-title">🎁 -' + catalog.settings.loyaltyDiscountPercent + '% fidélité</div><div class="u-sub">Disponible pour toi, ' + esc(cust.firstName || '') + ' !</div></div>' +
          (applied
            ? '<button class="btn btn--ghost btn--sm" id="loyaltyToggle">Retirer</button>'
            : '<button class="btn btn--red btn--sm" id="loyaltyToggle">Appliquer</button>') +
        '</div></div>';
    }
    if (st.availableAt) {
      return '<div class="upsell"><div class="u-title">⏳ -' + catalog.settings.loyaltyDiscountPercent + '% bientôt disponible</div><div class="u-sub">Ta réduction fidélité s\'active le ' + formatDateTime(st.availableAt) + '.</div></div>';
    }
    return '';
  }

  function bindCartEvents() {
    var body = el('cartBody'), foot = el('cartFoot');
    function rerender() { renderCart(); }
    Array.prototype.forEach.call(body.querySelectorAll('[data-inc]'), function (b) {
      b.addEventListener('click', function () { changeQty(b.getAttribute('data-inc'), 1); rerender(); });
    });
    Array.prototype.forEach.call(body.querySelectorAll('[data-dec]'), function (b) {
      b.addEventListener('click', function () { changeQty(b.getAttribute('data-dec'), -1); rerender(); });
    });
    Array.prototype.forEach.call(body.querySelectorAll('[data-del]'), function (b) {
      b.addEventListener('click', function () { removeLine(b.getAttribute('data-del')); rerender(); });
    });
    Array.prototype.forEach.call(body.querySelectorAll('[data-upsell]'), function (b) {
      b.addEventListener('click', function () { openCartUpsell(b.getAttribute('data-upsell')); });
    });
    var lt = el('loyaltyToggle');
    if (lt) lt.addEventListener('click', function () {
      checkoutState = checkoutState || {};
      checkoutState.loyaltyApplied = !checkoutState.loyaltyApplied;
      if (checkoutState.loyaltyApplied) checkoutState.promo = null;
      renderCart();
    });
  }

  function changeQty(uid, delta) {
    var cart = M.getCart();
    for (var i = 0; i < cart.length; i++) if (cart[i].uid === uid) {
      cart[i].qty = Math.max(1, cart[i].qty + delta); break;
    }
    M.saveCart(cart);
  }
  function removeLine(uid) {
    var cart = M.getCart().filter(function (l) { return l.uid !== uid; });
    M.saveCart(cart);
  }

  // Upsell depuis le panier : choisir une boisson pour passer la ligne en menu
  function openCartUpsell(uid) {
    var cart = M.getCart();
    var line = cart.filter(function (l) { return l.uid === uid; })[0];
    if (!line) return;
    var drinks = availableDrinks();
    var state = { drinkId: drinks.length ? drinks[0].id : null, ageOk: false };

    function render() {
      var d = state.drinkId ? findDrink(state.drinkId) : null;
      var needAge = d && d.alcohol;
      var html = '' +
        '<div class="modal-body" style="padding-top:22px">' +
          '<h3>🍟 Passer en menu</h3>' +
          '<p class="m-desc">Ajoute une boisson à « ' + esc(line.name) + ' » pour ' + money(catalog.settings.menuUpgradePrice) + ' de plus.</p>' +
          '<div class="opt-group"><h5>Ta boisson</h5><div class="chip-set" id="upDrinks">';
      drinks.forEach(function (dr) {
        html += '<button class="opt-chip ' + (state.drinkId === dr.id ? 'selected' : '') + '" data-d="' + esc(dr.id) + '">' + (dr.alcohol ? '🍺 ' : '') + esc(dr.name) + '</button>';
      });
      html += '</div>';
      if (needAge) {
        html += '<div class="alcohol-note">🔞 Boisson alcoolisée, interdite aux -18 ans.<label><input type="checkbox" id="upAge" ' + (state.ageOk ? 'checked' : '') + '> Je certifie avoir 18 ans ou plus.</label></div>';
      }
      html += '</div></div>' +
        '<div class="modal-foot">' +
          '<button class="btn btn--ghost" data-close>Annuler</button>' +
          '<button class="btn btn--red btn--block" id="confirmUpsell" ' + (needAge && !state.ageOk ? 'disabled' : '') + '>Valider le menu</button>' +
        '</div>';
      openModal(html);
      var modal = el('modal');
      Array.prototype.forEach.call(modal.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', closeModal); });
      Array.prototype.forEach.call(modal.querySelectorAll('[data-d]'), function (b) {
        b.addEventListener('click', function () { state.drinkId = b.getAttribute('data-d'); state.ageOk = false; render(); });
      });
      var ua = el('upAge'); if (ua) ua.addEventListener('change', function () { state.ageOk = ua.checked; el('confirmUpsell').disabled = !ua.checked; });
      el('confirmUpsell').addEventListener('click', function () {
        var dr = findDrink(state.drinkId);
        if (dr && dr.alcohol && !state.ageOk) { toast('Confirme ton âge (18+)', 'err'); return; }
        var c = M.getCart();
        for (var i = 0; i < c.length; i++) if (c[i].uid === uid) {
          c[i].isMenu = true;
          c[i].menuUpgrade = Number(catalog.settings.menuUpgradePrice);
          c[i].drink = { id: dr.id, name: dr.name, alcohol: !!dr.alcohol };
          break;
        }
        M.saveCart(c);
        closeModal(); renderCart(); toast('Menu ajouté 🍟');
      });
    }
    render();
  }

  /* ---------- ouverture / fermeture panier ---------- */
  function openCart() { renderCart(); el('cartDrawer').classList.add('show'); el('overlay').classList.add('show'); }
  function closeCart() { el('cartDrawer').classList.remove('show'); el('overlay').classList.remove('show'); }

  /* ---------- CHECKOUT ---------- */
  function formatDateTime(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }) + ' à ' +
             d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return iso; }
  }

  function openCheckout() {
    var cart = M.getCart();
    if (!cart.length) { toast('Ton panier est vide', 'info'); return; }
    checkoutState = checkoutState || {};
    var session = M.getSession();
    var cust = session ? M.findCustomerByEmail(session.email) : null;
    var t = cartTotals();
    var modes = catalog.settings.fulfillment || ['À emporter'];

    var html = '' +
      '<div class="modal-head"><div class="modal-hero" style="height:74px;font-size:30px">🧾 Ma commande</div><button class="modal-close" data-close>✕</button></div>' +
      '<div class="modal-body">' +
        '<div class="opt-group"><h5>Mode</h5><div class="radio-row" id="fulfill">' +
          modes.map(function (m, i) { return '<button class="opt-chip ' + ((checkoutState.fulfillment || modes[0]) === m ? 'selected' : '') + '" data-fulfill="' + esc(m) + '">' + esc(m) + '</button>'; }).join('') +
        '</div></div>' +
        '<div class="grid-2">' +
          '<div class="field"><label>Prénom *</label><input class="input" id="coFirst" value="' + esc(cust ? cust.firstName : '') + '" placeholder="Prénom"></div>' +
          '<div class="field"><label>Nom</label><input class="input" id="coLast" value="' + esc(cust ? cust.lastName : '') + '" placeholder="Nom"></div>' +
        '</div>' +
        '<div class="grid-2">' +
          '<div class="field"><label id="coPhoneLabel">Téléphone (facultatif)</label><input class="input" id="coPhone" value="' + esc(cust ? cust.phone : '') + '" placeholder="06 12 34 56 78"></div>' +
          '<div class="field"><label>E-mail (pour la confirmation)</label><input class="input" id="coEmail" value="' + esc(cust ? cust.email : '') + '" placeholder="ton@email.fr"></div>' +
        '</div>' +
        '<div class="field" id="addrField" style="display:none"><label>Adresse de livraison *</label><input class="input" id="coAddr" placeholder="N°, rue, code postal, ville"></div>' +
        '<div class="field"><label>Date et heure de la commande</label>' +
          '<input class="input" id="coWhen" readonly tabindex="-1" style="background:#f3efe9;cursor:not-allowed;color:var(--muted)">' +
          '<div style="font-size:11.5px;color:var(--muted);margin-top:4px">⏱️ Renseignées automatiquement (non modifiables)</div></div>' +
        '<div class="field"><label>Note (facultatif)</label><textarea class="textarea" id="coNote" placeholder="Allergies, précisions…"></textarea></div>' +
        '<div id="coLoyalty"></div>' +
        '<div class="opt-group" style="margin:6px 0 0"><h5>💳 Moyen de paiement</h5><div id="payMethods" style="display:grid;gap:8px"></div><div id="payNote" style="margin-top:6px"></div></div>' +
        '<div class="adm-card" style="box-shadow:none;background:#fff;border:1px solid var(--line);margin:0">' +
          '<div class="summary-row"><span>Sous-total</span><span>' + money(t.subtotal) + '</span></div>' +
          '<div id="coDiscountRow"></div>' +
          '<div id="coDeliveryRow"></div>' +
          '<div class="summary-row total"><span>Total</span><span id="coTotal">' + money(t.total) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn--ghost" data-close>Retour</button><button class="btn btn--red btn--block btn--lg" id="placeOrderBtn">Commander</button></div>';

    openModal(html);
    var modal = el('modal');
    Array.prototype.forEach.call(modal.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', function () { closeModal(); openCart(); }); });

    // Date et heure automatiques (non modifiables par le client)
    var now = new Date();
    checkoutState.wantedDate = now.toISOString().slice(0, 10);
    checkoutState.wantedTime = now.toTimeString().slice(0, 5);
    el('coWhen').value = now.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' }) + ' à ' + checkoutState.wantedTime;

    // Paiement : un seul moyen sélectionné
    if (!checkoutState.payment) checkoutState.payment = 'sur_place';
    renderPayMethods();

    function setFulfill(m) {
      checkoutState.fulfillment = m;
      Array.prototype.forEach.call(modal.querySelectorAll('[data-fulfill]'), function (x) { x.classList.toggle('selected', x.getAttribute('data-fulfill') === m); });
      var livr = (m === 'Livraison');
      el('addrField').style.display = livr ? 'block' : 'none';
      // Téléphone obligatoire uniquement en livraison ; facultatif sinon
      var lbl = el('coPhoneLabel');
      if (lbl) lbl.innerHTML = livr ? 'Téléphone <b style="color:var(--red)">*</b> (pour la livraison)' : 'Téléphone (facultatif)';
      refreshCheckoutTotals();
    }
    Array.prototype.forEach.call(modal.querySelectorAll('[data-fulfill]'), function (b) {
      b.addEventListener('click', function () { setFulfill(b.getAttribute('data-fulfill')); });
    });
    setFulfill(checkoutState.fulfillment || modes[0]);

    renderCheckoutLoyalty();
    refreshCheckoutTotals();

    el('placeOrderBtn').addEventListener('click', placeOrder);
  }

  function renderCheckoutLoyalty() {
    var box = el('coLoyalty'); if (!box) return;
    var session = M.getSession();
    if (!session) { box.innerHTML = ''; return; }
    var cust = M.findCustomerByEmail(session.email);
    if (!cust) { box.innerHTML = ''; return; }
    var st = M.loyaltyStatus(cust, catalog.settings);
    if (st.eligible && !st.used) {
      box.innerHTML = '<div class="check" style="background:#eef7ef;border:1px solid #bfe3c6;padding:12px;border-radius:12px;margin-bottom:12px"><input type="checkbox" id="coUseLoyalty" ' + (checkoutState.loyaltyApplied ? 'checked' : '') + '><label for="coUseLoyalty" style="margin:0"><b>Utiliser ma réduction fidélité -' + catalog.settings.loyaltyDiscountPercent + '%</b></label></div>';
      el('coUseLoyalty').addEventListener('change', function () {
        checkoutState.loyaltyApplied = this.checked; refreshCheckoutTotals();
      });
    } else box.innerHTML = '';
  }

  function refreshCheckoutTotals() {
    var t = cartTotals();
    el('coDiscountRow').innerHTML = t.discount > 0 ? '<div class="summary-row discount"><span>' + esc(t.discountLabel) + '</span><span>-' + money(t.discount) + '</span></div>' : '';
    el('coDeliveryRow').innerHTML = t.delivery > 0 ? '<div class="summary-row"><span>Livraison</span><span>' + money(t.delivery) + '</span></div>' : '';
    el('coTotal').textContent = money(t.total);
  }

  function renderPayMethods() {
    var wrap = el('payMethods'); if (!wrap) return;
    var sel = checkoutState.payment || 'sur_place';
    wrap.innerHTML = PAYMENTS.map(function (p) {
      var ready = (p.id === 'sur_place') || onlineReady();
      return '<button type="button" class="opt-chip ' + (sel === p.id ? 'selected' : '') + '" data-pay="' + p.id + '" style="justify-content:flex-start;width:100%;padding:12px 14px;border-radius:12px;text-align:left">' +
        '<span style="font-size:20px">' + p.emoji + '</span> <b>' + esc(p.label) + '</b>' +
        '<span style="color:var(--muted);font-weight:500;font-size:12px;margin-left:6px">' + esc(p.desc) + '</span>' +
        (ready ? '' : '<span class="pill pill--gold" style="margin-left:auto">Bientôt</span>') +
        '</button>';
    }).join('');
    Array.prototype.forEach.call(wrap.querySelectorAll('[data-pay]'), function (b) {
      b.addEventListener('click', function () { checkoutState.payment = b.getAttribute('data-pay'); renderPayMethods(); });
    });
    var online = isOnlinePay(sel), blocked = online && !onlineReady();
    var note = el('payNote');
    if (note) note.innerHTML = blocked
      ? '<div class="alcohol-note" style="background:rgba(217,119,6,.1);border-color:rgba(217,119,6,.35)">💳 Le paiement en ligne (CB / Apple Pay / Google Pay) arrive très bientôt. En attendant, choisissez <b>« Paiement sur place »</b> pour valider votre commande.</div>'
      : '';
    var btn = el('placeOrderBtn');
    if (btn) {
      btn.disabled = blocked;
      btn.textContent = blocked ? 'Paiement en ligne bientôt disponible'
        : (sel === 'sur_place' ? 'Commander (payer sur place)' : 'Payer et commander');
    }
  }

  function placeOrder() {
    var first = el('coFirst').value.trim();
    var phone = el('coPhone').value.trim();
    var email = el('coEmail').value.trim();
    var mode = checkoutState.fulfillment;
    var pay = checkoutState.payment || 'sur_place';
    if (!first) { toast('Indique ton prénom', 'err'); return; }
    if (mode === 'Livraison') {
      if (!phone) { toast('Le téléphone est obligatoire pour la livraison', 'err'); return; }
      if (!el('coAddr').value.trim()) { toast('Indique ton adresse de livraison', 'err'); return; }
    }
    if (isOnlinePay(pay) && !onlineReady()) { toast('Paiement en ligne bientôt disponible — choisissez « Paiement sur place »', 'info'); return; }

    var cart = M.getCart();
    var t = cartTotals();
    var order = {
      id: M.uid('ord'),
      number: M.nextOrderNumber(),
      createdAt: new Date().toISOString(),
      status: 'Nouvelle',
      customer: { firstName: first, lastName: el('coLast').value.trim(), phone: phone, email: email },
      fulfillment: mode,
      address: mode === 'Livraison' ? el('coAddr').value.trim() : '',
      wantedDate: checkoutState.wantedDate,
      wantedTime: checkoutState.wantedTime,
      note: el('coNote').value.trim(),
      items: cart,
      subtotal: t.subtotal,
      delivery: t.delivery,
      discount: t.discount,
      discountLabel: t.discountLabel,
      total: t.total,
      loyaltyApplied: !!(checkoutState && checkoutState.loyaltyApplied),
      paymentMethod: pay,
      paymentStatus: (pay === 'sur_place') ? 'À payer sur place' : 'Payée',
      paidAt: (pay === 'sur_place') ? null : new Date().toISOString()
    };

    M.addOrder(order);

    // Mise à jour client (fidélité)
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

    M.clearCart();
    checkoutState = null;
    sendOrderEmails(order);
    closeCart();
    showConfirmation(order);
    updateCartBadges();
  }

  /* ---------- CONFIRMATION + proposition de compte ---------- */
  function showConfirmation(order) {
    var s = catalog.settings;
    var loggedIn = !!M.getSession();
    var alreadyClient = order.customer.email && M.findCustomerByEmail(order.customer.email);

    var accountBlock = '';
    if (!loggedIn && !alreadyClient) {
      accountBlock = '' +
        '<div class="perk-card" style="margin-top:16px">' +
          '<h3 style="font-size:22px">🎁 Crée ton compte : <span style="color:var(--gold)">-10%</span> sur ta prochaine commande !</h3>' +
          '<p style="color:#e9d9d4;font-size:14px">Ta réduction s\'active automatiquement 24 h après cette commande. Ça prend 20 secondes.</p>' +
          '<button class="btn btn--gold btn--block" id="confCreateAccount">Créer mon compte maintenant</button>' +
        '</div>';
    } else if (loggedIn) {
      accountBlock = '<div class="upsell" style="margin-top:16px;background:#eef7ef;border-color:#bfe3c6"><div class="u-title">Merci ' + esc(order.customer.firstName) + ' ! 👑</div><div class="u-sub">Ta commande est enregistrée dans ton compte.</div></div>';
    }

    var itemsHTML = order.items.map(function (l) {
      return '<div class="order-line">' + l.qty + '× ' + esc(l.name) + (l.isMenu ? ' (Menu)' : '') + ' — ' + money(lineTotal(l)) +
        (lineDetailText(l) ? '<div class="sub">' + esc(lineDetailText(l)) + '</div>' : '') + '</div>';
    }).join('');

    var html = '' +
      '<div class="modal-head"><div class="modal-hero" style="background:linear-gradient(135deg,#1f9d55,#127a41)">✅</div><button class="modal-close" data-close>✕</button></div>' +
      '<div class="modal-body">' +
        '<h3>Commande confirmée !</h3>' +
        '<p class="m-desc">Merci ' + esc(order.customer.firstName) + ', ta commande <b>#' + order.number + '</b> est bien reçue.' +
          (s.email_enabled && order.customer.email ? ' Un e-mail de confirmation t\'a été envoyé.' : '') + '</p>' +
        '<div class="adm-card" style="box-shadow:none;border:1px solid var(--line);margin:0 0 8px">' +
          itemsHTML +
          '<div class="summary-row total" style="margin-top:8px"><span>Total</span><span>' + money(order.total) + '</span></div>' +
          '<div class="u-sub" style="margin-top:6px">' + esc(order.fulfillment) + ' · ' + esc(order.wantedTime) + '</div>' +
          '<div style="margin-top:8px">' +
            (order.paymentStatus === 'À payer sur place'
              ? '<span class="pill pill--gold">💶 À payer sur place</span>'
              : '<span class="pill pill--ok">✅ Payé</span>') +
          '</div>' +
        '</div>' +
        accountBlock +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn--red btn--block" data-close>Terminer</button></div>';

    openModal(html);
    var modal = el('modal');
    Array.prototype.forEach.call(modal.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', closeModal); });
    var ca = el('confCreateAccount');
    if (ca) ca.addEventListener('click', function () { openAccountModal(order.customer, order); });
  }

  /* ---------- COMPTE ---------- */
  function openAccountModal(prefill, linkedOrder) {
    prefill = prefill || {};
    var html = '' +
      '<div class="modal-head"><div class="modal-hero" style="height:80px;font-size:34px">👑 Mon compte</div><button class="modal-close" data-close>✕</button></div>' +
      '<div class="modal-body">' +
        '<h3>Crée ton compte MYKONOS</h3>' +
        '<p class="m-desc">Profite de <b>-10%</b> sur ta prochaine commande (activée 24 h après ta 1ʳᵉ commande).</p>' +
        '<div class="grid-2">' +
          '<div class="field"><label>Prénom *</label><input class="input" id="acFirst" value="' + esc(prefill.firstName || '') + '"></div>' +
          '<div class="field"><label>Nom *</label><input class="input" id="acLast" value="' + esc(prefill.lastName || '') + '"></div>' +
        '</div>' +
        '<div class="field"><label>E-mail *</label><input class="input" id="acEmail" type="email" value="' + esc(prefill.email || '') + '"></div>' +
        '<div class="field"><label>Téléphone *</label><input class="input" id="acPhone" value="' + esc(prefill.phone || '') + '"></div>' +
        '<div class="field"><label class="check"><input type="checkbox" id="acNews"> Je souhaite recevoir les offres et nouveautés de Mykonos par e-mail.</label></div>' +
        '<p style="font-size:11.5px;color:var(--muted)">En créant un compte, tu acceptes que Mykonos conserve ces informations pour gérer tes commandes et ta fidélité.</p>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn--ghost" id="acLoginLink">J\'ai déjà un compte</button><button class="btn btn--red btn--block" id="acCreate">Créer mon compte</button></div>';
    openModal(html);
    var modal = el('modal');
    Array.prototype.forEach.call(modal.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', closeModal); });
    el('acLoginLink').addEventListener('click', openLoginModal);
    el('acCreate').addEventListener('click', function () { createAccount(linkedOrder); });
  }

  function createAccount(linkedOrder) {
    var first = el('acFirst').value.trim();
    var last = el('acLast').value.trim();
    var email = el('acEmail').value.trim();
    var phone = el('acPhone').value.trim();
    var news = el('acNews').checked;
    if (!first || !last) { toast('Prénom et nom requis', 'err'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('E-mail invalide', 'err'); return; }
    if (!phone) { toast('Téléphone requis', 'err'); return; }

    var existing = M.findCustomerByEmail(email);
    if (existing && existing.createdAt) { toast('Un compte existe déjà avec cet e-mail. Connecte-toi.', 'info'); openLoginModal(); return; }

    var cust = existing || {};
    cust.firstName = first; cust.lastName = last; cust.email = email; cust.phone = phone;
    cust.newsletter = !!news;
    cust.createdAt = cust.createdAt || new Date().toISOString();
    cust.orderCount = cust.orderCount || 0;
    cust.loyaltyUsed = cust.loyaltyUsed || false;
    // La 1ère commande démarre le compteur des 24 h
    if (linkedOrder) {
      cust.firstOrderAt = cust.firstOrderAt || linkedOrder.createdAt;
      cust.orderCount = Math.max(cust.orderCount, 1);
      cust.lastOrderAt = linkedOrder.createdAt;
    }
    M.upsertCustomer(cust);
    M.saveSession({ email: email, firstName: first });
    if (news) M.addNewsletter({ email: email, name: first + ' ' + last });

    closeModal();
    toast('Compte créé, bienvenue ' + first + ' ! 👑');
    refreshSessionUI();
    // e-mail de bienvenue (si configuré)
    sendWelcomeEmail(cust);
  }

  function openLoginModal() {
    var html = '' +
      '<div class="modal-head"><div class="modal-hero" style="height:80px;font-size:34px">👋 Connexion</div><button class="modal-close" data-close>✕</button></div>' +
      '<div class="modal-body">' +
        '<h3>Content de te revoir !</h3>' +
        '<p class="m-desc">Entre ton e-mail pour retrouver ton compte et ta fidélité.</p>' +
        '<div class="field"><label>E-mail</label><input class="input" id="loginEmail" type="email" placeholder="ton@email.fr"></div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn--ghost" id="toCreate">Créer un compte</button><button class="btn btn--red btn--block" id="doLogin">Se connecter</button></div>';
    openModal(html);
    var modal = el('modal');
    Array.prototype.forEach.call(modal.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', closeModal); });
    el('toCreate').addEventListener('click', function () { openAccountModal({}, null); });
    el('doLogin').addEventListener('click', function () {
      var email = el('loginEmail').value.trim();
      var cust = M.findCustomerByEmail(email);
      if (!cust) { toast('Aucun compte trouvé avec cet e-mail', 'err'); return; }
      M.saveSession({ email: cust.email, firstName: cust.firstName });
      closeModal(); toast('Bonjour ' + (cust.firstName || '') + ' ! 👑'); refreshSessionUI();
    });
  }

  function refreshSessionUI() {
    var session = M.getSession();
    var box = el('loyaltyStatusBox');
    var btn = el('openAccountBtn');
    if (!box) return;
    if (!session) {
      if (btn) btn.textContent = 'Créer mon compte';
      box.innerHTML = '<button class="btn btn--ghost btn--sm" id="loginSmall" style="color:#fff;border-color:rgba(255,255,255,.35)">J\'ai déjà un compte →</button>';
      var ls = el('loginSmall'); if (ls) ls.addEventListener('click', openLoginModal);
      return;
    }
    var cust = M.findCustomerByEmail(session.email);
    if (btn) btn.textContent = 'Mon espace';
    if (!cust) { box.innerHTML = ''; return; }
    var st = M.loyaltyStatus(cust, catalog.settings);
    var status = st.used ? '<span class="pill pill--muted">Réduction utilisée</span>'
      : st.eligible ? '<span class="pill" style="background:var(--gold);color:#241b18">-10% disponible !</span>'
      : st.availableAt ? '<span class="pill pill--gold">-10% le ' + formatDateTime(st.availableAt) + '</span>'
      : '<span class="pill pill--muted">Passe une 1ʳᵉ commande</span>';
    box.innerHTML = '<div style="background:rgba(255,255,255,.1);padding:12px;border-radius:12px">' +
      '<b>👋 ' + esc(cust.firstName || '') + '</b> · ' + (cust.orderCount || 0) + ' commande(s)<br>' + status +
      ' <button class="link-danger" id="logoutBtn" style="color:#ffd9d9">Déconnexion</button></div>';
    var lo = el('logoutBtn'); if (lo) lo.addEventListener('click', function () { M.clearSession(); refreshSessionUI(); toast('Déconnecté'); });
  }

  /* ---------- E-MAILS (EmailJS, optionnel) ---------- */
  function emailReady() {
    var s = catalog.settings;
    return !!(s.email_enabled && window.emailjs && s.emailjs_publicKey && s.emailjs_serviceId);
  }
  function initEmail() {
    try { if (emailReady()) window.emailjs.init({ publicKey: catalog.settings.emailjs_publicKey }); } catch (e) {}
  }
  function orderToText(order) {
    return order.items.map(function (l) {
      var d = lineDetailText(l);
      return '• ' + l.qty + '× ' + l.name + (l.isMenu ? ' (Menu)' : '') + ' — ' + money(lineTotal(l)) + (d ? '\n   ' + d : '');
    }).join('\n');
  }
  function orderParams(order) {
    var s = catalog.settings;
    return {
      order_number: order.number,
      customer_name: order.customer.firstName + ' ' + (order.customer.lastName || ''),
      first_name: order.customer.firstName,
      customer_email: order.customer.email,
      customer_phone: order.customer.phone,
      items: orderToText(order),
      subtotal: money(order.subtotal),
      discount: order.discount > 0 ? '-' + money(order.discount) + ' (' + order.discountLabel + ')' : 'Aucune',
      delivery: order.delivery > 0 ? money(order.delivery) : 'Non',
      total: money(order.total),
      fulfillment: order.fulfillment,
      address: order.address || 'Retrait sur place',
      wanted: order.wantedDate + ' ' + order.wantedTime,
      note: order.note || '—',
      restaurant_name: s.restaurantName,
      restaurant_phone: s.phone,
      restaurant_address: s.address
    };
  }
  function sendOrderEmails(order) {
    if (!emailReady()) return; // pas configuré → commande déjà stockée pour l'admin
    var s = catalog.settings;
    var params = orderParams(order);
    try {
      if (s.emailjs_templateClient && order.customer.email) {
        window.emailjs.send(s.emailjs_serviceId, s.emailjs_templateClient, params)
          .catch(function (e) { console.warn('email client', e); });
      }
      if (s.emailjs_templateAdmin) {
        var ap = Object.assign({}, params, { to_email: s.admin_notify_email || s.email });
        window.emailjs.send(s.emailjs_serviceId, s.emailjs_templateAdmin, ap)
          .catch(function (e) { console.warn('email admin', e); });
      }
    } catch (e) { console.warn(e); }
  }
  function sendWelcomeEmail() {/* réservé : template de bienvenue si ajouté par l'admin */}

  /* ---------- BIND global ---------- */
  function bindGlobal() {
    el('openCart').addEventListener('click', openCart);
    el('closeCart').addEventListener('click', closeCart);
    el('overlay').addEventListener('click', closeCart);
    el('mobileCartBar').addEventListener('click', openCart);
    el('modalBackdrop').addEventListener('click', closeModal);
    el('openAccountBtn').addEventListener('click', function () {
      var session = M.getSession();
      if (session) { document.getElementById('compte').scrollIntoView({ behavior: 'smooth' }); }
      else openAccountModal({}, null);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeModal(); closeCart(); }
    });
    window.addEventListener('mykonos:cart-updated', function () { updateCartBadges(); if (el('cartDrawer').classList.contains('show')) renderCart(); });
    window.addEventListener('mykonos:catalog-updated', function () { reloadCatalog(); renderStaticInfo(); renderMenu(); refreshSessionUI(); });
    window.addEventListener('storage', function (e) {
      if (e.key === M.KEYS.catalog) { reloadCatalog(); renderStaticInfo(); renderMenu(); }
      if (e.key === M.KEYS.cart) { updateCartBadges(); }
    });
  }

  /* ---------- INIT ---------- */
  function init() {
    renderStaticInfo();
    renderMenu();
    bindGlobal();
    refreshSessionUI();
    updateCartBadges();
    initEmail();
    // rafraîchir le statut fidélité chaque minute (compte à rebours 24 h)
    setInterval(function () { refreshSessionUI(); if (el('cartDrawer').classList.contains('show')) renderCart(); }, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
