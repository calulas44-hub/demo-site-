/* ============================================================================
   MOZAÏK – Visuels vectoriels (visuals.js)
   ----------------------------------------------------------------------------
   • Logo : le « gâteau damier » surmonté d'une cerise, sur son présentoir
     (redessiné en SVG d'après la carte officielle, couleur vert Mozaïk).
   • Illustrations des boissons : une « tuile » façon céramique d'Anatolie,
     teintée de la couleur de la boisson, avec le contenant adapté (verre glacé,
     tasse latte, tasse turque, verre à thé tulipe, cezve dans le sable…).
     Elles servent tant qu'aucune vraie photo n'a été ajoutée depuis l'admin.
   ==========================================================================*/
(function (global) {
  'use strict';

  var INK = '#22392a';          // vert profond Mozaïk (traits)
  var CREAM = '#f7f1e3';
  var IZNIK_BLUE = '#2f5aa8';
  var IZNIK_RED = '#c8332b';
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
  // mix(a, b, t) : t=0 → a, t=1 → b
  function mix(a, b, t) {
    var x = hexToRgb(a), y = hexToRgb(b);
    return rgbToHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
  }

  /* =========================================================================
     LOGO
     ========================================================================= */
  function logoMark(color, title) {
    var c = color || INK;
    var squares = '';
    for (var r = 0; r < 5; r++) {
      for (var col = 0; col < 5; col++) {
        if ((r + col) % 2 === 0) squares += '<rect x="' + (25 + col * 10) + '" y="' + (27 + r * 10) + '" width="10.2" height="10.2"/>';
      }
    }
    return '' +
      '<svg class="mz-mark" viewBox="0 0 100 116" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + (title || 'Mozaïk') + '">' +
        '<g fill="' + c + '">' +
          '<path d="M50 13.5 C50.4 8.5 48 4.5 43.5 2.2" fill="none" stroke="' + c + '" stroke-width="2.4" stroke-linecap="round"/>' +
          '<circle cx="50" cy="19.5" r="6.6"/>' +
          '<circle cx="47.6" cy="17.4" r="1.7" fill="#fff" opacity=".55"/>' +
          squares +
          '<path d="M17 77 H83 V82 a8.25 8.25 0 0 1 -16.5 0 a8.25 8.25 0 0 1 -16.5 0 a8.25 8.25 0 0 1 -16.5 0 a8.25 8.25 0 0 1 -16.5 0 Z"/>' +
          '<path d="M44.5 89 H55.5 L54 100 C55 106 62 109 68.5 110.8 V113.5 H31.5 V110.8 C38 109 45 106 46 100 Z"/>' +
        '</g>' +
      '</svg>';
  }

  // Badge rond complet (marque + MOZAIK + BIO COFFEE SHOP), utilisé sur le QR/ticket
  function logoBadge(color, bg) {
    var c = color || INK;
    return '' +
      '<svg class="mz-badge" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mozaïk Bio Coffee Shop">' +
        '<circle cx="110" cy="110" r="106" fill="' + (bg || CREAM) + '" stroke="' + c + '" stroke-width="2"/>' +
        '<g transform="translate(72 30) scale(.76)">' + logoMark(c).replace(/^<svg[^>]*>|<\/svg>$/g, '') + '</g>' +
        '<text x="110" y="152" text-anchor="middle" font-family="Marcellus, Georgia, serif" font-size="27" letter-spacing="6" fill="' + c + '">MOZAÏK</text>' +
        '<line x1="102" y1="163" x2="118" y2="163" stroke="' + c + '" stroke-width="1.2"/>' +
        '<text x="110" y="178" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="8.5" font-weight="700" letter-spacing="2.4" fill="' + c + '">BIO COFFEE SHOP</text>' +
      '</svg>';
  }

  /* =========================================================================
     ILLUSTRATIONS (tuiles) — viewBox 200 × 150
     ========================================================================= */
  var VESSELS = [
    { id: 'glass',    label: 'Verre glacé (boissons froides)' },
    { id: 'lemonade', label: 'Limonade (verre + citron)' },
    { id: 'cup',      label: 'Tasse latte' },
    { id: 'espresso', label: 'Tasse espresso' },
    { id: 'turkish',  label: 'Tasse de café turc' },
    { id: 'tea',      label: 'Verre à thé tulipe' },
    { id: 'cezve',    label: 'Cezve dans le sable' },
    { id: 'v60',      label: 'Café filtre V60' },
    { id: 'flight',   label: 'Trio de mini verres' },
    { id: 'baklava',  label: 'Baklava' },
    { id: 'kunefe',   label: 'Künefe' },
    { id: 'pastry',   label: 'Pâtisserie' }
  ];

  function steam(color) {
    return '<g fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round" opacity=".55">' +
      '<path d="M86 40 q-6 -7 0 -14 q6 -7 0 -14"/><path d="M100 36 q-6 -7 0 -14 q6 -7 0 -14"/><path d="M114 40 q-6 -7 0 -14 q6 -7 0 -14"/></g>';
  }
  function outline(d, fill, extra) {
    return '<path d="' + d + '" fill="' + (fill || 'none') + '" stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round" ' + (extra || '') + '/>';
  }

  function vGlass(t, opts) {
    var liquid = 'M72.6 58 H127.4 L122 126 Q121.4 130.6 116.5 130.6 H83.5 Q78.6 130.6 78 126 Z';
    var s = '';
    s += '<path d="M116 18 L107 112" stroke="' + (opts.straw || '#c9a26b') + '" stroke-width="6" stroke-linecap="round"/>';
    s += outline('M70 40 H130 L124 128 Q123 134 117 134 H83 Q77 134 76 128 Z', '#ffffff', 'fill-opacity=".55"');
    s += '<path d="' + liquid + '" fill="' + t + '"/>';
    if (opts.layer) {
      s += '<path d="M72.6 58 H127.4 L126 78 H74 Z" fill="#fff" opacity=".42"/>';
      s += '<path d="M76.5 112 H123.5 L122 126 Q121.4 130.6 116.5 130.6 H83.5 Q78.6 130.6 78 126 Z" fill="' + mix(t, '#2a1a10', 0.35) + '" opacity=".55"/>';
    }
    s += '<g fill="#fff" opacity=".78"><rect x="80" y="50" width="16" height="16" rx="3" transform="rotate(-12 88 58)"/><rect x="101" y="55" width="15" height="15" rx="3" transform="rotate(10 108 62)"/><rect x="88" y="70" width="14" height="14" rx="3" transform="rotate(-4 95 77)"/></g>';
    s += '<path d="M80 46 L85 124" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>';
    s += outline('M70 40 H130 L124 128 Q123 134 117 134 H83 Q77 134 76 128 Z');
    return s;
  }
  function vLemonade(t, opts) {
    var s = vGlass(t, { straw: '#e9d7a5' });
    s += '<g transform="translate(128 44)"><circle r="13" fill="' + (opts.fruit || '#f4d34c') + '" stroke="' + INK + '" stroke-width="2.2"/>' +
         '<circle r="8.5" fill="#fff6c9" opacity=".7"/><path d="M0 -8.5 V8.5 M-8.5 0 H8.5 M-6 -6 L6 6 M6 -6 L-6 6" stroke="' + (opts.fruit || '#f4d34c') + '" stroke-width="1.6"/></g>';
    s += '<path d="M58 30 q6 -10 14 -6 q-2 10 -14 6z" fill="#6f9b4a" stroke="' + INK + '" stroke-width="1.6"/>';
    return s;
  }
  function vCup(t, opts) {
    var s = opts.hot !== false ? steam(mix(t, INK, 0.5)) : '';
    s += '<ellipse cx="100" cy="126" rx="56" ry="10" fill="#fff" stroke="' + INK + '" stroke-width="2.4"/>';
    s += '<path d="M141 79 C163 76 166 101 145 106" fill="none" stroke="' + INK + '" stroke-width="8" stroke-linecap="round"/>';
    s += '<path d="M141 79 C163 76 166 101 145 106" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>';
    s += outline('M58 66 H142 V72 C142 104 124 122 100 122 C76 122 58 104 58 72 Z', '#ffffff');
    s += '<path d="M61 86 H139" stroke="' + IZNIK_BLUE + '" stroke-width="3" opacity=".75"/>';
    s += '<path d="M64 93 H136" stroke="' + IZNIK_BLUE + '" stroke-width="1.4" opacity=".5" stroke-dasharray="3 4"/>';
    s += '<ellipse cx="100" cy="67" rx="41" ry="7.5" fill="' + t + '" stroke="' + INK + '" stroke-width="2"/>';
    if (opts.art !== false) s += '<path d="M100 72 C91 67 91 61.5 95.5 61.5 C97.8 61.5 99.4 63 100 64.6 C100.6 63 102.2 61.5 104.5 61.5 C109 61.5 109 67 100 72 Z" fill="#fff" opacity=".9"/>';
    return s;
  }
  function vEspresso(t) {
    var s = steam(mix(t, INK, 0.5));
    s += '<ellipse cx="100" cy="124" rx="44" ry="8.5" fill="#fff" stroke="' + INK + '" stroke-width="2.4"/>';
    s += '<path d="M127 88 C142 86 143 104 127 106" fill="none" stroke="' + INK + '" stroke-width="7" stroke-linecap="round"/>';
    s += '<path d="M127 88 C142 86 143 104 127 106" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>';
    s += outline('M72 80 H128 V84 C128 106 116 119 100 119 C84 119 72 106 72 84 Z', '#ffffff');
    s += '<path d="M74 96 H126" stroke="' + IZNIK_BLUE + '" stroke-width="2.4" opacity=".7"/>';
    s += '<ellipse cx="100" cy="81" rx="27" ry="5.2" fill="' + t + '" stroke="' + INK + '" stroke-width="2"/>';
    s += '<ellipse cx="100" cy="81" rx="17" ry="3" fill="#c48a52" opacity=".85"/>';
    return s;
  }
  function vTurkish(t) {
    var s = steam(mix(t, '#ffffff', 0.25));
    s += '<ellipse cx="100" cy="124" rx="46" ry="9" fill="#fff" stroke="' + INK + '" stroke-width="2.4"/>';
    s += '<ellipse cx="100" cy="124" rx="33" ry="5.5" fill="none" stroke="' + IZNIK_BLUE + '" stroke-width="2" opacity=".7"/>';
    s += '<path d="M124 84 C135 84 136 98 123 100" fill="none" stroke="' + INK + '" stroke-width="6" stroke-linecap="round"/>';
    s += '<path d="M124 84 C135 84 136 98 123 100" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>';
    s += outline('M74 76 H126 L122 110 C121 118 114 121 106 121 H94 C86 121 79 118 78 110 Z', '#ffffff');
    // motif tulipe d'Iznik
    s += '<path d="M100 112 V100" stroke="#3f7a3a" stroke-width="2"/><path d="M100 107 q-7 -2 -9 -8 q7 0 9 8z M100 107 q7 -2 9 -8 q-7 0 -9 8z" fill="#3f7a3a"/>';
    s += '<path d="M100 88 C94.5 92 95 99 100 102 C105 99 105.5 92 100 88 Z" fill="' + IZNIK_RED + '"/>';
    s += '<path d="M100 102 C96 99 93 95 93.5 91 C96.5 93 98.5 97 100 102 Z M100 102 C104 99 107 95 106.5 91 C103.5 93 101.5 97 100 102 Z" fill="' + mix(IZNIK_RED, '#000', 0.15) + '"/>';
    s += '<g fill="' + IZNIK_BLUE + '"><circle cx="84" cy="94" r="2.8"/><circle cx="116" cy="94" r="2.8"/><circle cx="87" cy="106" r="2"/><circle cx="113" cy="106" r="2"/></g>';
    s += '<ellipse cx="100" cy="76" rx="26" ry="5" fill="' + t + '" stroke="' + INK + '" stroke-width="2"/>';
    s += '<ellipse cx="100" cy="76" rx="19" ry="3.2" fill="#8a5a36" opacity=".85"/>';
    return s;
  }
  function vTea(t) {
    var s = steam(mix(t, '#ffffff', 0.2));
    s += '<ellipse cx="100" cy="127" rx="40" ry="8" fill="#fff" stroke="' + IZNIK_RED + '" stroke-width="3"/>';
    s += '<path d="M85 58 C81 70 83 77 92 84 C82 92 80 107 86 121 H114 C120 107 118 92 108 84 C117 77 119 70 115 58 Z" fill="' + t + '" opacity=".92"/>';
    s += '<path d="M86 64 C84 72 86 78 93 83" stroke="#fff" stroke-width="2.6" fill="none" opacity=".55" stroke-linecap="round"/>';
    s += outline('M84 50 C79 66 82 76 92 84 C82 92 80 108 86 122 H114 C120 108 118 92 108 84 C118 76 121 66 116 50 Z', 'none');
    s += '<path d="M110 40 L95 116" stroke="#b8b8b8" stroke-width="3" stroke-linecap="round"/>';
    return s;
  }
  function vCezve(t) {
    var s = '';
    s += steam('#8a6a4a');
    s += outline('M30 112 H170 L161 134 H39 Z', '#a8703f');
    s += '<path d="M36 118 H164" stroke="#7d4f28" stroke-width="2" opacity=".6"/>';
    s += '<ellipse cx="100" cy="112" rx="66" ry="10" fill="#e8d2a2" stroke="' + INK + '" stroke-width="2"/>';
    s += '<path d="M118 82 L160 50" stroke="' + INK + '" stroke-width="8" stroke-linecap="round"/><path d="M118 82 L160 50" stroke="#d9a55a" stroke-width="3.6" stroke-linecap="round"/>';
    s += outline('M80 70 H120 L115 79 C124 90 124 106 117 113 H83 C76 106 76 90 85 79 Z', '#c8743a');
    s += '<path d="M83 86 C92 90 108 90 117 86" stroke="#8a4b20" stroke-width="2" fill="none" opacity=".6"/>';
    s += '<path d="M85 74 L80 70" stroke="' + INK + '" stroke-width="2.4" stroke-linecap="round"/>';
    s += '<ellipse cx="100" cy="71" rx="19" ry="3.6" fill="' + t + '"/>';
    s += '<path d="M46 116 C66 104 134 104 154 116 C140 121 60 121 46 116 Z" fill="#e8d2a2" stroke="' + INK + '" stroke-width="1.6"/>';
    s += '<g fill="#cfb27c" opacity=".8"><circle cx="64" cy="114" r="1.3"/><circle cx="76" cy="111" r="1.1"/><circle cx="128" cy="112" r="1.2"/><circle cx="140" cy="115" r="1.3"/><circle cx="110" cy="116" r="1"/></g>';
    return s;
  }
  function vV60(t) {
    var s = '';
    s += outline('M74 96 C69 114 76 129 100 131 C124 129 131 114 126 96 Z', '#ffffff', 'fill-opacity=".6"');
    s += '<path d="M73.5 108 C74 121 82 129.5 100 130.5 C118 129.5 126 121 126.5 108 Z" fill="' + t + '"/>';
    s += '<rect x="80" y="88" width="40" height="9" rx="3" fill="#fff" stroke="' + INK + '" stroke-width="2.2"/>';
    s += outline('M66 46 H134 L114 88 H86 Z', '#ffffff');
    s += '<path d="M80 54 L92 84 M100 54 V84 M120 54 L108 84" stroke="' + INK + '" stroke-width="1.4" opacity=".45"/>';
    s += '<path d="M134 52 C148 52 146 70 128 66" fill="none" stroke="' + INK + '" stroke-width="2.4"/>';
    s += '<path d="M100 92 V104" stroke="' + mix(t, '#000', 0.2) + '" stroke-width="3" stroke-linecap="round"/>';
    return s;
  }
  function vFlight(t, opts) {
    var tints = opts.tints || ['#7fa650', '#8e6bbf', '#e3a72f'];
    var s = outline('M34 118 H166 V128 Q166 132 162 132 H38 Q34 132 34 128 Z', '#b98552');
    [62, 100, 138].forEach(function (x, i) {
      s += outline('M' + (x - 15) + ' 64 H' + (x + 15) + ' L' + (x + 12) + ' 114 Q' + (x + 11.6) + ' 118 ' + (x + 8) + ' 118 H' + (x - 8) + ' Q' + (x - 11.6) + ' 118 ' + (x - 12) + ' 114 Z', '#ffffff', 'fill-opacity=".55"');
      s += '<path d="M' + (x - 13.6) + ' 74 H' + (x + 13.6) + ' L' + (x + 11.4) + ' 112 Q' + (x + 11) + ' 115.6 ' + (x + 7.6) + ' 115.6 H' + (x - 7.6) + ' Q' + (x - 11) + ' 115.6 ' + (x - 11.4) + ' 112 Z" fill="' + tints[i % tints.length] + '"/>';
      s += '<path d="M' + (x - 13.6) + ' 74 H' + (x + 13.6) + ' L' + (x + 13) + ' 84 H' + (x - 13) + ' Z" fill="#fff" opacity=".45"/>';
      s += outline('M' + (x - 15) + ' 64 H' + (x + 15) + ' L' + (x + 12) + ' 114 Q' + (x + 11.6) + ' 118 ' + (x + 8) + ' 118 H' + (x - 8) + ' Q' + (x - 11.6) + ' 118 ' + (x - 12) + ' 114 Z');
    });
    return s;
  }
  function plate() {
    return '<ellipse cx="100" cy="116" rx="70" ry="17" fill="#fff" stroke="' + INK + '" stroke-width="2.4"/>' +
      '<ellipse cx="100" cy="114" rx="54" ry="11" fill="none" stroke="' + IZNIK_BLUE + '" stroke-width="2" opacity=".6"/>';
  }
  function vBaklava(t) {
    var s = plate();
    var pieces = [[70, 98], [100, 92], [130, 98], [85, 110], [115, 110]];
    pieces.forEach(function (p) {
      var x = p[0], y = p[1];
      s += '<path d="M' + x + ' ' + (y - 16) + ' L' + (x + 17) + ' ' + y + ' L' + x + ' ' + (y + 8) + ' L' + (x - 17) + ' ' + y + ' Z" fill="' + mix(t, '#fff', 0.15) + '" stroke="' + INK + '" stroke-width="2"/>';
      s += '<path d="M' + (x - 17) + ' ' + y + ' L' + x + ' ' + (y + 8) + ' L' + (x + 17) + ' ' + y + ' V' + (y + 5) + ' L' + x + ' ' + (y + 13) + ' L' + (x - 17) + ' ' + (y + 5) + ' Z" fill="' + mix(t, '#5a3412', 0.35) + '" stroke="' + INK + '" stroke-width="1.6"/>';
      s += '<path d="M' + (x - 6) + ' ' + (y - 4) + ' L' + x + ' ' + (y - 9) + ' L' + (x + 6) + ' ' + (y - 4) + ' L' + x + ' ' + (y + 1) + ' Z" fill="#7fa650"/>';
    });
    return s;
  }
  function vKunefe(t) {
    var s = plate();
    s += '<ellipse cx="100" cy="106" rx="42" ry="14" fill="' + mix(t, '#7a3a10', 0.25) + '" stroke="' + INK + '" stroke-width="2.2"/>';
    s += '<ellipse cx="100" cy="100" rx="42" ry="14" fill="' + t + '" stroke="' + INK + '" stroke-width="2.2"/>';
    var lines = '';
    for (var i = -36; i <= 36; i += 6) lines += '<path d="M' + (100 + i) + ' ' + (92 + Math.abs(i) / 6) + ' q3 8 0 ' + (16 - Math.abs(i) / 3) + '" stroke="' + mix(t, '#ffffff', 0.35) + '" stroke-width="1.6" fill="none" opacity=".8"/>';
    s += lines;
    s += '<g fill="#7fa650"><circle cx="92" cy="98" r="3"/><circle cx="104" cy="96" r="2.6"/><circle cx="110" cy="103" r="2.8"/><circle cx="96" cy="105" r="2.4"/><circle cx="101" cy="100" r="2.2"/></g>';
    s += steam('#b07a4a');
    return s;
  }
  function vPastry(t) {
    var s = plate();
    s += outline('M66 108 L132 108 L132 84 Q100 62 66 84 Z', mix(t, '#fff', 0.35));
    s += '<path d="M66 92 Q100 74 132 92" stroke="' + mix(t, '#5a3412', 0.3) + '" stroke-width="5" fill="none"/>';
    s += '<path d="M66 100 H132" stroke="' + mix(t, '#5a3412', 0.3) + '" stroke-width="3"/>';
    s += '<circle cx="100" cy="70" r="7" fill="' + IZNIK_RED + '" stroke="' + INK + '" stroke-width="2"/>';
    s += '<path d="M100 63 C101 58 104 55 108 54" stroke="' + INK + '" stroke-width="2" fill="none"/>';
    return s;
  }

  var DRAW = {
    glass: vGlass, lemonade: vLemonade, cup: vCup, espresso: vEspresso, turkish: vTurkish, tea: vTea,
    cezve: vCezve, v60: vV60, flight: vFlight, baklava: vBaklava, kunefe: vKunefe, pastry: vPastry
  };

  // p : { tint, vessel, temp, layer, tints, fruit }
  function tile(p, opts) {
    p = p || {}; opts = opts || {};
    var t = p.tint || '#b07a4f';
    var vessel = DRAW[p.vessel] ? p.vessel : 'cup';
    var id = 'mzp' + (++uidCounter);
    var bg = mix(t, CREAM, 0.74);
    var bg2 = mix(t, CREAM, 0.6);
    var draw = DRAW[vessel](t, {
      hot: p.temp !== 'cold', layer: !!p.layer, tints: p.tints, fruit: p.fruit, art: p.art
    });
    return '' +
      '<svg class="mz-tile" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<defs>' +
          '<pattern id="' + id + '" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
            '<rect width="11" height="11" fill="#fff" opacity=".22"/><rect x="11" y="11" width="11" height="11" fill="#fff" opacity=".22"/>' +
          '</pattern>' +
          '<radialGradient id="' + id + 'g" cx="50%" cy="55%" r="60%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
        '</defs>' +
        '<rect width="200" height="150" fill="' + bg + '"/>' +
        '<rect width="200" height="150" fill="url(#' + id + ')"/>' +
        '<rect width="200" height="150" fill="url(#' + id + 'g)"/>' +
        '<rect x="0" y="140" width="200" height="10" fill="' + bg2 + '"/>' +
        (opts.noDraw ? '' : draw) +
      '</svg>';
  }

  global.MZ_ART = {
    INK: INK, CREAM: CREAM,
    logoMark: logoMark, logoBadge: logoBadge, tile: tile, mix: mix, VESSELS: VESSELS
  };
})(window);
