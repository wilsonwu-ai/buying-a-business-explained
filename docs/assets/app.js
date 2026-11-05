/* Buying a Business, Explained: diagrams and motion.
   Every number shown comes from window.MODEL (docs/assets/data.js).
   The HTML already holds the final state, so the page reads correctly with no script.
   Motion needs GSAP and ScrollTrigger and is skipped for prefers-reduced-motion. */
(function () {
  'use strict';

  var doc = document;
  var M = window.MODEL || null;
  var gs = window.gsap;
  var ST = window.ScrollTrigger;
  var hasGsap = !!(gs && typeof gs.to === 'function');
  var reduce = false;
  try {
    reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e0) {
    reduce = false;
  }
  var canTween = hasGsap && !reduce;
  var canScroll = canTween && !!ST;
  if (canScroll) {
    try {
      gs.registerPlugin(ST);
    } catch (e1) {
      canScroll = false;
    }
  }
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------- small helpers ---------- */
  function qs(sel, root) { return (root || doc).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function setText(el, t) { if (el && el.textContent !== t) { el.textContent = t; } }
  function copyProps(dst, src) {
    for (var k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) { dst[k] = src[k]; }
    }
    return dst;
  }
  function svgEl(name, attrs, text) {
    var e = doc.createElementNS(SVGNS, name);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) { e.setAttribute(k, attrs[k]); }
    }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }
  function clearNode(node) { while (node.firstChild) { node.removeChild(node.firstChild); } }
  function safe(fn) {
    try { fn(); } catch (err) {
      if (window.console && window.console.warn) { window.console.warn('Skipped a block:', err); }
    }
  }

  /* ---------- number formats (same rounding as model/worked_example.md) ---------- */
  /* Python rounds exact ties to even ($212,500 is "$212K"); toFixed rounds them up. */
  function halfEven(x, d) {
    var a = Math.abs(x);
    var s = a.toFixed(d);
    var probe = a.toFixed(d + 30);
    var dot = probe.indexOf('.');
    var tail = probe.slice(dot + 1 + d);
    if (tail.charAt(0) === '5' && /^50*$/.test(tail)) {
      var head = d > 0 ? probe.slice(0, dot + 1 + d) : probe.slice(0, dot);
      var last = head.charAt(head.length - 1);
      if ((+last) % 2 === 0) { s = head; }
    }
    return (x < 0 && Number(s) !== 0 ? '-' : '') + s;
  }
  function money(v) {
    if (v === null || v === undefined || isNaN(v)) { return 'n/a'; }
    var a = Math.abs(v);
    var sign = v < 0 ? '-' : '';
    if (a < 1e6) { return sign + '$' + halfEven(a / 1000, 0) + 'K'; }
    return sign + '$' + halfEven(a / 1e6, 2) + 'M';
  }
  function moneyWhole(v) {
    if (v >= 1e6 && v % 1e6 === 0) { return '$' + (v / 1e6) + 'M'; }
    return money(v);
  }
  function ratio(v) { return halfEven(v, 2) + 'x'; }
  function mult(v) {
    var r = Math.round(v * 10) / 10;
    return (Math.abs(v - r) < 1e-9 ? r.toFixed(1) : halfEven(v, 2)) + 'x';
  }
  function pct1(v) { return halfEven(v * 100, 1) + '%'; }
  function pct0(v) { return Math.round(v * 100) + '%'; }
  function pctAuto(v) {
    var p = v * 100;
    return (Math.abs(p - Math.round(p)) < 0.05 ? String(Math.round(p)) : halfEven(p, 1)) + '%';
  }
  function num(v) { return String(v); }
  var FORMATS = { m: money, mc: moneyWhole, x: ratio, mx: mult, p: pct1, p0: pct0, pa: pctAuto, n: num };

  /* ---------- values derived from MODEL ---------- */
  var derived = {};
  function computeDerived() {
    var i = M.inputs;
    derived.growth = M.paydown_4x_growth5[1].ebitda / M.paydown_4x_growth5[0].ebitda - 1;
    derived.seller_share = i.injection - i.own_cash;
    derived.sba_share = 1 - i.injection;
  }
  function get(path) {
    if (path.charAt(0) === '@') { return derived[path.slice(1)]; }
    var parts = path.split('.');
    var cur = M;
    for (var k = 0; k < parts.length; k++) {
      if (cur === null || cur === undefined) { return undefined; }
      cur = cur[parts[k]];
    }
    return cur;
  }
  function bindAll() {
    qsa('[data-m]').forEach(function (el) {
      var v = get(el.getAttribute('data-m'));
      var f = FORMATS[el.getAttribute('data-f') || 'm'];
      if (v === undefined || v === null || !f) { return; }
      setText(el, f(v));
    });
  }

  /* ---------- shared motion helper: items light up as they scroll in ---------- */
  function litBatch(items) {
    if (!canScroll || !items.length) { return; }
    items.forEach(function (el) { el.classList.remove('is-lit'); });
    gs.set(items, { opacity: 0.55, y: 10 });
    ST.batch(items, {
      start: 'clamp(top 88%)',
      once: true,
      onEnter: function (els) {
        els.forEach(function (el, i) {
          gs.to(el, {
            opacity: 1, y: 0, duration: 0.6, delay: i * 0.1, ease: 'power2.out',
            onStart: function () { el.classList.add('is-lit'); }
          });
        });
      }
    });
  }
  function onceIn(trigger, fn, start) {
    ST.create({ trigger: trigger, start: start || 'clamp(top 80%)', once: true, onEnter: fn });
  }

  /* ---------- 1. how it works ---------- */
  function initHow() {
    var root = qs('#dg-how-it-works');
    if (!root) { return; }
    litBatch(qsa('.step', root));
  }

  /* ---------- 2. capital stack ---------- */
  function initStack() {
    var root = qs('#dg-capital-stack');
    if (!root) { return; }
    var svg = qs('#stk-svg', root);
    var K = ['sba', 'seller', 'cash', 'inv'];
    var X0 = 12, W = 100, BASE = 376, PPM = 64, GAP = 44, LX = 140;
    var rect = {}, lab = {};
    K.forEach(function (k) {
      rect[k] = qs('#stk-r-' + k, svg);
      var grp = qs('#stk-l-' + k, svg);
      lab[k] = { g: grp, ld: qs('.leader', grp), n: qs('.lbl-n', grp), a: qs('.lbl-a', grp) };
    });
    var totalEl = qs('#stk-total', svg);
    var fPrice = qs('#stk-price', root), fMult = qs('#stk-mult', root), fCost = qs('#stk-cost', root);
    var fPay = qs('#stk-pay', root), fDscr = qs('#stk-dscr', root), fBadge = qs('#stk-badge', root);
    var status = qs('#stk-status', root);
    var buttons = qsa('.chip', root);
    var floor = M.inputs.dscr_floor;
    var ebitda = M.inputs.ebitda;
    var names = {
      A_4x_no_investors: mult(M.A_4x_no_investors.multiple) + ' price',
      B_5x_no_investors: mult(M.B_5x_no_investors.multiple) + ' price',
      C_5x_with_investors: mult(M.C_5x_with_investors.multiple) + ' + investors',
      D_price_that_works_no_investors: 'Lower price'
    };
    buttons.forEach(function (b) {
      var nm = names[b.getAttribute('data-case')];
      if (nm) { setText(b, nm); }
    });
    var S = { sba: 0, seller: 0, cash: 0, inv: 0, price: 0, cost: 0, pay: 0, dscr: 0 };
    var current = 'A_4x_no_investors';
    var introDone = false;

    function target(key) {
      var c = M[key];
      return {
        sba: c.sba_loan, seller: c.standby_seller_note, cash: c.buyer_cash, inv: c.investor_equity,
        price: c.price, cost: c.project_cost, pay: c.annual_sba_payment, dscr: c.dscr
      };
    }
    function describe(key) {
      var c = M[key];
      var p = ['SBA loan ' + money(c.sba_loan), 'seller note on standby ' + money(c.standby_seller_note), 'your cash ' + money(c.buyer_cash)];
      if (c.investor_equity > 0) { p.push('investors ' + money(c.investor_equity)); }
      return p.join(', ');
    }
    function render() {
      var total = S.sba + S.seller + S.cash + S.inv;
      var y = BASE;
      var c = {}, hgt = {};
      K.forEach(function (k) {
        var h = Math.max(0, S[k] * PPM / 1e6);
        y -= h;
        hgt[k] = h;
        c[k] = y + h / 2;
        rect[k].setAttribute('y', y.toFixed(2));
        rect[k].setAttribute('height', h.toFixed(2));
      });
      setText(totalEl, 'Project cost ' + money(S.cost));
      totalEl.setAttribute('y', Math.max(22, y - 14).toFixed(1));
      totalEl.setAttribute('opacity', S.cost > 1000 ? '1' : '0');
      var prev = -1e9;
      ['inv', 'cash', 'seller', 'sba'].forEach(function (k) {
        var L = lab[k];
        if (hgt[k] < 1.5) { L.g.setAttribute('visibility', 'hidden'); return; }
        L.g.setAttribute('visibility', 'visible');
        var ly = Math.max(c[k], prev + GAP);
        prev = ly;
        L.n.setAttribute('y', (ly - 3).toFixed(1));
        L.a.setAttribute('y', (ly + 15).toFixed(1));
        L.ld.setAttribute('d', 'M' + (X0 + W) + ',' + c[k].toFixed(1) + ' H' + (X0 + W + 12) + ' V' + ly.toFixed(1) + ' H' + (LX - 6));
        setText(L.a, money(S[k]) + ' · ' + pctAuto(total ? S[k] / total : 0));
      });
      setText(fPrice, money(S.price));
      setText(fMult, mult(S.price / ebitda));
      setText(fCost, money(S.cost));
      setText(fPay, money(S.pay));
      setText(fDscr, ratio(S.dscr));
      var ok = S.dscr >= floor - 1e-9;
      fBadge.className = 'badge ' + (ok ? 'pass' : 'fail');
      setText(fBadge, ok ? 'Pass' : 'Fail');
    }
    function describeNow(byUser) {
      var c = M[current];
      svg.setAttribute('aria-label', 'Stacked bar of the project cost for the ' + names[current] + ' case: ' + describe(current) + '.');
      if (byUser && status) {
        status.textContent = names[current] + ': ' + describe(current) + '. Price ' + money(c.price) +
          ', project cost ' + money(c.project_cost) + ', yearly SBA payment ' + money(c.annual_sba_payment) +
          ', debt coverage ' + ratio(c.dscr) + ', ' + (c.dscr >= floor - 1e-9 ? 'pass' : 'fail') + '.';
      }
    }
    function selectCase(key, byUser) {
      if (!M[key]) { return; }
      current = key;
      if (byUser) { introDone = true; }
      buttons.forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-case') === key ? 'true' : 'false');
      });
      var t = target(key);
      if (canTween) {
        gs.to(S, copyProps({
          duration: 0.7, ease: 'power2.out', overwrite: true, onUpdate: render,
          onComplete: function () { copyProps(S, t); render(); describeNow(byUser); }
        }, t));
      } else {
        copyProps(S, t);
        render();
        describeNow(byUser);
      }
    }
    function playIntro() {
      if (introDone) { return; }
      introDone = true;
      var t = target(current);
      var tl = gs.timeline({
        defaults: { ease: 'power2.out' }, onUpdate: render,
        onComplete: function () { copyProps(S, t); render(); describeNow(false); }
      });
      tl.to(S, { sba: t.sba, duration: 0.9 }, 0);
      tl.to(S, { seller: t.seller, duration: 0.5 }, 0.55);
      tl.to(S, { cash: t.cash, duration: 0.5 }, 0.8);
      tl.to(S, { inv: t.inv, duration: 0.5 }, 1.05);
      tl.to(S, { price: t.price, cost: t.cost, pay: t.pay, dscr: t.dscr, duration: 1.2 }, 0.1);
    }

    buttons.forEach(function (b) {
      b.addEventListener('click', function () { selectCase(b.getAttribute('data-case'), true); });
    });
    if (canScroll) {
      render();
      onceIn(root, playIntro);
    } else {
      copyProps(S, target(current));
      render();
      describeNow(false);
    }
  }

  /* ---------- 3. the 5% rule ---------- */
  function initRule() {
    var root = qs('#dg-five-percent-rule');
    if (!root) { return; }
    var range = qs('#cash-range', root);
    var outCash = qs('#cash-out', root);
    var outProj = qs('#rule-proj', root);
    var strip = qs('#rule-blocks', root);
    var tbody = qs('#rule-rows', root);
    var own = M.inputs.own_cash;
    var touched = false;

    if (strip) {
      var n = Math.round(1 / own);
      var nOwn = Math.round(own * n);
      var nSeller = Math.round((M.inputs.injection - own) * n);
      var nSba = n - nOwn - nSeller;
      clearNode(strip);
      [['cash', nOwn], ['seller', nSeller], ['sba', nSba]].forEach(function (p) {
        for (var i = 0; i < p[1]; i++) {
          var s = doc.createElement('span');
          s.className = 'cell c-' + p[0];
          strip.appendChild(s);
        }
      });
      strip.style.gridTemplateColumns = 'repeat(' + n + ', minmax(0, 1fr))';
    }
    if (tbody) {
      clearNode(tbody);
      Object.keys(M.cash_to_max_project).sort(function (a, b) { return Number(a) - Number(b); }).forEach(function (k) {
        var tr = doc.createElement('tr');
        var th = doc.createElement('th');
        th.setAttribute('scope', 'row');
        th.textContent = money(Number(k));
        var td = doc.createElement('td');
        td.textContent = money(M.cash_to_max_project[k]);
        td.setAttribute('data-v', String(M.cash_to_max_project[k]));
        tr.appendChild(th);
        tr.appendChild(td);
        tbody.appendChild(tr);
      });
    }
    setText(qs('#cash-min', root), money(Number(range.min)));
    setText(qs('#cash-max', root), money(Number(range.max)));

    function update() {
      var cash = Number(range.value);
      setText(outCash, money(cash));
      setText(outProj, money(cash / own));
      var lo = Number(range.min), hi = Number(range.max);
      range.style.setProperty('--fill', (((cash - lo) / (hi - lo)) * 100).toFixed(1) + '%');
      range.setAttribute('aria-valuetext', money(cash) + ' of your own cash, largest project ' + money(cash / own));
    }
    range.addEventListener('input', function () { touched = true; update(); });
    update();

    if (canScroll) {
      var cells = qsa('.cell', strip);
      var vals = qsa('td[data-v]', tbody);
      gs.set(cells, { scaleY: 0, transformOrigin: '50% 100%' });
      vals.forEach(function (td) { td.textContent = money(0); });
      setText(outProj, money(0));
      onceIn(root, function () {
        gs.to(cells, { scaleY: 1, duration: 0.5, ease: 'power2.out', stagger: 0.04 });
        vals.forEach(function (td, i) {
          var o = { v: 0 };
          var end = Number(td.getAttribute('data-v'));
          gs.to(o, {
            v: end, duration: 1.2, delay: 0.3 + i * 0.12, ease: 'power2.out',
            onUpdate: function () { td.textContent = money(o.v); },
            onComplete: function () { td.textContent = money(end); }
          });
        });
        var po = { v: 0 };
        gs.to(po, {
          v: Number(range.value) / own, duration: 1.2, ease: 'power2.out',
          onUpdate: function () { if (!touched) { setText(outProj, money(po.v)); } },
          onComplete: function () { update(); }
        });
      });
    }
  }

  /* ---------- 4. how the loan gets paid back ---------- */
  function initLbo() {
    var root = qs('#dg-lbo');
    if (!root) { return; }
    var svg = qs('#lbo-svg', root);
    var flat = M.paydown_4x_flat;
    var g5 = M.paydown_4x_growth5;
    var hold = M.inputs.hold_years;
    var lastRow = flat[flat.length - 1];
    var last = lastRow.year;
    var P = { l: 48, r: 328, t: 16, b: 232 };
    var maxV = 0;
    g5.forEach(function (r) { if (r.owner_equity > maxV) { maxV = r.owner_equity; } });
    flat.forEach(function (r) { if (r.sba_balance > maxV) { maxV = r.sba_balance; } });
    var yMax = 7.2e6;
    if (maxV > yMax) { yMax = Math.ceil(maxV / 2e6) * 2e6 + 1.2e6; }
    function X(yr) { return P.l + (P.r - P.l) * yr / last; }
    function Y(v) { return P.b - (P.b - P.t) * v / yMax; }
    function f1(v) { return v.toFixed(1); }
    function pathOf(arr, key) {
      return arr.map(function (r, i) { return (i ? 'L' : 'M') + f1(X(r.year)) + ',' + f1(Y(r[key])); }).join(' ');
    }
    function find(arr, yr) {
      for (var i = 0; i < arr.length; i++) { if (arr[i].year === yr) { return arr[i]; } }
      return arr[arr.length - 1];
    }
    var area = 'M' + f1(X(0)) + ',' + f1(P.b) + ' ' +
      flat.map(function (r) { return 'L' + f1(X(r.year)) + ',' + f1(Y(r.sba_balance)); }).join(' ') +
      ' L' + f1(X(last)) + ',' + f1(P.b) + ' Z';
    qs('#lbo-area', svg).setAttribute('d', area);
    qs('#lbo-sba', svg).setAttribute('d', pathOf(flat, 'sba_balance'));
    qs('#lbo-flat', svg).setAttribute('d', pathOf(flat, 'owner_equity'));
    qs('#lbo-g5', svg).setAttribute('d', pathOf(g5, 'owner_equity'));

    var grid = qs('#lbo-grid', svg);
    clearNode(grid);
    for (var v = 0; v <= yMax; v += 2e6) {
      grid.appendChild(svgEl('line', { x1: P.l, x2: P.r, y1: f1(Y(v)), y2: f1(Y(v)), 'class': v === 0 ? 'axis' : 'gridline' }));
      grid.appendChild(svgEl('text', { x: P.l - 8, y: f1(Y(v) + 5), 'text-anchor': 'end', 'class': 'm' }, v === 0 ? '$0' : '$' + (v / 1e6) + 'M'));
    }
    for (var yr = 0; yr <= last; yr += 2) {
      grid.appendChild(svgEl('text', { x: f1(X(yr)), y: P.b + 22, 'text-anchor': 'middle', 'class': 'm' }, String(yr)));
    }

    var rowF = find(flat, hold), rowG = find(g5, hold);
    var x5 = X(hold), yF = Y(rowF.owner_equity), yG = Y(rowG.owner_equity);
    var guide = qs('#lbo-guide', svg);
    guide.setAttribute('x1', f1(x5));
    guide.setAttribute('x2', f1(x5));
    var tg = qs('#lbo-tag-g5', svg), tf = qs('#lbo-tag-flat', svg);
    var ty = yG - 46;
    qs('.dot', tg).setAttribute('cx', f1(x5));
    qs('.dot', tg).setAttribute('cy', f1(yG));
    qs('.tag-box', tg).setAttribute('x', f1(x5 - 18 - 32));
    qs('.tag-box', tg).setAttribute('y', f1(ty));
    qs('text', tg).setAttribute('x', f1(x5 - 18));
    qs('text', tg).setAttribute('y', f1(ty + 17));
    setText(qs('text', tg), money(rowG.owner_equity));
    var ldG = qs('.leader', tg);
    ldG.setAttribute('x1', f1(x5 - 10));
    ldG.setAttribute('y1', f1(ty + 24));
    ldG.setAttribute('x2', f1(x5 - 2));
    ldG.setAttribute('y2', f1(yG - 4));
    var fy = yF + 14;
    qs('.dot', tf).setAttribute('cx', f1(x5));
    qs('.dot', tf).setAttribute('cy', f1(yF));
    qs('.tag-box', tf).setAttribute('x', f1(x5 + 18 - 32));
    qs('.tag-box', tf).setAttribute('y', f1(fy));
    qs('text', tf).setAttribute('x', f1(x5 + 18));
    qs('text', tf).setAttribute('y', f1(fy + 17));
    setText(qs('text', tf), money(rowF.owner_equity));
    var ldF = qs('.leader', tf);
    ldF.setAttribute('x1', f1(x5 + 8));
    ldF.setAttribute('y1', f1(fy));
    ldF.setAttribute('x2', f1(x5 + 2));
    ldF.setAttribute('y2', f1(yF + 4));
    var sbaLbl = qs('#lbo-sba0', svg);
    sbaLbl.setAttribute('x', f1(P.l + 6));
    sbaLbl.setAttribute('y', f1(Y(flat[0].sba_balance) - 12));
    setText(sbaLbl, 'SBA loan ' + money(flat[0].sba_balance));
    svg.setAttribute('aria-label', 'Line chart over ' + last + ' years after closing. The SBA loan balance falls from ' +
      money(flat[0].sba_balance) + ' to ' + (lastRow.sba_balance === 0 ? 'zero' : money(lastRow.sba_balance)) +
      '. At year ' + hold + ' owner equity is ' + money(rowF.owner_equity) + ' if earnings stay flat and ' +
      money(rowG.owner_equity) + ' if earnings grow ' + pct0(derived.growth) + ' a year.');

    if (canScroll) {
      var clip = qs('#lbo-clip-r', svg);
      var later = [guide, tg, tf, sbaLbl];
      gs.set(clip, { attr: { width: 0 } });
      gs.set(later, { autoAlpha: 0 });
      onceIn(svg, function () {
        var tl = gs.timeline();
        tl.to(clip, { attr: { width: 340 }, duration: 1.4, ease: 'power2.out' }, 0);
        tl.to(later, { autoAlpha: 1, duration: 0.5, stagger: 0.1, ease: 'power2.out' }, 0.7);
      });
      var eq = qs('.eq', root);
      if (eq) {
        var parts = qsa('.eq-chip, .eq-op', eq);
        gs.set(parts, { opacity: 0.25 });
        onceIn(eq, function () {
          gs.to(parts, { opacity: 1, duration: 0.5, stagger: 0.15, ease: 'power2.out' });
        }, 'clamp(top 85%)');
      }
    }
  }

  /* ---------- 5. price too high: the debt coverage gauge ---------- */
  function setBadge(el, ok) {
    if (!el) { return; }
    el.className = 'badge ' + (ok ? 'pass' : 'fail');
    setText(el, ok ? 'Pass' : 'Fail');
  }
  function initGauge() {
    var root = qs('#dg-price-too-high');
    if (!root) { return; }
    var svg = qs('#gauge-svg', root);
    var floor = M.inputs.dscr_floor;
    var A = M.A_4x_no_investors, B = M.B_5x_no_investors;
    var V0 = 0.8, V1 = 1.6, X0 = 20, XW = 300;
    function X(v) { return X0 + (Math.max(V0, Math.min(V1, v)) - V0) / (V1 - V0) * XW; }
    var nd = { A: qs('#g-needle-A', svg), B: qs('#g-needle-B', svg) };
    function setNeedle(k, v) {
      var el = nd[k];
      var ok = v >= floor - 1e-9;
      el.setAttribute('transform', 'translate(' + X(v).toFixed(2) + ' 0)');
      el.setAttribute('class', 'needle ' + (ok ? 'is-pass' : 'is-fail'));
      setText(qs('.nd-t', el), k + ' ' + ratio(v));
    }
    var fx = X(floor);
    qs('#g-fail-zone', svg).setAttribute('width', (fx - X0).toFixed(2));
    qs('#g-pass-zone', svg).setAttribute('x', fx.toFixed(2));
    qs('#g-pass-zone', svg).setAttribute('width', (X0 + XW - fx).toFixed(2));
    qs('#g-floor', svg).setAttribute('x1', fx.toFixed(2));
    qs('#g-floor', svg).setAttribute('x2', fx.toFixed(2));
    qs('#g-floor-lbl', svg).setAttribute('x', fx.toFixed(2));
    setText(qs('#g-floor-lbl', svg), ratio(floor));
    qs('#g-floor-sub', svg).setAttribute('x', fx.toFixed(2));
    setBadge(qs('#gk-A', root), A.dscr >= floor - 1e-9);
    setBadge(qs('#gk-B', root), B.dscr >= floor - 1e-9);
    svg.setAttribute('aria-label', 'Debt coverage gauge from ' + ratio(V0) + ' to ' + ratio(V1) + '. The bank minimum is ' +
      ratio(floor) + '. At the ' + mult(A.multiple) + ' price the ratio is ' + ratio(A.dscr) + ', which ' +
      (A.dscr >= floor - 1e-9 ? 'passes' : 'fails') + '. At the ' + mult(B.multiple) + ' price it is ' + ratio(B.dscr) +
      ', which ' + (B.dscr >= floor - 1e-9 ? 'passes' : 'fails') + '.');
    setNeedle('A', A.dscr);
    setNeedle('B', B.dscr);

    if (canScroll) {
      var pa = { p: 0 }, pb = { p: 0 };
      setNeedle('A', V0);
      setNeedle('B', V0);
      onceIn(svg, function () {
        var tl = gs.timeline();
        tl.to(pa, {
          p: 1, duration: 0.9, ease: 'power2.out',
          onUpdate: function () { setNeedle('A', V0 + (A.dscr - V0) * pa.p); },
          onComplete: function () { setNeedle('A', A.dscr); }
        });
        tl.to(pb, {
          p: 1, duration: 0.9, ease: 'power2.out',
          onUpdate: function () { setNeedle('B', V0 + (B.dscr - V0) * pb.p); },
          onComplete: function () { setNeedle('B', B.dscr); }
        }, '-=0.3');
      }, 'clamp(top 75%)');
    }
  }

  /* ---------- 6. what investors expect ---------- */
  function initInvestors() {
    var root = qs('#dg-investors');
    if (!root) { return; }
    var C = M.returns_C_flat;
    var you = qs('.wf-you', root), inv = qs('.wf-inv', root);
    if (you) { you.style.flexBasis = (C.buyer_common * 100).toFixed(2) + '%'; }
    if (inv) { inv.style.flexBasis = (C.investor_common * 100).toFixed(2) + '%'; }
    var inj = qs('#inj-svg', root);
    if (inj) {
      inj.setAttribute('aria-label', 'Small stack of the funding blocks, not to scale. The ' + pct0(M.inputs.injection) +
        ' injection (seller note plus your cash) is bracketed. Investor money above the bracket gets normal distributions. ' +
        'Investor money counted inside it gets tax distributions only until the SBA loan is repaid, as one SBA loan broker reads the new rules.');
    }
    if (!canScroll) { return; }
    var wf = qs('.wf', root);
    var steps = qsa('.wf-step', root);
    var fills = qsa('.wf-fill', root);
    gs.set(fills, { scaleX: 0 });
    gs.set(steps, { opacity: 0.5 });
    onceIn(wf, function () {
      var tl = gs.timeline({ defaults: { ease: 'power2.out' } });
      steps.forEach(function (s, i) {
        tl.to(s, { opacity: 1, duration: 0.4 }, i * 0.8);
        tl.to(fills[i], { scaleX: 1, duration: 0.7 }, i * 0.8 + 0.1);
      });
    });
    if (inj) {
      var parts = qsa('[data-step]', inj);
      gs.set(parts, { opacity: 0 });
      onceIn(inj, function () {
        gs.to(parts, { opacity: 1, duration: 0.6, ease: 'power2.out', stagger: 0.25 });
      });
    }
  }

  /* ---------- 7. raising the money ---------- */
  function initRaising() {
    var root = qs('#dg-raising');
    if (!root) { return; }
    litBatch(qsa('.flow-i', root));
    litBatch(qsa('.tl-i', root));
  }

  /* ---------- 8. raise or lower the price ---------- */
  function initCompare() {
    var root = qs('#dg-price-vs-raise');
    if (!root) { return; }
    var C = M.returns_C_flat, D = M.returns_D_flat;
    var irrMax = Math.max(C.buyer_irr, D.buyer_irr, C.investor_irr || 0, D.investor_irr || 0);
    var rows = [
      { key: 'own', c: C.buyer_common, d: D.buyer_common, fmt: pct1, max: 1 },
      { key: 'cashin', c: C.buyer_cash_in, d: D.buyer_cash_in, fmt: money, max: Math.max(C.buyer_cash_in, D.buyer_cash_in) },
      { key: 'back', c: C.buyer_cash_back, d: D.buyer_cash_back, fmt: money, max: Math.max(C.buyer_cash_back, D.buyer_cash_back) },
      { key: 'irr', c: C.buyer_irr, d: D.buyer_irr, fmt: pct1, max: irrMax },
      { key: 'invirr', c: C.investor_irr, d: D.investor_irr, fmt: pct1, max: irrMax }
    ];
    rows.forEach(function (r) {
      var row = qs('[data-metric="' + r.key + '"]', root);
      if (!row) { return; }
      var cells = qsa('.cmp-c', row);
      [r.c, r.d].forEach(function (val, i) {
        var cell = cells[i];
        if (!cell) { return; }
        var vEl = qs('.cmp-v', cell), bar = qs('.bar i', cell);
        if (val === undefined || val === null) {
          setText(vEl, 'n/a');
          if (bar) { bar.style.setProperty('--w', '0%'); }
          cell.classList.add('is-na');
          return;
        }
        setText(vEl, r.fmt(val));
        if (bar) { bar.style.setProperty('--w', (Math.max(0, Math.min(1, val / r.max)) * 100).toFixed(1) + '%'); }
      });
    });
    var table = qs('.cmp', root);
    if (table) {
      table.setAttribute('aria-label', 'Raising investor money compared with lowering the price. Earnings flat, sold after ' +
        M.inputs.hold_years + ' years.');
    }
    if (canScroll && table) {
      var bars = qsa('.bar i', root), vals = qsa('.cmp-v', root);
      gs.set(bars, { scaleX: 0 });
      gs.set(vals, { opacity: 0 });
      onceIn(table, function () {
        gs.to(bars, { scaleX: 1, duration: 0.8, ease: 'power2.out', stagger: 0.08 });
        gs.to(vals, { opacity: 1, duration: 0.6, ease: 'power2.out', stagger: 0.08 });
      });
    }
  }

  /* ---------- long-form article: tables scroll inside their own box ---------- */
  function fixTableFocus() {
    qsa('.table-wrap').forEach(function (w) {
      if (w.scrollWidth > w.clientWidth + 1) {
        w.setAttribute('tabindex', '0');
        w.setAttribute('role', 'region');
        w.setAttribute('aria-label', 'Table, scrolls sideways');
      } else {
        w.removeAttribute('tabindex');
        w.removeAttribute('role');
        w.removeAttribute('aria-label');
      }
    });
  }
  function wrapTables() {
    qsa('.prose table').forEach(function (t) {
      var p = t.parentNode;
      if (p && p.classList && p.classList.contains('table-wrap')) { return; }
      var w = doc.createElement('div');
      w.className = 'table-wrap';
      p.insertBefore(w, t);
      w.appendChild(t);
    });
    fixTableFocus();
    window.addEventListener('resize', fixTableFocus);
  }

  /* ---------- start ---------- */
  function boot() {
    safe(wrapTables);
    if (!M) { return; }
    safe(computeDerived);
    safe(bindAll);
    [initHow, initStack, initRule, initLbo, initGauge, initInvestors, initRaising, initCompare].forEach(safe);
    if (canScroll) {
      var refresh = function () { try { ST.refresh(); } catch (e2) { /* ignore */ } };
      window.addEventListener('load', refresh);
      if (doc.fonts && doc.fonts.ready) { doc.fonts.ready.then(refresh); }
    }
  }
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
