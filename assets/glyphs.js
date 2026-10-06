/*
 * EDRA glyphs: the BRSR Core hero animation, made reusable.
 * Particles gather into a pictogram inside a quiet dotted ring, hold, then
 * flow into the next one. A caption (kicker, title, progress) sits beneath.
 *
 * <canvas class="glyphs" data-glyphs='[{"g":"magnifier","k":"THE CYCLE · 01 / 04","t":"Know what is true"}, ...]'>
 *
 * Glyphs are drawn on a 200 x 200 grid, sampled into points, and particles
 * morph between them. Still frame under prefers-reduced-motion; pauses when
 * off screen or the tab is hidden. Decorative: aria-hidden on the canvas.
 */
(function () {
  var P = Math.PI;
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function line(x, pts) { x.beginPath(); x.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.stroke(); }
  function circ(x, cx, cy, r, a0, a1) { x.beginPath(); x.arc(cx, cy, r, a0 || 0, a1 == null ? 2 * P : a1); x.stroke(); }
  function rect(x, a, b, w, h) { x.beginPath(); x.rect(a, b, w, h); x.stroke(); }

  var LIB = {
    magnifier: function (x) { circ(x, 86, 86, 46); line(x, [120, 120, 166, 166]); line(x, [66, 88, 82, 104, 108, 72]); },
    checklist: function (x) {
      for (var i = 0; i < 3; i++) { var y = 40 + i * 50; rect(x, 30, y, 30, 30); line(x, [76, y + 15, 170, y + 15]); }
      line(x, [36, 55, 44, 63, 58, 44]); line(x, [36, 105, 44, 113, 58, 94]);
    },
    doc: function (x) { line(x, [50, 22, 122, 22, 154, 54, 154, 178, 50, 178, 50, 22]); line(x, [122, 22, 122, 54, 154, 54]); for (var i = 0; i < 4; i++) line(x, [70, 84 + i * 22, 134, 84 + i * 22]); },
    bars: function (x) { line(x, [24, 172, 176, 172]); var hs = [44, 74, 98, 128]; for (var i = 0; i < 4; i++) rect(x, 36 + i * 36, 172 - hs[i], 22, hs[i]); line(x, [34, 108, 82, 76, 116, 88, 168, 34]); line(x, [146, 32, 168, 34, 166, 56]); },
    tray: function (x) { line(x, [100, 18, 100, 92]); line(x, [76, 70, 100, 94, 124, 70]); line(x, [24, 112, 62, 112, 76, 136, 124, 136, 138, 112, 176, 112, 176, 172, 24, 172, 24, 112]); },
    shield: function (x) { x.beginPath(); x.moveTo(100, 20); x.lineTo(166, 44); x.bezierCurveTo(166, 112, 140, 154, 100, 180); x.bezierCurveTo(60, 154, 34, 112, 34, 44); x.closePath(); x.stroke(); line(x, [70, 100, 92, 122, 132, 78]); },
    calc: function (x) { rect(x, 44, 18, 112, 164); rect(x, 60, 34, 80, 32); for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) rect(x, 62 + c * 28, 84 + r * 30, 14, 14); },
    chain: function (x) {
      x.save(); x.translate(100, 100); x.rotate(-P / 4);
      [-38, 38].forEach(function (o) { x.beginPath(); x.moveTo(o - 30, -18); x.lineTo(o + 30, -18); x.arc(o + 30, 0, 18, -P / 2, P / 2); x.lineTo(o - 30, 18); x.arc(o - 30, 0, 18, P / 2, 3 * P / 2); x.stroke(); });
      x.restore();
    },
    pillars: function (x) { line(x, [24, 66, 100, 26, 176, 66, 24, 66]); line(x, [30, 74, 170, 74]); for (var i = 0; i < 5; i++) line(x, [44 + i * 28, 84, 44 + i * 28, 150]); line(x, [28, 158, 172, 158]); line(x, [20, 172, 180, 172]); },
    book: function (x) {
      x.beginPath(); x.moveTo(100, 62); x.quadraticCurveTo(62, 44, 22, 56); x.lineTo(22, 150); x.quadraticCurveTo(62, 138, 100, 156); x.quadraticCurveTo(138, 138, 178, 150); x.lineTo(178, 56); x.quadraticCurveTo(138, 44, 100, 62); x.lineTo(100, 156); x.stroke();
      for (var l = 0; l < 3; l++) { line(x, [38, 82 + l * 22, 84, 86 + l * 22]); line(x, [116, 86 + l * 22, 162, 82 + l * 22]); }
    },
    globe: function (x) { circ(x, 100, 100, 72); x.beginPath(); x.ellipse(100, 100, 32, 72, 0, 0, 2 * P); x.stroke(); line(x, [28, 100, 172, 100]); x.beginPath(); x.moveTo(40, 62); x.quadraticCurveTo(100, 78, 160, 62); x.stroke(); x.beginPath(); x.moveTo(40, 138); x.quadraticCurveTo(100, 122, 160, 138); x.stroke(); },
    leaf: function (x) { x.beginPath(); x.moveTo(40, 166); x.bezierCurveTo(30, 90, 80, 30, 170, 28); x.bezierCurveTo(168, 116, 118, 168, 40, 166); x.stroke(); line(x, [40, 166, 140, 62]); line(x, [78, 128, 78, 98]); line(x, [100, 106, 128, 106]); line(x, [112, 92, 112, 70]); },
    star: function (x) { x.beginPath(); for (var i = 0; i < 10; i++) { var r = i % 2 ? 32 : 78, a = -P / 2 + i * P / 5; var px = 100 + Math.cos(a) * r, py = 104 + Math.sin(a) * r; if (i) x.lineTo(px, py); else x.moveTo(px, py); } x.closePath(); x.stroke(); },
    target: function (x) { circ(x, 100, 100, 74); circ(x, 100, 100, 48); circ(x, 100, 100, 22); line(x, [100, 100, 168, 32]); line(x, [150, 30, 170, 30, 170, 50]); },
    gear: function (x) {
      x.beginPath();
      for (var i = 0; i < 16; i++) { var a = i * P / 8, r = i % 2 ? 56 : 74; var a0 = a - P / 16, a1 = a + P / 16; x.lineTo(100 + Math.cos(a0) * r, 100 + Math.sin(a0) * r); x.lineTo(100 + Math.cos(a1) * r, 100 + Math.sin(a1) * r); }
      x.closePath(); x.stroke(); circ(x, 100, 100, 22);
    },
    people: function (x) { circ(x, 72, 62, 19); circ(x, 130, 70, 17); circ(x, 72, 150, 42, P, 2 * P); circ(x, 130, 150, 36, P, 2 * P); line(x, [24, 150, 176, 150]); },
    bulb: function (x) { x.beginPath(); x.arc(100, 80, 52, 0.78 * P, 0.22 * P); x.lineTo(124, 140); x.lineTo(76, 140); x.closePath(); x.stroke(); line(x, [80, 156, 120, 156]); line(x, [86, 172, 114, 172]); line(x, [88, 110, 100, 86, 112, 110]); },
    bubble: function (x) { x.beginPath(); x.moveTo(36, 40); x.lineTo(150, 40); x.quadraticCurveTo(166, 40, 166, 56); x.lineTo(166, 112); x.quadraticCurveTo(166, 128, 150, 128); x.lineTo(84, 128); x.lineTo(54, 158); x.lineTo(58, 128); x.lineTo(36, 128); x.quadraticCurveTo(20, 128, 20, 112); x.lineTo(20, 56); x.quadraticCurveTo(20, 40, 36, 40); x.stroke(); line(x, [46, 74, 140, 74]); line(x, [46, 96, 116, 96]); },
    envelope: function (x) { rect(x, 24, 50, 152, 104); line(x, [24, 50, 100, 112, 176, 50]); line(x, [24, 154, 80, 98]); line(x, [176, 154, 120, 98]); },
    calendar: function (x) { rect(x, 26, 40, 148, 132); line(x, [26, 74, 174, 74]); line(x, [62, 24, 62, 52]); line(x, [138, 24, 138, 52]); for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) rect(x, 44 + c * 32, 88 + r * 26, 12, 12); },
    lock: function (x) { rect(x, 40, 88, 120, 88); x.beginPath(); x.moveTo(66, 88); x.lineTo(66, 64); x.arc(100, 64, 34, P, 2 * P); x.lineTo(134, 88); x.stroke(); circ(x, 100, 124, 10); line(x, [100, 134, 100, 154]); },
    key: function (x) { circ(x, 62, 100, 34); circ(x, 62, 100, 12); line(x, [96, 100, 176, 100]); line(x, [150, 100, 150, 124]); line(x, [168, 100, 168, 120]); }
  };

  function Glyphs(canvas) {
    var ctx = canvas.getContext('2d'); if (!ctx) return;
    var items; try { items = JSON.parse(canvas.dataset.glyphs || '[]'); } catch (e) { return; }
    items = items.filter(function (it) { return LIB[it.g]; }); if (!items.length) return;
    var R = rng(4242 + items.length * 31);
    var w = 1, h = 1, time = 0, raf = 0, last = 0, visible = true;
    var N = 520, parts = [], glyphs = [];

    // sample each pictogram into points
    var c = document.createElement('canvas'); c.width = 200; c.height = 200;
    var x = c.getContext('2d', { willReadFrequently: true });
    items.forEach(function (it) {
      x.clearRect(0, 0, 200, 200); x.lineWidth = 8; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#000';
      LIB[it.g](x);
      var d = x.getImageData(0, 0, 200, 200).data, pts = [];
      for (var yy = 2; yy < 200; yy += 4) for (var xx = 2; xx < 200; xx += 4) if (d[(yy * 200 + xx) * 4 + 3] > 100) pts.push({ x: xx + (R() - 0.5) * 1.2, y: yy + (R() - 0.5) * 1.2, a: Math.atan2(yy - 100, xx - 100) });
      pts.sort(function (p, q) { return p.a - q.a; });
      glyphs.push(pts);
    });
    for (var p = 0; p < N; p++) parts.push({ ph: R() * 6.28, orb: R() * 6.28, rr: 0.66 + R() * 0.16, dash: R() < 0.16, sz: 1.5 + R() * 1.5, lag: R() * 220 });

    function resize() {
      var r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function layout() { var S = Math.min(w * 0.82, (h - 110) / 1.5, 360); return { cx: w / 2, cy: S * 0.78 + 8, S: S }; }
    function tgt(g, i, L, T) {
      var pts = glyphs[g], n = pts.length, pa = parts[i];
      if (i < n) { var q = pts[Math.floor(i * n / Math.min(n, N))] || pts[i]; return { x: L.cx + (q.x - 100) * L.S / 200, y: L.cy + (q.y - 100) * L.S / 200, on: 1 }; }
      var a = pa.orb + T * 0.00006 * (pa.rr > 0.74 ? 1 : -1);
      return { x: L.cx + Math.cos(a) * L.S * pa.rr, y: L.cy + Math.sin(a) * L.S * pa.rr, on: 0 };
    }
    function draw() {
      var T = time, L = layout(), M = items.length;
      ctx.clearRect(0, 0, w, h);
      var HOLD = 3200, MORPH = 1400, CYC = HOLD + MORPH;
      var k = Math.floor(T / CYC), tin = T - k * CYC, cur = ((k % M) + M) % M, prev = (cur + M - 1) % M;
      if (M === 1) prev = cur;
      ctx.strokeStyle = 'rgba(29, 74, 55, 0.12)'; ctx.lineWidth = 1; ctx.setLineDash([2, 7]);
      ctx.beginPath(); ctx.arc(L.cx, L.cy, L.S * 0.74, 0, 2 * P); ctx.stroke(); ctx.setLineDash([]);
      for (var i = 0; i < N; i++) {
        var pa = parts[i];
        var u = Math.max(0, Math.min(1, (tin - pa.lag) / MORPH)); if (T < CYC) u = 1;
        var e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
        var A = tgt(prev, i, L, T), B = tgt(cur, i, L, T), mid = Math.sin(P * e) * L.S * 0.12;
        var px = A.x + (B.x - A.x) * e + Math.cos(pa.ph) * mid + Math.sin(T * 0.002 + pa.ph) * 0.5;
        var py = A.y + (B.y - A.y) * e + Math.sin(pa.ph) * mid + Math.cos(T * 0.0017 + pa.ph) * 0.5;
        var on = A.on + (B.on - A.on) * e;
        var gold = (i % 97 === 0) && on > 0.5;
        ctx.fillStyle = gold ? 'rgba(201, 154, 60, ' + (0.3 + 0.6 * on).toFixed(3) + ')' : 'rgba(' + (on > 0.5 ? '47, 122, 90' : '29, 74, 55') + ', ' + (0.22 + 0.68 * on).toFixed(3) + ')';
        var s = (0.9 + on * 0.6) * pa.sz * Math.max(0.7, L.S / 360);
        if (pa.dash && on < 0.5) ctx.fillRect(px - 3, py - 0.6, 6, 1.2); else ctx.fillRect(px - s / 2, py - s / 2, s, s);
      }
      var it = items[cur], fade = Math.min(1, Math.max(0, (tin - MORPH * 0.6) / 500)); if (T < CYC) fade = 1;
      var ly = L.cy + L.S * 0.74 + 44;
      ctx.textAlign = 'center';
      ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillStyle = 'rgba(47, 122, 90, ' + fade.toFixed(3) + ')';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px';
      ctx.fillText(it.k || '', L.cx, ly);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.font = '400 ' + (w > 420 ? 23 : 19) + 'px "Source Serif 4", Georgia, serif';
      ctx.fillStyle = 'rgba(24, 32, 27, ' + fade.toFixed(3) + ')';
      ctx.fillText(it.t || '', L.cx, ly + 32);
      if (M > 1) {
        var gx = L.cx - (M - 1) * 7;
        for (var j = 0; j < M; j++) { var sz = j === cur ? 8 : 6; ctx.fillStyle = j === cur ? 'rgb(47, 122, 90)' : 'rgba(47, 122, 90, 0.25)'; ctx.fillRect(gx + j * 14 - sz / 2, ly + 54 - sz / 2, sz, sz); }
      }
    }
    function tick(now) { var dt = Math.max(0, Math.min(64, now - last)); last = now; time += dt; draw(); raf = requestAnimationFrame(tick); }
    function start() { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(tick); }
    function stop() { cancelAnimationFrame(raf); }

    resize();
    if (reduce) { time = 999999 - (999999 % 4600); draw(); return; }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !document.hidden) start(); else stop(); }).observe(canvas);
    } else start();
    document.addEventListener('visibilitychange', function () { if (document.hidden || !visible) stop(); else start(); });
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { resize(); draw(); }, 120); });
  }

  function init() { document.querySelectorAll('canvas[data-glyphs]').forEach(Glyphs); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
