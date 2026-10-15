/* ============================================================================
   MIMO – Visuels vectoriels (visuals.js)
   ----------------------------------------------------------------------------
   • Logo : le « M » jaune moutarde, épais et arrondi, tel qu'il apparaît en bas
     de la carte de Mimo (redessiné en SVG — à remplacer par le fichier officiel
     dès que Mimo le fournit, voir README).
   • Mascotte : clin d'œil au cookie dessiné au trait sur la carte.
   • Illustrations des boissons / gâteaux : utilisées UNIQUEMENT quand aucune
     vraie photo n'est disponible (verre en couches, tasse, cookie…), posées
     sur un plateau inox et un fond de carreaux jaunes, comme chez Mimo.
   ==========================================================================*/
(function (global) {
  'use strict';

  var INK = '#2b1d14';      // espresso (traits, textes)
  var CREAM = '#fffaf0';    // murs blancs chaleureux
  var SUN = '#f6c33b';      // jaune des carreaux et de la façade
  var MUSTARD = '#d99a1b';  // jaune moutarde du logo
  var STEEL = '#d7dade';    // plateaux inox
  var uidCounter = 0;

  /* ---------- couleurs ---------- */
  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n) || h.length !== 6) return { r: 160, g: 120, b: 80 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbToHex(c) {
    function p(v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }
    return '#' + p(c.r) + p(c.g) + p(c.b);
  }
  function mix(a, b, t) {
    var x = hexToRgb(a), y = hexToRgb(b);
    return rgbToHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
  }

  /* =========================================================================
     LOGO « M »
     ========================================================================= */
  function logoMark(color, title) {
    var c = color || MUSTARD;
    return '' +
      '<svg class="mi-mark" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + (title || 'Mimo') + '">' +
        '<path d="M21 79 V25 L50 58 L79 25 V79" fill="none" stroke="' + c + '" stroke-width="23" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }
  // Badge rond (M + MIMO + COFFEE SHOP · AIX) — écran de connexion, affiches QR
  function logoBadge(color, bg) {
    var c = color || INK;
    return '' +
      '<svg class="mi-badge" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mimo coffee shop">' +
        '<circle cx="110" cy="110" r="106" fill="' + (bg || SUN) + '"/>' +
        '<g transform="translate(70 34) scale(.8)">' + logoMark(c).replace(/^<svg[^>]*>|<\/svg>$/g, '') + '</g>' +
        '<text x="110" y="150" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-weight="800" font-size="34" fill="' + c + '">Mimo</text>' +
        '<text x="110" y="174" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-size="10" font-weight="700" letter-spacing="2.6" fill="' + c + '">COFFEE SHOP · AIX</text>' +
      '</svg>';
  }

  /* =========================================================================
     MASCOTTE (cookie au trait)
     ========================================================================= */
  function mascot(opts) {
    opts = opts || {};
    var ink = opts.ink || INK, dough = opts.dough || '#f1dcc0';
    return '' +
      '<svg class="mi-mascot" viewBox="0 0 140 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + (opts.title || 'Le cookie de Mimo') + '">' +
        '<g fill="none" stroke="' + ink + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
          // cœur derrière
          '<path d="M70 34 C58 8 18 10 20 42 C22 62 44 74 70 96 C96 74 118 62 120 42 C122 10 82 8 70 34 Z" fill="' + (opts.heart || '#ffffff') + '"/>' +
          // jambes
          '<path d="M58 112 L54 136 L44 138"/><path d="M82 112 L86 136 L96 138"/>' +
          // cookie
          '<circle cx="70" cy="78" r="36" fill="' + dough + '"/>' +
          '<path d="M52 62 q6 -4 10 1 M84 92 q6 3 9 -2 M78 58 q4 4 9 2 M48 88 q5 2 7 -3"/>' +
          // bras + mains posées sur le cookie
          '<path d="M36 72 C22 76 22 92 38 92 L46 90"/><path d="M46 86 l7 1 M46 90 l7 2 M45 94 l6 3"/>' +
          '<path d="M104 72 C118 76 118 92 102 92 L94 90"/><path d="M94 86 l-7 1 M94 90 l-7 2 M95 94 l-6 3"/>' +
        '</g>' +
        '<g fill="' + ink + '"><ellipse cx="60" cy="70" rx="5" ry="4.6"/><ellipse cx="84" cy="74" rx="4.4" ry="4"/><ellipse cx="72" cy="94" rx="5.4" ry="4.8"/><ellipse cx="54" cy="96" rx="2.8" ry="2.6"/><ellipse cx="88" cy="58" rx="3" ry="2.8"/></g>' +
      '</svg>';
  }

  /* =========================================================================
     ILLUSTRATIONS (tuiles) — viewBox 200 × 150
     ========================================================================= */
  var VESSELS = [
    { id: 'layered',  label: 'Verre en couches (matcha, latte fruité)' },
    { id: 'glass',    label: 'Verre glacé (iced latte, cold brew)' },
    { id: 'cup',      label: 'Tasse (boisson chaude)' },
    { id: 'espresso', label: 'Tasse espresso' },
    { id: 'lemonade', label: 'Citronnade / jus' },
    { id: 'cookie',   label: 'Cookie' },
    { id: 'loaf',     label: 'Part de cake (banana bread, marbré…)' },
    { id: 'brownie',  label: 'Brownie' },
    { id: 'slice',    label: 'Part de gâteau' }
  ];

  function tray() {
    return '<ellipse cx="100" cy="134" rx="84" ry="13" fill="' + STEEL + '" stroke="' + mix(STEEL, INK, 0.25) + '" stroke-width="1.6"/>' +
      '<ellipse cx="100" cy="132" rx="70" ry="8.5" fill="#eceef0"/>';
  }
  function steam(color) {
    return '<g fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round" opacity=".5">' +
      '<path d="M88 40 q-6 -7 0 -14 q6 -7 0 -14"/><path d="M100 36 q-6 -7 0 -14 q6 -7 0 -14"/><path d="M112 40 q-6 -7 0 -14 q6 -7 0 -14"/></g>';
  }
  function outline(d, fill, extra) {
    return '<path d="' + d + '" fill="' + (fill || 'none') + '" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round" ' + (extra || '') + '/>';
  }
  var GLASS = 'M68 38 H132 L126 126 Q125 132 119 132 H81 Q75 132 74 126 Z';

  // Verre en couches : purée (bas) · lait (milieu) · matcha / café (haut)
  function vLayered(t, opts) {
    var bottom = opts.fruit || '#e2617a', milk = '#fbf7ef';
    var s = '';
    s += '<path d="M116 14 L108 112" stroke="#b9bec4" stroke-width="5" stroke-linecap="round"/>';
    s += outline(GLASS, '#ffffff', 'fill-opacity=".55"');
    s += '<path d="M70.4 54 H129.6 L127.5 84 H72.5 Z" fill="' + t + '"/>';
    s += '<path d="M72.5 84 H127.5 L126 106 H74 Z" fill="' + milk + '"/>';
    s += '<path d="M74 106 H126 L124.6 126 Q123.9 129.6 119 129.6 H81 Q76.1 129.6 75.4 126 Z" fill="' + bottom + '"/>';
    s += '<path d="M72.5 84 q14 6 27.5 0 t27.5 0" fill="none" stroke="' + mix(t, milk, 0.45) + '" stroke-width="3"/>';
    s += '<path d="M74 106 q13 -5 26 0 t26 0" fill="none" stroke="' + mix(bottom, milk, 0.4) + '" stroke-width="3"/>';
    s += '<g fill="#fff" opacity=".7"><rect x="80" y="46" width="15" height="15" rx="3" transform="rotate(-12 88 54)"/><rect x="102" y="50" width="14" height="14" rx="3" transform="rotate(10 109 57)"/></g>';
    s += '<path d="M78 44 L83 124" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>';
    s += outline(GLASS);
    return s;
  }
  function vGlass(t, opts) {
    var s = '';
    s += '<path d="M116 14 L108 112" stroke="#b9bec4" stroke-width="5" stroke-linecap="round"/>';
    s += outline(GLASS, '#ffffff', 'fill-opacity=".55"');
    s += '<path d="M70.6 52 H129.4 L124.6 126 Q123.9 129.6 119 129.6 H81 Q76.1 129.6 75.4 126 Z" fill="' + t + '"/>';
    if (opts.layer) s += '<path d="M73 92 H127 L124.6 126 Q123.9 129.6 119 129.6 H81 Q76.1 129.6 75.4 126 Z" fill="#fbf7ef" opacity=".8"/>';
    s += '<g fill="#fff" opacity=".75"><rect x="80" y="46" width="16" height="16" rx="3" transform="rotate(-12 88 54)"/><rect x="101" y="52" width="15" height="15" rx="3" transform="rotate(10 108 60)"/><rect x="88" y="66" width="14" height="14" rx="3" transform="rotate(-4 95 73)"/></g>';
    s += '<path d="M78 44 L83 124" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>';
    s += outline(GLASS);
    return s;
  }
  function vLemonade(t, opts) {
    var s = vGlass(t, {});
    s += '<g transform="translate(130 42)"><circle r="13" fill="' + (opts.fruit || '#f4d34c') + '" stroke="' + INK + '" stroke-width="2.2"/>' +
         '<circle r="8.5" fill="#fff6c9" opacity=".7"/><path d="M0 -8.5 V8.5 M-8.5 0 H8.5 M-6 -6 L6 6 M6 -6 L-6 6" stroke="' + (opts.fruit || '#f4d34c') + '" stroke-width="1.6"/></g>';
    return s;
  }
  function vCup(t, opts) {
    var s = opts.hot !== false ? steam(mix(t, INK, 0.5)) : '';
    s += '<ellipse cx="100" cy="124" rx="54" ry="9.5" fill="#fff" stroke="' + INK + '" stroke-width="2.4"/>';
    s += '<path d="M141 79 C163 76 166 101 145 106" fill="none" stroke="' + INK + '" stroke-width="8" stroke-linecap="round"/>';
    s += '<path d="M141 79 C163 76 166 101 145 106" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>';
    s += outline('M58 66 H142 V72 C142 104 124 120 100 120 C76 120 58 104 58 72 Z', '#ffffff');
    s += '<path d="M60 84 H140" stroke="' + SUN + '" stroke-width="5" opacity=".9"/>';
    s += '<ellipse cx="100" cy="67" rx="41" ry="7.5" fill="' + t + '" stroke="' + INK + '" stroke-width="2"/>';
    if (opts.art !== false) s += '<path d="M100 72 C91 67 91 61.5 95.5 61.5 C97.8 61.5 99.4 63 100 64.6 C100.6 63 102.2 61.5 104.5 61.5 C109 61.5 109 67 100 72 Z" fill="#fff" opacity=".9"/>';
    return s;
  }
  function vEspresso(t) {
    var s = steam(mix(t, INK, 0.5));
    s += '<ellipse cx="100" cy="122" rx="44" ry="8.5" fill="#fff" stroke="' + INK + '" stroke-width="2.4"/>';
    s += '<path d="M127 88 C142 86 143 104 127 106" fill="none" stroke="' + INK + '" stroke-width="7" stroke-linecap="round"/>';
    s += '<path d="M127 88 C142 86 143 104 127 106" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>';
    s += outline('M72 80 H128 V84 C128 106 116 118 100 118 C84 118 72 106 72 84 Z', '#ffffff');
    s += '<path d="M73 95 H127" stroke="' + SUN + '" stroke-width="4"/>';
    s += '<ellipse cx="100" cy="81" rx="27" ry="5.2" fill="' + t + '" stroke="' + INK + '" stroke-width="2"/>';
    s += '<ellipse cx="100" cy="81" rx="17" ry="3" fill="#c48a52" opacity=".85"/>';
    return s;
  }
  function vCookie(t, opts) {
    var chip = opts.fruit || '#3a2416';
    var s = '<ellipse cx="100" cy="122" rx="56" ry="10" fill="' + mix(STEEL, '#fff', 0.3) + '" stroke="' + mix(STEEL, INK, 0.3) + '" stroke-width="1.6"/>';
    s += '<path d="M54 98 C50 74 72 58 100 58 C130 58 150 74 146 98 C143 116 124 122 100 122 C74 122 57 116 54 98 Z" fill="' + t + '" stroke="' + INK + '" stroke-width="2.4"/>';
    s += '<path d="M70 80 q8 -5 14 1 M110 76 q8 4 13 -1 M86 104 q6 3 11 -2" fill="none" stroke="' + mix(t, INK, 0.45) + '" stroke-width="2" stroke-linecap="round"/>';
    s += '<g fill="' + chip + '"><path d="M78 90 l6 -3 l4 5 l-6 4 z"/><path d="M104 92 l7 -2 l2 6 l-7 3 z"/><path d="M120 98 l5 -4 l4 4 l-5 4 z"/><path d="M92 74 l5 -2 l3 4 l-5 3 z"/><path d="M66 100 l5 -2 l2 5 l-5 2 z"/></g>';
    return s;
  }
  function vLoaf(t, opts) {
    var s = tray();
    var crust = mix(t, '#5a3412', 0.45);
    s += '<path d="M60 112 L60 70 Q62 54 82 52 L122 52 Q140 54 142 70 L142 112 Z" fill="' + t + '" stroke="' + INK + '" stroke-width="2.4"/>';
    s += '<path d="M60 70 Q62 54 82 52 L122 52 Q140 54 142 70" fill="none" stroke="' + crust + '" stroke-width="7"/>';
    if (opts.fruit) s += '<path d="M66 86 C80 74 92 98 106 84 C118 72 128 92 138 84" fill="none" stroke="' + opts.fruit + '" stroke-width="6" stroke-linecap="round" opacity=".8"/>';
    s += '<g fill="' + mix(t, INK, 0.6) + '"><circle cx="78" cy="96" r="3.4"/><circle cx="104" cy="104" r="3"/><circle cx="124" cy="94" r="3.6"/><circle cx="92" cy="80" r="2.6"/><circle cx="118" cy="72" r="2.4"/></g>';
    s += outline('M60 112 L60 70 Q62 54 82 52 L122 52 Q140 54 142 70 L142 112 Z');
    return s;
  }
  function vBrownie(t) {
    var s = tray();
    s += '<path d="M62 84 L100 70 L140 84 L102 100 Z" fill="' + mix(t, '#fff', 0.12) + '" stroke="' + INK + '" stroke-width="2.4"/>';
    s += '<path d="M62 84 L102 100 L102 122 L62 106 Z" fill="' + mix(t, INK, 0.25) + '" stroke="' + INK + '" stroke-width="2.4"/>';
    s += '<path d="M102 100 L140 84 L140 106 L102 122 Z" fill="' + t + '" stroke="' + INK + '" stroke-width="2.4"/>';
    s += '<path d="M78 82 l6 -2 M96 78 l7 3 M112 86 l6 -2 M88 90 l5 2" stroke="' + mix(t, '#fff', 0.35) + '" stroke-width="2" stroke-linecap="round"/>';
    return s;
  }
  function vSlice(t, opts) {
    var s = tray();
    s += '<path d="M56 110 L138 92 L138 70 L56 88 Z" fill="' + mix(t, '#fff', 0.25) + '" stroke="' + INK + '" stroke-width="2.4"/>';
    s += '<path d="M56 88 L138 70 Q146 74 144 84" fill="none" stroke="' + INK + '" stroke-width="2.4"/>';
    s += '<path d="M56 99 L138 81" stroke="' + (opts.fruit || mix(t, '#5a3412', 0.3)) + '" stroke-width="5"/>';
    s += '<path d="M56 88 C70 76 112 62 138 70" fill="#fff8ec" stroke="' + INK + '" stroke-width="2.2"/>';
    s += '<circle cx="118" cy="64" r="6" fill="' + (opts.fruit || SUN) + '" stroke="' + INK + '" stroke-width="2"/>';
    return s;
  }

  var DRAW = {
    layered: vLayered, glass: vGlass, cup: vCup, espresso: vEspresso, lemonade: vLemonade,
    cookie: vCookie, loaf: vLoaf, brownie: vBrownie, slice: vSlice
  };

  // p : { tint, vessel, temp, layer, fruit, art }
  function tile(p, opts) {
    p = p || {}; opts = opts || {};
    var t = p.tint || '#b07a4f';
    var vessel = DRAW[p.vessel] ? p.vessel : 'cup';
    var id = 'mip' + (++uidCounter);
    var bg = mix(SUN, '#fff8e6', 0.55);
    var draw = DRAW[vessel](t, { hot: p.temp !== 'cold', layer: !!p.layer, fruit: p.fruit, art: p.art });
    return '' +
      '<svg class="mi-tile" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<defs>' +
          '<pattern id="' + id + '" width="25" height="25" patternUnits="userSpaceOnUse">' +
            '<rect width="25" height="25" fill="' + bg + '"/><path d="M0 .75 H25 M.75 0 V25" stroke="#fffdf6" stroke-width="1.5"/>' +
          '</pattern>' +
          '<radialGradient id="' + id + 'g" cx="50%" cy="58%" r="62%"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
        '</defs>' +
        '<rect width="200" height="150" fill="url(#' + id + ')"/>' +
        '<rect width="200" height="150" fill="url(#' + id + 'g)"/>' +
        (opts.noDraw ? '' : draw) +
      '</svg>';
  }

  global.MIMO_ART = {
    INK: INK, CREAM: CREAM, SUN: SUN, MUSTARD: MUSTARD,
    logoMark: logoMark, logoBadge: logoBadge, mascot: mascot, tile: tile, mix: mix, VESSELS: VESSELS
  };
})(window);
