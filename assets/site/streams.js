/*
 * EDRA streams — "streams that merge and part", from the EDRA ONE platform
 * (SignInBackground.tsx), adapted for the site.
 *
 * Faint streams cross the band and pinch into two knots. Points travel left
 * to right. Left of the first knot they are as submitted (faint). Through it
 * they come out classified: navy (answered), teal (partial). A missing point
 * is a hollow square that stays hollow the whole way across — a gap is never
 * filled.
 *
 * <canvas data-streams
 *         data-density="1"           point multiplier
 *         data-knots="0.2,0.8"       knot positions as fractions of width
 *         data-labels="GOVERNED|CALCULATED">   text under each knot (optional)
 *
 * Elements inside the same .streams-band with [data-a] (−1…1) are pinned to
 * the stream at that offset on their side ([data-side="l"|"r"]).
 *
 * The canvas size comes from CSS (fixed aspect-ratio), so the geometry never
 * stretches. Respects prefers-reduced-motion; pauses off-screen and in hidden
 * tabs. Decorative: aria-hidden on the canvas.
 */
(function () {
  var NAVY = '31, 58, 92', TEAL = '38, 122, 118';
  var STREAM_COUNT = 34, BASE_DOTS = 420, SPEED = 2.4;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function Streams(canvas) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var density = parseFloat(canvas.dataset.density || '1');
    var kf = (canvas.dataset.knots || '0.17,0.83').split(',').map(parseFloat);
    var labels = canvas.dataset.labels ? canvas.dataset.labels.split('|') : null;
    var bg = canvas.dataset.bg || getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f3f0e9';
    var band = canvas.closest('.streams-band');
    var pins = band ? band.querySelectorAll('[data-a]') : [];
    var w = 1, h = 1, time = 0, raf = 0, last = performance.now(), visible = true;
    var streams = [], dots = [];

    function resize() {
      var r = canvas.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      streams = [];
      for (var s = 0; s < STREAM_COUNT; s++) {
        var a = (s / (STREAM_COUNT - 1)) * 2 - 1;
        streams.push({ a: a * (0.75 + Math.random() * 0.25), ph: Math.random() * Math.PI * 2, wob: 3 + Math.random() * 9 });
      }
      dots = [];
      var n = Math.round(BASE_DOTS * density * Math.min(1, w / 1200));
      for (var i = 0; i < n; i++) {
        var roll = Math.random();
        dots.push({
          s: Math.floor(Math.random() * STREAM_COUNT),
          x: Math.random() * (w + 200) - 100,
          v: 0.04 + Math.random() * 0.06,
          r: Math.random() < 0.12 ? 2.2 + Math.random() * 1.2 : 0.9 + Math.random() * 1.1,
          ly: null,
          kind: roll < 0.15 ? 'gap' : roll < 0.6 ? 'ans' : 'par'
        });
      }
    }

    function knots() {
      var t = time * 0.00009;
      var kk = w < 720 ? [0.08, 0.92] : kf;
      return {
        k1: w * (kk[0] + 0.02 * Math.sin(t * 2.1)),
        k2: w * (kk[1] + 0.02 * Math.cos(t * 1.7)),
        cy: h * (0.5 + 0.02 * Math.sin(t * 1.3))
      };
    }

    // Spread keeps the platform's lens proportion whatever the band's aspect.
    function spreadFor(k) { return Math.min(h * 0.42, (k.k2 - k.k1) * (w < 720 ? 0.55 : 0.32)); }

    function openAt(x, k) {
      var s = Math.sin((Math.PI * (x - k.k1)) / (k.k2 - k.k1));
      return Math.pow(Math.abs(s), 0.85);
    }

    function yAt(st, x, k, spread) {
      var open = openAt(x, k);
      return k.cy + st.a * spread * open + st.wob * open * Math.sin(x * 0.006 + st.ph + time * 0.0006);
    }

    function placePins() {
      if (!pins.length) return;
      var k = { k1: w * kf[0], k2: w * kf[1], cy: h * 0.5 };
      var spread = spreadFor(k);
      for (var i = 0; i < pins.length; i++) {
        var p = pins[i];
        var a = parseFloat(p.dataset.a);
        var x = p.dataset.side === 'l' ? 0 : w;
        p.style.top = (k.cy + a * spread * openAt(x, k)) + 'px';
      }
    }

    function draw(dt) {
      var k = knots();
      var spread = spreadFor(k);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.lineWidth = 0.7;
      ctx.strokeStyle = 'rgba(' + NAVY + ', 0.075)';
      for (var j = 0; j < streams.length; j++) {
        ctx.beginPath();
        for (var x = -20; x <= w + 20; x += 8) {
          var y = yAt(streams[j], x, k, spread);
          if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      [k.k1, k.k2].forEach(function (kx, q) {
        var pulse = 0.5 + 0.5 * Math.sin(time * 0.0015 + q * 3.1);
        var g = ctx.createRadialGradient(kx, k.cy, 0, kx, k.cy, 70);
        g.addColorStop(0, 'rgba(' + TEAL + ', ' + (0.16 + 0.1 * pulse).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + TEAL + ', 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(kx, k.cy, 70, 0, Math.PI * 2); ctx.fill();
      });

      if (labels && w >= 760) {
        ctx.font = '600 10.5px "IBM Plex Sans", sans-serif';
        ctx.fillStyle = 'rgba(' + NAVY + ', 0.6)';
        ctx.textAlign = 'center';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
        if (labels[0]) ctx.fillText(labels[0], k.k1, k.cy + 96);
        if (labels[1]) ctx.fillText(labels[1], k.k2, k.cy + 96);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      }

      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        var px = d.x;
        d.x += d.v * dt;
        if (d.x > w + 60) { d.x = -60; d.ly = null; px = d.x - 1; }
        var yy = yAt(streams[d.s], d.x, k, spread);
        var py = d.ly == null ? yy : d.ly;
        d.ly = yy;

        var near = Math.min(Math.abs(d.x - k.k1), Math.abs(d.x - k.k2));
        var a = 0.5 + 0.4 * Math.max(0, 1 - near / 160);
        var rgb = d.kind === 'par' ? TEAL : NAVY;
        if (d.x < k.k1) { rgb = NAVY; a *= 0.42; }   // as submitted
        var colour = 'rgba(' + rgb + ', ' + a.toFixed(3) + ')';
        var q = 1 + d.r * 1.15;

        if (d.kind === 'gap') {
          ctx.strokeStyle = colour;
          ctx.lineWidth = 1;
          var qq = Math.max(q, 2.6);
          ctx.strokeRect(d.x - qq / 2, yy - qq / 2, qq, qq);
        } else if (i % 4 === 0) {
          var dx = d.x - px, dy = yy - py;
          var len = Math.hypot(dx, dy) || 1;
          var half = (6 + d.r * 3) / 2;
          ctx.strokeStyle = colour;
          ctx.lineWidth = 1.3;
          ctx.lineCap = 'butt';
          ctx.beginPath();
          ctx.moveTo(d.x - (dx / len) * half, yy - (dy / len) * half);
          ctx.lineTo(d.x + (dx / len) * half, yy + (dy / len) * half);
          ctx.stroke();
        } else {
          ctx.fillStyle = colour;
          ctx.fillRect(d.x - q / 2, yy - q / 2, q, q);
        }
      }
    }

    function tick(now) {
      var dt = Math.min(64, now - last) * SPEED;
      last = now; time += dt;
      draw(dt);
      raf = requestAnimationFrame(tick);
    }
    function start() { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(tick); }
    function stop() { cancelAnimationFrame(raf); }

    resize(); seed(); placePins();
    // Warm up so the first painted frame already has points spread across.
    time = 4000; draw(0);

    if (!reduce && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible && !document.hidden) start(); else stop();
      }).observe(canvas);
    } else if (!reduce) { start(); }

    document.addEventListener('visibilitychange', function () {
      if (reduce) return;
      if (document.hidden || !visible) stop(); else start();
    });
    var rt, lastW = w;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        resize();
        if (Math.abs(w - lastW) > 40) { seed(); lastW = w; }
        placePins(); draw(0);
      }, 120);
    });
  }

  function init() {
    document.querySelectorAll('canvas[data-streams]').forEach(Streams);

    // Shared page behaviour: nav state, mobile menu, reveal, click tracking.
    var nav = document.querySelector('.site-nav');
    if (nav) {
      var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 8); };
      onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
      var t = nav.querySelector('.nav-toggle');
      if (t) t.addEventListener('click', function () {
        var open = nav.classList.toggle('open');
        t.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      nav.querySelectorAll('.nav-links a').forEach(function (a) {
        a.addEventListener('click', function () { nav.classList.remove('open'); });
      });
    }

    var rv = document.querySelectorAll('.rv');
    if ('IntersectionObserver' in window && !reduce) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px' });
      rv.forEach(function (el) { io.observe(el); });
    } else { rv.forEach(function (el) { el.classList.add('in'); }); }

    document.querySelectorAll('[data-track]').forEach(function (el) {
      el.addEventListener('click', function () {
        if (typeof gtag === 'function') gtag('event', el.dataset.track, { location: el.dataset.loc || '', page: location.pathname });
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
