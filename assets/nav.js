/*
 * EDRA top bar — small-screen menu.
 * Finds the page's main <nav class="navlinks">, adds a menu button beside the
 * header actions, and shows the same links (plus Sign in) in a panel when the
 * links are hidden on narrow screens.
 */
(function () {
  function init() {
    var nav = document.querySelector('nav.navlinks');
    if (!nav) return;
    var header = nav.closest('header');
    if (!header) return;
    var actions = header.lastElementChild;
    if (actions && actions !== nav) actions.classList.add('head-actions');
    if (getComputedStyle(header).position === 'static') header.style.position = 'relative';

    var signin = null;
    if (actions) {
      actions.querySelectorAll('a').forEach(function (a) {
        if (/sign in/i.test(a.textContent)) { signin = a; a.classList.add('head-signin'); }
      });
    }

    var panel = document.createElement('div');
    panel.className = 'nav-panel';
    panel.id = 'nav-panel';
    nav.querySelectorAll('a').forEach(function (a) { panel.appendChild(a.cloneNode(true)); });
    if (signin) panel.appendChild(signin.cloneNode(true));
    header.appendChild(panel);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-toggle';
    btn.setAttribute('aria-label', 'Menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'nav-panel');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    (actions || header).appendChild(btn);

    function set(open) {
      panel.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function (e) { e.stopPropagation(); set(!panel.classList.contains('open')); });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    document.addEventListener('click', function (e) { if (!header.contains(e.target)) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
