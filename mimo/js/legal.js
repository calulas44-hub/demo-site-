/* ============================================================================
   MIMO – Pages légales (legal.js)
   Remplit les mentions légales / la politique de confidentialité avec les
   informations saisies dans l'espace gérant (Réglages → Mentions légales).
   Un champ vide s'affiche « à compléter » : rien n'est inventé.
   ==========================================================================*/
(function () {
  'use strict';
  var M = window.MIMO, ART = window.MIMO_ART;
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function render() {
    var c = M.getCatalog(), s = c.settings, lg = s.legal || {};
    var values = {
      restaurantName: s.restaurantName, address: s.address, instagram: s.instagram ? '@' + s.instagram : '',
      companyName: lg.companyName, legalForm: lg.legalForm, capital: lg.capital, siret: lg.siret, rcs: lg.rcs,
      vatNumber: lg.vatNumber, headOffice: lg.headOffice || s.address, director: lg.director,
      contactEmail: lg.contactEmail || s.email, contactPhone: lg.contactPhone || s.phone, mediator: lg.mediator
    };
    Array.prototype.forEach.call(document.querySelectorAll('[data-legal]'), function (n) {
      var v = values[n.getAttribute('data-legal')];
      if (v) {
        n.classList.remove('todo');
        if (n.getAttribute('data-legal') === 'contactEmail') n.innerHTML = '<a href="mailto:' + esc(v) + '">' + esc(v) + '</a>';
        else n.textContent = v;
      } else { n.classList.add('todo'); n.textContent = n.getAttribute('data-todo') || 'à compléter'; }
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-optional]'), function (n) {
      n.style.display = values[n.getAttribute('data-optional')] ? '' : 'none';
    });
    var mk = document.getElementById('brandMark'); if (mk && ART) mk.innerHTML = ART.logoMark();
    var y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
  window.addEventListener('mimo:catalog-updated', render);
})();
