/*
 * EDRA hills: the homepage's landscape, carried onto every inner page.
 * Three layered hills with contour lines, data points flowing along the land,
 * a few trees that grow from points and sway, and seeds drifting upward.
 *
 * <canvas class="hills" data-hills data-seed="3"></canvas>
 * Decorative (aria-hidden). Still frame under prefers-reduced-motion; pauses
 * when off screen or when the tab is hidden.
 */
(function () {
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function rng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function Hills(canvas) {
    var ctx = canvas.getContext('2d'); if (!ctx) return;
    var seedN = parseInt(canvas.dataset.seed || '1', 10);
    var bg = canvas.dataset.bg || '#f1efe7';
    var w = 1, h = 1, time = 0, raf = 0, last = 0, visible = true;
    var hills = [], flow = [], pts = [], seeds = [];
    var greens = ['29, 74, 55', '47, 122, 90', '82, 145, 98', '131, 172, 112'];

    function hillY(l, x) { var H = hills[l]; return h * H.base + H.a1 * Math.sin(x * H.f1 + H.p1) + H.a2 * Math.sin(x * H.f2 + H.p2); }

    function resize() {
      var r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      var R = rng(20261006 + seedN * 97);
      hills = [
        { base: 0.38, a1: h * 0.07, f1: 0.0040 + R() * 0.0008, p1: R() * 6, a2: h * 0.03, f2: 0.011, p2: R() * 6 },
        { base: 0.58, a1: h * 0.08, f1: 0.0030 + R() * 0.0006, p1: R() * 6, a2: h * 0.03, f2: 0.0093, p2: R() * 6 },
        { base: 0.80, a1: h * 0.06, f1: 0.0024 + R() * 0.0005, p1: R() * 6, a2: h * 0.025, f2: 0.0077, p2: R() * 6 }
      ];
      flow = [];
      var n = Math.round(Math.min(1, w / 1400) * 170);
      for (var i = 0; i < n; i++) flow.push({ l: Math.floor(R() * 3), off: R() * 44, x: R() * (w + 100) - 50, v: 0.010 + R() * 0.026, sq: R() < 0.75, sz: 0.8 + R() * 1.4 });
      // a few small trees grown from points, at spots that differ by page
      pts = [];
      var spots = [0.06, 0.19, 0.33, 0.67, 0.81, 0.94].filter(function () { return R() < 0.85; });
      spots.forEach(function (fx, ti) {
        var l = ti % 2 === 0 ? 1 : 2, x0 = w * (fx + (R() - 0.5) * 0.04), y0 = hillY(l, x0) + 3;
        var s = (l === 2 ? 0.95 : 0.7) * Math.max(0.6, Math.min(1.1, w / 1440));
        var len = h * 0.17 * s, tree = { x: x0, y: y0, hgt: len * 3 }, t0 = 300 + ti * 520 + R() * 300;
        (function branch(x, y, a, L, d, delay) {
          var x2 = x + Math.cos(a) * L, y2 = y + Math.sin(a) * L, k, m = Math.max(2, Math.floor(L / 6));
          for (k = 0; k < m; k++) { var t = k / m; pts.push({ tx: x + (x2 - x) * t, ty: y + (y2 - y) * t, kind: 0, ang: a, wd: Math.max(0.8, (4 - d) * 0.5 * s + 0.3), delay: delay + t * 300, layer: l, tree: tree, sx: x + (R() - 0.5) * 100, sy: y0 + 30 + R() * 50 }); }
          if (d >= 3) {
            for (k = 0; k < 9; k++) { var rr = L * (0.4 + R() * 1.2), aa = R() * 6.2832; pts.push({ tx: x2 + Math.cos(aa) * rr, ty: y2 + Math.sin(aa) * rr * 0.75, kind: R() < 0.2 ? 2 : 1, sz: (1.3 + R() * 2) * (0.6 + s * 0.5), delay: delay + 300 + R() * 1200, col: greens[Math.floor(R() * 4)], layer: l, tree: tree, sx: -40 - R() * 300, sy: h * (0.1 + R() * 0.4), gold: R() < 0.03 }); }
            return;
          }
          var sp = 0.34 + R() * 0.24;
          branch(x2, y2, a - sp, L * 0.7, d + 1, delay + 300);
          branch(x2, y2, a + sp, L * 0.7, d + 1, delay + 300);
        })(x0, y0, -Math.PI / 2 + (R() - 0.5) * 0.1, len, 0, t0);
      });
      pts.sort(function (a, b) { return a.layer - b.layer; });
      seeds = [];
      for (var s2 = 0; s2 < 22; s2++) seeds.push({ x: R() * w, y: h * (0.1 + R() * 0.5), vx: 0.006 + R() * 0.012, vy: -0.002 - R() * 0.004, ph: R() * 6.28 });
    }

    function draw(dt) {
      var T = time, x, l;
      ctx.clearRect(0, 0, w, h);
      // fade the top edge into the page background
      var fills = ['rgba(131, 172, 112, 0.12)', 'rgba(82, 145, 98, 0.13)', 'rgba(47, 122, 90, 0.14)'];
      var pi = 0;
      for (l = 0; l < 3; l++) {
        ctx.beginPath(); ctx.moveTo(-10, h);
        for (x = -10; x <= w + 10; x += 12) ctx.lineTo(x, hillY(l, x));
        ctx.lineTo(w + 10, h); ctx.closePath(); ctx.fillStyle = fills[l]; ctx.fill();
        ctx.lineWidth = 0.7;
        for (var c = 0; c < 3; c++) {
          ctx.strokeStyle = 'rgba(29, 74, 55, ' + (0.10 - c * 0.025).toFixed(3) + ')';
          ctx.beginPath();
          for (x = -10; x <= w + 10; x += 12) { var yy = hillY(l, x) + c * 10 * (l + 1) * 0.6; if (x === -10) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
          ctx.stroke();
        }
        for (var f = 0; f < flow.length; f++) {
          var d = flow[f]; if (d.l !== l) continue;
          d.x += d.v * dt; if (d.x > w + 40) d.x = -40;
          var fy = hillY(l, d.x) + d.off * (0.3 + l * 0.3);
          ctx.fillStyle = 'rgba(29, 74, 55, ' + (0.32 + l * 0.12).toFixed(2) + ')';
          if (d.sq) { var q = d.sz + l * 0.4; ctx.fillRect(d.x - q / 2, fy - q / 2, q, q); } else { ctx.fillRect(d.x - 5, fy - 0.6, 10, 1.2); }
        }
        for (; pi < pts.length && pts[pi].layer === l; pi++) {
          var p = pts[pi], u = (T - p.delay) / (p.kind === 0 ? 900 : 2400);
          if (u <= 0) continue; if (u > 1) u = 1;
          var e = 1 - Math.pow(1 - u, 3);
          var hf = Math.max(0, (p.tree.y - p.ty) / p.tree.hgt);
          var sway = Math.sin(T * 0.0011 + p.tree.x * 0.013 + p.ty * 0.004) * hf * hf * 3.5;
          var cx = p.sx + (p.tx - p.sx) * e + sway * e, cy = p.sy + (p.ty - p.sy) * e;
          if (p.kind !== 0) cy -= Math.sin(Math.PI * e) * 50;
          var a = 0.78 * (0.35 + 0.65 * e) * (0.6 + l * 0.2);
          if (p.kind === 0) {
            ctx.strokeStyle = 'rgba(58, 74, 60, ' + a.toFixed(3) + ')'; ctx.lineWidth = p.wd; ctx.lineCap = 'butt';
            ctx.beginPath(); ctx.moveTo(cx - Math.cos(p.ang) * 3.4, cy - Math.sin(p.ang) * 3.4); ctx.lineTo(cx + Math.cos(p.ang) * 3.4, cy + Math.sin(p.ang) * 3.4); ctx.stroke();
          } else {
            ctx.fillStyle = p.gold ? 'rgba(201, 154, 60, ' + Math.min(1, a + 0.15).toFixed(3) + ')' : 'rgba(' + p.col + ', ' + a.toFixed(3) + ')';
            if (p.kind === 2) ctx.fillRect(cx - p.sz * 1.4, cy - 0.6, p.sz * 2.8, 1.2); else ctx.fillRect(cx - p.sz / 2, cy - p.sz / 2, p.sz, p.sz);
          }
        }
      }
      for (var s = 0; s < seeds.length; s++) {
        var sd = seeds[s]; sd.x += sd.vx * dt; sd.y += sd.vy * dt;
        if (sd.y < 2 || sd.x > w + 20) { sd.x = Math.random() * w * 0.9; sd.y = h * (0.4 + Math.random() * 0.3); }
        ctx.fillStyle = 'rgba(47, 122, 90, 0.4)';
        ctx.fillRect(sd.x + Math.sin(T * 0.001 + sd.ph) * 5 - 0.9, sd.y - 0.9, 1.8, 1.8);
      }
    }

    function tick(now) { var dt = Math.max(0, Math.min(64, now - last)); last = now; time += dt; draw(dt); raf = requestAnimationFrame(tick); }
    function start() { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(tick); }
    function stop() { cancelAnimationFrame(raf); }

    resize(); seed();
    if (reduce) { time = 999999; draw(0); return; }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !document.hidden) start(); else stop(); }).observe(canvas);
    } else start();
    document.addEventListener('visibilitychange', function () { if (document.hidden || !visible) stop(); else start(); });
    var rt, lw = w;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { resize(); if (Math.abs(w - lw) > 30) { lw = w; seed(); time = 0; } draw(0); }, 150);
    });
  }

  function reveal() {
    if (reduce || !('IntersectionObserver' in window)) return;
    var els = document.querySelectorAll('.rv');
    document.documentElement.classList.add('rv-on');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  function init() { document.querySelectorAll('canvas[data-hills]').forEach(Hills); reveal(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
