/*!
 * navigation.js — navigation + menu (restaurant/product list) effects for luxury-web-animations
 * Requires: motion-core.js, GSAP (+ ScrollTrigger for smart-header, Flip for menu-showcase/filter/dish-modal,
 *           SplitText for roll-link)
 * Effects: overlay-nav · smart-header · hover-follow · menu-showcase · flip-filter · roll-link · dish-modal
 */
(function () {
  'use strict';
  var M = window.Motion;
  if (!M) return;
  var gsap = M.gsap;

  /* OVERLAY NAV — full-screen menu opens as an iris from the burger; links rise from masks;
     hovering a link crossfades a preview image. Accessible: aria-expanded, inert, Esc, focus return. */
  M.register('overlay-nav', function (M) {
    var nav = M.q('[data-fx="overlay-nav"]');
    var btn = M.q('[data-fx-nav-toggle]');
    if (!nav || !btn) return;
    var bg = M.q('.fx-nav__bg', nav);
    var links = M.qa('.fx-nav__link > *', nav);
    var metas = M.qa('.fx-nav__meta > *', nav);
    var previews = M.qa('.fx-nav__preview > *', nav);
    var isOpen = false;
    nav.inert = true;

    function origin() {
      var r = btn.getBoundingClientRect();
      return (r.left + r.width / 2) + 'px ' + (r.top + r.height / 2) + 'px';
    }
    var tl = gsap.timeline({ paused: true, defaults: { ease: M.ease.inOut } });
    function build() {
      tl.clear()
        .set(nav, { visibility: 'visible' })
        .fromTo(bg, { clipPath: 'circle(0% at ' + origin() + ')' }, { clipPath: 'circle(150% at ' + origin() + ')', duration: M.reduce ? 0 : 1 })
        .fromTo(links, { yPercent: 120, rotate: 3 }, { yPercent: 0, rotate: 0, duration: M.reduce ? 0 : 1, ease: M.ease.out, stagger: 0.06 }, '-=0.55')
        .fromTo(metas, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: M.ease.out, stagger: 0.05 }, '-=0.8');
      if (previews[0]) tl.fromTo(previews[0], { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 1 }, '-=0.9');
    }
    function toggle(force) {
      isOpen = typeof force === 'boolean' ? force : !isOpen;
      btn.setAttribute('aria-expanded', String(isOpen));
      document.documentElement.classList.toggle('fx-nav-open', isOpen);
      if (isOpen) {
        build(); nav.inert = false; M.stopScroll(); tl.timeScale(1).play(0);
        var first = M.q('a', nav); if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 400);
      } else {
        nav.inert = true; M.startScroll();
        tl.timeScale(1.6).reverse().eventCallback('onReverseComplete', function () { gsap.set(nav, { visibility: 'hidden' }); });
        btn.focus({ preventScroll: true });
      }
    }
    btn.addEventListener('click', function () { toggle(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) toggle(false); });
    M.qa('a', nav).forEach(function (a) { a.addEventListener('click', function () { if (isOpen) toggle(false); }); });

    // Hover previews: [data-preview="1"] on a link maps to the preview child at that index.
    var current = 0, z = 1;
    M.qa('[data-preview]', nav).forEach(function (a) {
      a.addEventListener('pointerenter', function () {
        var i = parseInt(a.dataset.preview, 10);
        var el = previews[i];
        if (!el || i === current) return;
        current = i;
        gsap.set(el, { zIndex: ++z });
        gsap.fromTo(el, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.9, ease: M.ease.inOut, overwrite: true });
        var img = el.querySelector('img');
        if (img) gsap.fromTo(img, { scale: 1.25 }, { scale: 1, duration: 1.4, ease: M.ease.out, overwrite: true });
      });
    });
  });

  /* SMART HEADER — hides on scroll down, returns on scroll up, turns glassy after the hero. */
  M.register('smart-header', function (M) {
    var h = M.q('[data-fx="smart-header"]');
    if (!h || !window.ScrollTrigger) return;
    var hidden = false;
    var threshold = parseFloat(h.dataset.threshold || 120);
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: function (self) {
        var y = self.scroll();
        h.classList.toggle('is-scrolled', y > 40);
        if (document.documentElement.classList.contains('fx-nav-open')) return;
        var shouldHide = self.direction === 1 && y > threshold;
        if (shouldHide !== hidden) {
          hidden = shouldHide;
          gsap.to(h, { yPercent: hidden ? -110 : 0, duration: hidden ? 0.45 : 0.7, ease: hidden ? 'power3.in' : M.ease.out, overwrite: true });
        }
      }
    });
  });

  /* HOVER FOLLOW — menu/product rows; a floating image follows the pointer, tilting with velocity,
     swapping with a clip wipe as you move between rows. Touch devices get inline thumbnails (CSS). */
  M.register('hover-follow', function (M, mm) {
    M.qa('[data-fx="hover-follow"]').forEach(function (list) {
      var follow = M.q('.fx-follow', list);
      var frame = M.q('.fx-follow__frame', list);
      var items = M.qa('[data-img]', list);
      if (!follow || !frame) return;
      items.forEach(function (it) { var im = new Image(); im.src = it.dataset.img; }); // preload

      mm.add(M.MQ.pointer, function () {
        gsap.set(follow, { xPercent: -50, yPercent: -50, scale: 0, opacity: 0 });
        var xTo = gsap.quickTo(follow, 'x', { duration: 0.7, ease: 'power3.out' });
        var yTo = gsap.quickTo(follow, 'y', { duration: 0.7, ease: 'power3.out' });
        var rTo = gsap.quickTo(follow, 'rotate', { duration: 0.9, ease: 'power3.out' });
        var lastX = 0, lastSrc = null;

        function move(e) {
          var r = list.getBoundingClientRect();
          var x = e.clientX - r.left, y = e.clientY - r.top;
          xTo(x); yTo(y);
          rTo(gsap.utils.clamp(-14, 14, (x - lastX) * 0.6));
          lastX = x;
        }
        function swap(src) {
          if (src === lastSrc) return;
          lastSrc = src;
          var img = document.createElement('img');
          img.src = src; img.alt = '';
          frame.appendChild(img);
          gsap.fromTo(img, { clipPath: 'inset(100% 0 0 0)', scale: 1.3 },
            { clipPath: 'inset(0% 0 0 0)', scale: 1, duration: 0.7, ease: M.ease.out,
              onComplete: function () { while (frame.children.length > 1) frame.removeChild(frame.firstChild); } });
        }
        function enterList() { gsap.to(follow, { scale: 1, opacity: 1, duration: 0.6, ease: M.ease.out, overwrite: 'auto' }); }
        function leaveList() { gsap.to(follow, { scale: 0, opacity: 0, duration: 0.5, ease: 'power3.in', overwrite: 'auto' }); lastSrc = null; }

        var onItem = items.map(function (it) {
          var fn = function () { swap(it.dataset.img); };
          it.addEventListener('pointerenter', fn);
          return fn;
        });
        list.addEventListener('pointermove', move);
        list.addEventListener('pointerenter', enterList);
        list.addEventListener('pointerleave', leaveList);
        return function () {
          items.forEach(function (it, i) { it.removeEventListener('pointerenter', onItem[i]); });
          list.removeEventListener('pointermove', move);
          list.removeEventListener('pointerenter', enterList);
          list.removeEventListener('pointerleave', leaveList);
        };
      });
    });
  });

  /* MENU SHOWCASE — category list + large image stage. Hover (desktop) / tap (touch) / focus
     switches category: image wipes in, active indicator glides over with Flip, items list re-staggers. */
  M.register('menu-showcase', function (M) {
    M.qa('[data-fx="menu-showcase"]').forEach(function (box) {
      var tabs = M.qa('.fx-show__tab', box);
      var stage = M.qa('.fx-show__stage > *', box);
      var panels = M.qa('.fx-show__panel', box);
      var indicator = M.q('.fx-show__indicator', box);
      var current = -1, z = 1;

      function activate(i, instant) {
        if (i === current) return;
        current = i;
        tabs.forEach(function (t, k) { t.setAttribute('aria-selected', String(k === i)); t.classList.toggle('is-active', k === i); });
        if (indicator && window.Flip) {
          var state = Flip.getState(indicator);
          tabs[i].appendChild(indicator);
          Flip.from(state, { duration: instant ? 0 : 0.6, ease: M.ease.inOut });
        } else if (indicator) tabs[i].appendChild(indicator);

        var img = stage[i];
        if (img) {
          gsap.set(img, { zIndex: ++z });
          if (instant || M.reduce) gsap.set(img, { clipPath: 'inset(0% 0 0 0)' });
          else {
            gsap.fromTo(img, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1, ease: M.ease.inOut, overwrite: true });
            var inner = img.querySelector('img, video');
            if (inner) gsap.fromTo(inner, { scale: 1.3 }, { scale: 1, duration: 1.5, ease: M.ease.out, overwrite: true });
          }
        }
        panels.forEach(function (p, k) {
          p.hidden = k !== i;
          if (k === i && !instant && !M.reduce) {
            gsap.fromTo(p.children, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.05, ease: M.ease.out, overwrite: true });
          }
        });
      }
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () { activate(i); });
        t.addEventListener('focus', function () { activate(i); });
        if (!M.touch) t.addEventListener('pointerenter', function () { activate(i); });
      });
      activate(0, true);
    });
  });

  /* FLIP FILTER — category chips reflow a grid with Flip: survivors glide, others fade/scale. */
  M.register('flip-filter', function (M) {
    if (!window.Flip) return;
    M.qa('[data-fx="flip-filter"]').forEach(function (box) {
      var chips = M.qa('[data-filter]', box);
      var items = M.qa('[data-cat]', box);
      chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          var f = chip.dataset.filter;
          chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
          var state = Flip.getState(items);
          items.forEach(function (it) {
            var cats = it.dataset.cat.split(/\s+/);
            it.hidden = !(f === 'all' || cats.indexOf(f) > -1);
          });
          Flip.from(state, {
            duration: M.reduce ? 0 : 0.8, ease: M.ease.inOut, absolute: true, stagger: 0.015, scale: true,
            onEnter: function (els) { return gsap.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.7, ease: M.ease.out }); },
            onLeave: function (els) { return gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.45 }); }
          });
        });
      });
    });
  });

  /* ROLL LINK — letters roll up one by one to a duplicate on hover (per-char CSS delay via SplitText propIndex). */
  M.register('roll-link', function (M) {
    if (!window.SplitText) return;
    M.qa('[data-fx="roll-link"]').forEach(function (a) {
      if (a.dataset.fxReady) return;
      a.dataset.fxReady = '1';
      var text = a.textContent.trim();
      a.setAttribute('aria-label', text);
      a.innerHTML = '<span class="fx-roll__a" aria-hidden="true">' + text + '</span><span class="fx-roll__b" aria-hidden="true">' + text + '</span>';
      SplitText.create(M.qa('span', a), { type: 'chars', propIndex: true, charsClass: 'fx-roll__char', aria: 'none' });
    });
  });

  /* DISH MODAL — clicking a card morphs its image into a full detail view with Flip, and back. */
  M.register('dish-modal', function (M) {
    var modal = M.q('[data-fx="dish-modal"]');
    if (!modal || !window.Flip) return;
    var slot = M.q('.fx-dish__media', modal);
    var title = M.q('.fx-dish__title', modal);
    var body = M.q('.fx-dish__body', modal);
    var closeBtn = M.q('.fx-dish__close', modal);
    var active = null;

    M.qa('[data-dish]').forEach(function (card) {
      card.setAttribute('tabindex', card.getAttribute('tabindex') || '0');
      card.setAttribute('role', 'button');
      function open() {
        var img = card.querySelector('img');
        if (!img || active) return;
        active = { card: card, img: img, home: img.parentElement };
        title.textContent = card.dataset.title || '';
        body.innerHTML = card.querySelector('template') ? card.querySelector('template').innerHTML : '';
        var state = Flip.getState(img);
        modal.hidden = false; M.stopScroll();
        slot.appendChild(img);
        Flip.from(state, { duration: M.reduce ? 0 : 0.9, ease: M.ease.inOut, absolute: true, zIndex: 50 });
        gsap.fromTo(M.qa('.fx-dish__backdrop, .fx-dish__content > *', modal), { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.05, delay: 0.25, ease: M.ease.out });
        closeBtn.focus({ preventScroll: true });
      }
      card.addEventListener('click', open);
      card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });

    function close() {
      if (!active) return;
      var a = active; active = null;
      gsap.to(M.qa('.fx-dish__content > *', modal), { opacity: 0, duration: 0.3 });
      var state = Flip.getState(a.img);
      a.home.appendChild(a.img);
      Flip.from(state, { duration: M.reduce ? 0 : 0.8, ease: M.ease.inOut, absolute: true, zIndex: 50 });
      gsap.to(M.q('.fx-dish__backdrop', modal), { opacity: 0, duration: 0.6, delay: 0.2, onComplete: function () { modal.hidden = true; M.startScroll(); a.card.focus({ preventScroll: true }); } });
    }
    closeBtn.addEventListener('click', close);
    M.q('.fx-dish__backdrop', modal).addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  });
})();

// Rouveraki: marks this file as an ES module so the bundler and TypeScript can import it.
export {};
