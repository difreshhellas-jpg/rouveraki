/*!
 * motion-core.js — boot file for the luxury-web-animations skill
 * Load order (all with `defer`): GSAP + plugins → Lenis (optional) → motion-core.js → effect files.
 * Every effect registers itself with Motion.register(name, fn) and self-guards on its [data-fx] selector,
 * so including an effect file on a page that doesn't use it costs nothing but bytes.
 */
(function (w, d) {
  'use strict';
  var gsap = w.gsap;
  if (!gsap) { console.warn('[motion] GSAP not found — effects disabled, content stays visible.'); return; }

  // Register whatever plugins are present on the page.
  var names = ['ScrollTrigger', 'SplitText', 'Flip', 'CustomEase', 'ScrambleTextPlugin', 'Observer'];
  var plugins = names.map(function (n) { return w[n]; }).filter(Boolean);
  if (plugins.length) gsap.registerPlugin.apply(gsap, plugins);

  var root = d.documentElement;
  var reduce = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = w.matchMedia('(hover: none), (pointer: coarse)').matches;

  // `js` class unlocks the pre-hidden (FOUC-safe) states in motion-base.css.
  root.classList.add('js');
  if (reduce) root.classList.add('reduced-motion');
  if (touch) root.classList.add('is-touch');

  // Signature eases. expo-style out for reveals, symmetric in-out for wipes/curtains.
  var ease = { out: 'expo.out', inOut: 'power4.inOut', soft: 'power3.out' };
  if (w.CustomEase) {
    w.CustomEase.create('luxOut', '0.16, 1, 0.3, 1');
    w.CustomEase.create('luxInOut', '0.76, 0, 0.24, 1');
    ease.out = 'luxOut';
    ease.inOut = 'luxInOut';
  }
  gsap.defaults({ ease: ease.out, duration: 1 });

  // Smooth scroll (Lenis) synced to GSAP's ticker so ScrollTrigger and WebGL share one loop.
  // Rouveraki: created per boot and destroyed on teardown, so smooth scroll is homepage-only
  // across Next.js client navigation (the drawer sheets on /menu must scroll natively).
  var lenis = null;
  function lenisTick(t) { if (lenis) lenis.raf(t * 1000); }
  function makeLenis() {
    if (!w.Lenis || reduce || root.hasAttribute('data-no-smooth')) return;
    lenis = new w.Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1 });
    if (w.ScrollTrigger) lenis.on('scroll', w.ScrollTrigger.update);
    gsap.ticker.add(lenisTick);
    gsap.ticker.lagSmoothing(0);
  }
  d.addEventListener('click', function (e) {
    if (!lenis) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (!id || id.length < 2) return;
    var target = d.querySelector(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { duration: 1.4 });
    history.pushState(null, '', id);
  });

  // Intro gate: hero animations wait for the preloader (if any) to finish.
  var introResolve;
  var intro = new Promise(function (r) { introResolve = r; });

  var registry = [];
  var started = false;
  var mm = gsap.matchMedia();

  function run(entry) {
    try { entry.fn(Motion, mm); }
    catch (err) { console.error('[motion] effect "' + entry.name + '" failed:', err); }
  }

  var Motion = {
    gsap: gsap,
    lenis: lenis,
    reduce: reduce,
    touch: touch,
    ease: ease,
    intro: intro,
    finishIntro: function () { introResolve(); },
    // Media conditions most effects use with mm.add(...)
    MQ: {
      motion: '(prefers-reduced-motion: no-preference)',
      desktop: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
      pointer: '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
    },
    q: function (s, r) { return (r || d).querySelector(s); },
    qa: function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); },
    lerp: function (a, b, n) { return a + (b - a) * n; },
    stopScroll: function () { if (lenis) lenis.stop(); else root.style.overflow = 'hidden'; },
    startScroll: function () { if (lenis) lenis.start(); else root.style.overflow = ''; },
    register: function (name, fn) {
      var entry = { name: name, fn: fn };
      registry.push(entry);
      if (started) run(entry); // late registration (e.g. module scripts) still works
    },
    refresh: function () { if (w.ScrollTrigger) w.ScrollTrigger.refresh(); },
    // Rouveraki: undo every effect and the smooth scroll when the page unmounts...
    teardown: function () {
      mm.revert();
      if (w.ScrollTrigger) w.ScrollTrigger.getAll().forEach(function (t) { t.kill(); });
      if (lenis) { gsap.ticker.remove(lenisTick); lenis.destroy(); lenis = null; Motion.lenis = null; }
      started = false;
    },
    // ...and re-run them against the new DOM when it mounts again.
    boot: function () { mm = gsap.matchMedia(); start(); }
  };

  function start() {
    if (started) return;
    started = true;
    makeLenis();
    Motion.lenis = lenis;
    if (!d.querySelector('[data-fx="preloader"]')) introResolve();
    registry.forEach(run);
    // Layout shifts from images/fonts invalidate scroll positions — refresh once they settle.
    w.addEventListener('load', Motion.refresh);
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(Motion.refresh);
  }

  w.Motion = Motion;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();
})(window, document);

// Rouveraki: marks this file as an ES module so the bundler and TypeScript can import it.
export {};
