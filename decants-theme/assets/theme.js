/* Thème « Décants » — JavaScript léger, sans dépendance. */
(function () {
  'use strict';

  var $ = function (selector, scope) { return (scope || document).querySelector(selector); };
  var $$ = function (selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); };

  /* ---------- Menu mobile ---------- */
  function initNav() {
    var toggle = $('[data-nav-toggle]');
    var nav = $('[data-nav]');
    if (!toggle || !nav) return;

    function setOpen(open) {
      if (open) { nav.setAttribute('data-open', ''); } else { nav.removeAttribute('data-open'); }
      toggle.setAttribute('aria-expanded', String(open));
    }

    toggle.addEventListener('click', function () {
      setOpen(!nav.hasAttribute('data-open'));
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.hasAttribute('data-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    var desktop = window.matchMedia('(min-width: 990px)');
    var onChange = function (event) { if (event.matches) setOpen(false); };
    if (desktop.addEventListener) { desktop.addEventListener('change', onChange); }
  }

  /* ---------- Fiche produit : choix de la contenance ---------- */
  function initProduct(section) {
    var dataEl = $('[data-variant-json]', section);
    if (!dataEl) return;

    var variants;
    try { variants = JSON.parse(dataEl.textContent); } catch (error) { return; }

    var groups = $$('[data-option-group]', section);
    if (groups.length === 0) return;

    var idInput = $('[data-variant-id]', section);
    var priceEl = $('[data-price]', section);
    var compareEl = $('[data-compare]', section);
    var perMlEl = $('[data-per-ml]', section);
    var stockEl = $('[data-stock]', section);
    var submit = $('[data-add-to-cart]', section);
    var submitLabel = $('[data-add-label]', section);

    function selection() {
      return groups.map(function (group) {
        var checked = $('input:checked', group);
        return checked ? checked.value : null;
      });
    }

    function findVariant(options) {
      return variants.find(function (variant) {
        return variant.options.every(function (value, index) { return value === options[index]; });
      });
    }

    function markUnavailable(current) {
      groups.forEach(function (group, groupIndex) {
        $$('input', group).forEach(function (input) {
          var test = current.slice();
          test[groupIndex] = input.value;
          var match = findVariant(test);
          var label = input.nextElementSibling;
          if (label) label.classList.toggle('is-soldout', !match || !match.available);
        });
      });
    }

    function render() {
      var current = selection();
      markUnavailable(current);

      var variant = findVariant(current);
      if (!variant) {
        if (submit) submit.disabled = true;
        if (submitLabel) submitLabel.textContent = 'Indisponible';
        return;
      }

      if (idInput) idInput.value = variant.id;
      if (priceEl) priceEl.textContent = variant.price;

      if (compareEl) {
        compareEl.textContent = variant.compare_at || '';
        compareEl.hidden = !variant.compare_at;
      }
      if (perMlEl) {
        perMlEl.textContent = variant.per_ml ? variant.per_ml + ' / ml' : '';
        perMlEl.hidden = !variant.per_ml;
      }
      if (stockEl) {
        stockEl.textContent = variant.low_stock ? 'Plus que ' + variant.low_stock + ' en stock' : '';
        stockEl.hidden = !variant.low_stock;
      }
      if (submit) {
        submit.disabled = !variant.available;
        if (submitLabel) {
          submitLabel.textContent = variant.available ? submit.getAttribute('data-label-add') : submit.getAttribute('data-label-sold');
        }
      }

      try {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
      } catch (error) { /* sans conséquence */ }
    }

    section.addEventListener('change', function (event) {
      if (event.target.closest && event.target.closest('[data-option-group]')) render();
    });

    render();
  }

  /* ---------- Quantités (fiche produit et panier) ---------- */
  function initQuantity() {
    document.addEventListener('click', function (event) {
      var button = event.target.closest('[data-qty-step]');
      if (!button) return;

      var wrapper = button.closest('.qty');
      var input = wrapper && $('input', wrapper);
      if (!input) return;

      var step = Number(button.getAttribute('data-qty-step'));
      var min = input.min === '' ? 1 : Number(input.min);
      var next = (Number(input.value) || min) + step;
      input.value = Math.max(min, next);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /* ---------- Panier : mise à jour automatique ---------- */
  function initCart() {
    var timer;
    document.addEventListener('change', function (event) {
      var input = event.target;
      if (!input.matches || !input.matches('[data-cart-qty]')) return;

      var form = input.form;
      if (!form) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        var updateButton = $('[data-cart-update]', form);
        if (form.requestSubmit && updateButton) { form.requestSubmit(updateButton); } else { form.submit(); }
      }, 600);
    });
  }

  /* ---------- Collection : filtres et tri appliqués dès le changement ---------- */
  function initFilters() {
    document.addEventListener('change', function (event) {
      var form = event.target.closest && event.target.closest('[data-filter-form]');
      if (!form) return;
      if (form.requestSubmit) { form.requestSubmit(); } else { form.submit(); }
    });
  }

  /* ---------- Produits associés ---------- */
  function initRecommendations() {
    $$('[data-recommendations]').forEach(function (container) {
      var url = container.getAttribute('data-url');
      if (!url || !window.fetch) return;

      window.fetch(url)
        .then(function (response) { return response.ok ? response.text() : ''; })
        .then(function (html) {
          if (!html) return;
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var fresh = $('[data-recommendations]', doc);
          if (fresh && $('.card', fresh)) container.innerHTML = fresh.innerHTML;
        })
        .catch(function () { /* section simplement absente */ });
    });
  }

  function init() {
    initNav();
    initQuantity();
    initCart();
    initFilters();
    initRecommendations();
    $$('[data-product-section]').forEach(initProduct);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Éditeur de thème : réinitialise les sections rechargées. */
  document.addEventListener('shopify:section:load', function (event) {
    $$('[data-product-section]', event.target).forEach(initProduct);
    initRecommendations();
  });
})();
