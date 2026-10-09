/*!
 * scroll.js — scroll-driven storytelling effects for luxury-web-animations
 * Requires: motion-core.js, GSAP + ScrollTrigger (+ SplitText for text effects)
 * Effects: horizontal · sticky-stack · section-wipe · clip-reveal · parallax · text-highlight
 *          blur-text · counter · velocity-marquee · perspective-grid · scroll-progress
 *          color-shift · sticky-story · kinetic-type · footer-reveal · fade-up
 */
(function () {
  'use strict';
  var M = window.Motion;
  if (!M || !window.ScrollTrigger) return;
  var gsap = M.gsap;

  /* HORIZONTAL — vertical scroll drives a sideways track; images parallax inside
     their panels via containerAnimation. Mobile falls back to native swipe + snap. */
  M.register('horizontal', function (M, mm) {
    M.qa('[data-fx="horizontal"]').forEach(function (sec) {
      var track = M.q('.fx-h__track', sec);
      var bar = M.q('.fx-h__progress > span', sec);
      mm.add(M.MQ.desktop, function () {
        function dist() { return track.scrollWidth - sec.clientWidth; }
        var tween = gsap.to(track, {
          x: function () { return -dist(); }, ease: 'none',
          scrollTrigger: {
            trigger: sec, start: 'top top', end: function () { return '+=' + dist(); },
            pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1
          }
        });
        M.qa('.fx-h__panel', sec).forEach(function (panel) {
          var img = M.q('.fx-h__media > *', panel);
          if (img) gsap.fromTo(img, { xPercent: -10 }, {
            xPercent: 10, ease: 'none',
            scrollTrigger: { trigger: panel, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true }
          });
          var txt = M.q('.fx-h__text', panel);
          if (txt) gsap.from(txt, {
            y: 60, opacity: 0, duration: 1.1,
            scrollTrigger: { trigger: panel, containerAnimation: tween, start: 'left 70%', toggleActions: 'play none none reverse' }
          });
        });
        if (bar) gsap.fromTo(bar, { scaleX: 0 }, {
          scaleX: 1, ease: 'none',
          scrollTrigger: { trigger: sec, start: 'top top', end: function () { return '+=' + dist(); }, scrub: true }
        });
        return function () { gsap.set(track, { clearProps: 'transform' }); };
      });
    });
  });

  /* STICKY STACK — cards pin one over another; buried cards shrink and dim. */
  M.register('sticky-stack', function (M, mm) {
    M.qa('[data-fx="sticky-stack"]').forEach(function (stack) {
      var cards = M.qa('.fx-stack__card', stack);
      cards.forEach(function (c, i) { c.style.setProperty('--i', i); });
      mm.add(M.MQ.motion, function () {
        cards.forEach(function (card, i) {
          var next = cards[i + 1];
          if (!next) return;
          gsap.to(card, {
            scale: 0.9 - (cards.length - i) * 0.005, '--dim': 0.55, rotateX: -4, ease: 'none',
            scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 15%', scrub: true }
          });
        });
      });
    });
  });

  /* SECTION WIPE — cinematic "scene cut" as a section enters.
     data-wipe="rise" (rounded inset opens, default) | "circle" (pinned iris) | "curtain" (previous-colour panel lifts off) */
  M.register('section-wipe', function (M, mm) {
    M.qa('[data-fx="section-wipe"]').forEach(function (sec) {
      var type = sec.dataset.wipe || 'rise';
      mm.add(M.MQ.motion, function () {
        if (type === 'rise') {
          gsap.fromTo(sec,
            { clipPath: 'inset(12% 6% 0% 6% round 40px)' },
            { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
              scrollTrigger: { trigger: sec, start: 'top bottom', end: 'top top', scrub: true } });
          var inner = M.q('.fx-wipe__inner', sec);
          if (inner) gsap.fromTo(inner, { yPercent: -15 }, {
            yPercent: 0, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'top top', scrub: true }
          });
        } else if (type === 'circle') {
          var layer = M.q('.fx-wipe__inner', sec) || sec;
          gsap.fromTo(layer,
            { clipPath: 'circle(0% at 50% 50%)' },
            { clipPath: 'circle(75% at 50% 50%)', ease: 'none',
              scrollTrigger: { trigger: sec, start: 'top top', end: '+=100%', pin: true, scrub: 1 } });
        } else if (type === 'curtain') {
          var panel = M.q('.fx-wipe__curtain', sec);
          if (panel) gsap.fromTo(panel, { clipPath: 'inset(0% 0% 0% 0%)' }, {
            clipPath: 'inset(0% 0% 100% 0%)', ease: 'none',
            scrollTrigger: { trigger: sec, start: 'top top', end: '+=80%', pin: true, scrub: 1 }
          });
        }
      });
    });
  });

  /* CLIP REVEAL — image unmasks (up/down/left/right/center) while its content settles from 1.3x. */
  M.register('clip-reveal', function (M, mm) {
    var from = {
      up: 'inset(100% 0% 0% 0%)', down: 'inset(0% 0% 100% 0%)',
      left: 'inset(0% 100% 0% 0%)', right: 'inset(0% 0% 0% 100%)', center: 'inset(50% 50% 50% 50%)'
    };
    M.qa('[data-fx="clip-reveal"]').forEach(function (el) {
      mm.add(M.MQ.motion, function () {
        var media = el.firstElementChild;
        var tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
        tl.fromTo(el, { clipPath: from[el.dataset.dir || 'up'] }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: M.ease.inOut });
        if (media) tl.fromTo(media, { scale: 1.3 }, { scale: 1, duration: 1.8, ease: M.ease.out }, 0);
      });
    });
  });

  /* PARALLAX — data-parallax="-20..20" = yPercent travel across the viewport pass.
     Use different values on sibling columns for the "elastic grid" look. */
  M.register('parallax', function (M, mm) {
    M.qa('[data-parallax]').forEach(function (el) {
      mm.add(M.MQ.motion, function () {
        var v = parseFloat(el.dataset.parallax);
        gsap.fromTo(el, { yPercent: v }, {
          yPercent: -v, ease: 'none',
          scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });
    });
  });

  /* TEXT HIGHLIGHT — a paragraph "reads itself": words brighten as you scroll.
     Wrap key words in <mark> for an additional sweeping highlight bar. */
  M.register('text-highlight', function (M, mm) {
    if (!window.SplitText) return;
    M.qa('[data-fx="text-highlight"]').forEach(function (el) {
      mm.add(M.MQ.motion, function () {
        var split = SplitText.create(el, { type: 'words' });
        var st = { trigger: el, start: 'top 80%', end: 'bottom 40%', scrub: true };
        gsap.fromTo(split.words, { opacity: 0.14 }, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: st });
        M.qa('mark', el).forEach(function (m) {
          gsap.fromTo(m, { backgroundSize: '0% 100%' }, {
            backgroundSize: '100% 100%', ease: 'none',
            scrollTrigger: { trigger: m, start: 'top 70%', end: 'top 45%', scrub: true }
          });
        });
        return function () { split.revert(); };
      });
    });
  });

  /* BLUR TEXT — characters condense out of a blur. Use on short headings only (filter cost). */
  M.register('blur-text', function (M, mm) {
    if (!window.SplitText) return;
    M.qa('[data-fx="blur-text"]').forEach(function (el) {
      mm.add(M.MQ.motion, function () {
        var split = SplitText.create(el, { type: 'words, chars' });
        gsap.set(el, { visibility: 'visible' });
        gsap.from(split.chars, {
          opacity: 0, filter: 'blur(12px)', yPercent: 40, scale: 1.2,
          duration: 1.2, stagger: { each: 0.025, from: el.dataset.from || 'start' }, ease: M.ease.out,
          scrollTrigger: { trigger: el, start: 'top 85%', once: true }
        });
        return function () { split.revert(); };
      });
    });
  });

  /* COUNTER — numbers roll up once. data-to="1200" data-decimals="0" data-prefix="€" data-suffix="+" */
  M.register('counter', function (M) {
    M.qa('[data-fx="counter"]').forEach(function (el) {
      var to = parseFloat(el.dataset.to);
      var dec = parseInt(el.dataset.decimals || '0', 10);
      var fmt = new Intl.NumberFormat(document.documentElement.lang || undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
      var pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
      var o = { v: 0 };
      function paint() { el.textContent = pre + fmt.format(o.v) + suf; }
      if (M.reduce) { o.v = to; paint(); return; }
      paint();
      gsap.to(o, { v: to, duration: 2.2, ease: 'power3.out', onUpdate: paint,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });
  });

  /* VELOCITY MARQUEE — endless ribbon that surges, reverses and skews with scroll speed. */
  M.register('velocity-marquee', function (M) {
    M.qa('[data-fx="velocity-marquee"]').forEach(function (el) {
      var inner = M.q('.fx-marquee__inner', el);
      if (!inner) return;
      inner.innerHTML += inner.innerHTML; // two copies → seamless -50% loop
      if (M.reduce) return;
      var speed = parseFloat(el.dataset.speed || 2.5);          // % of track per second
      var dir = parseFloat(el.dataset.direction || 1);           // 1 = left, -1 = right
      var x = 0, boost = 0, scrollDir = 1, visible = true;
      var wrap = gsap.utils.wrap(-50, 0);
      var setX = gsap.quickSetter(inner, 'xPercent');
      var skewTo = gsap.quickTo(inner, 'skewX', { duration: 0.5, ease: 'power3.out' });

      new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(el);
      ScrollTrigger.create({
        trigger: el, start: 'top bottom', end: 'bottom top',
        onUpdate: function (self) {
          var v = self.getVelocity();
          scrollDir = self.direction;
          boost = gsap.utils.clamp(0, 18, Math.abs(v) / 180);
          skewTo(gsap.utils.clamp(-7, 7, v / -350));
        }
      });
      gsap.ticker.add(function (t, dt) {
        if (!visible) return;
        x = wrap(x - (speed + boost) * dir * scrollDir * (dt / 1000));
        boost *= 0.93;
        if (boost < 0.05) skewTo(0);
        setX(x);
      });
    });
  });

  /* PERSPECTIVE GRID — a tilted 3D image grid lands flat as it scrolls in; items fly up from depth. */
  M.register('perspective-grid', function (M, mm) {
    M.qa('[data-fx="perspective-grid"]').forEach(function (sec) {
      var grid = M.q('.fx-pgrid__grid', sec);
      var items = M.qa('.fx-pgrid__item', sec);
      mm.add(M.MQ.motion, function () {
        var tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top bottom', end: 'center center', scrub: 1 } });
        tl.fromTo(grid, { rotateX: 48, scale: 0.8, yPercent: 15 }, { rotateX: 0, scale: 1, yPercent: 0, ease: 'none' }, 0)
          .fromTo(items, { z: function () { return gsap.utils.random(-900, -200); }, opacity: 0 },
            { z: 0, opacity: 1, ease: 'none', stagger: { each: 0.02, from: 'random' } }, 0);
      });
    });
  });

  /* SCROLL PROGRESS — hairline that fills with page progress. */
  M.register('scroll-progress', function (M) {
    var bar = M.q('[data-fx="scroll-progress"]');
    if (!bar) return;
    gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
  });

  /* COLOR SHIFT — page background/foreground morph per section.
     <section data-bg="#0f0e0c" data-fg="#f2ece2"> (body must use var(--fx-bg)/var(--fx-fg)) */
  M.register('color-shift', function (M) {
    var secs = M.qa('[data-bg]');
    if (!secs.length) return;
    var root = document.documentElement;
    function go(s) {
      gsap.to(root, { '--fx-bg': s.dataset.bg, '--fx-fg': s.dataset.fg || getComputedStyle(root).getPropertyValue('--fx-fg'),
        duration: M.reduce ? 0 : 0.9, ease: 'power2.inOut', overwrite: 'auto' });
    }
    secs.forEach(function (s) {
      ScrollTrigger.create({
        trigger: s, start: 'top 55%', end: 'bottom 55%',
        onToggle: function (self) { if (self.isActive) go(s); }
      });
    });
  });

  /* STICKY STORY — media column stays pinned while text steps scroll past;
     each step clip-reveals its matching image. Steps: [data-step="0"], media: .fx-story__media > *[data-step="0"] */
  M.register('sticky-story', function (M) {
    M.qa('[data-fx="sticky-story"]').forEach(function (sec) {
      var steps = M.qa('.fx-story__step', sec);
      var media = M.qa('.fx-story__media > *', sec);
      var z = 1, current = -1;
      function show(i) {
        if (i === current || !media[i]) return;
        current = i;
        steps.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
        gsap.set(media[i], { zIndex: ++z });
        if (M.reduce) { gsap.set(media[i], { clipPath: 'inset(0% 0% 0% 0%)' }); return; }
        gsap.fromTo(media[i], { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: M.ease.inOut, overwrite: true });
        var inner = media[i].querySelector('img, video');
        if (inner) gsap.fromTo(inner, { scale: 1.25 }, { scale: 1, duration: 1.6, ease: M.ease.out, overwrite: true });
      }
      steps.forEach(function (step, i) {
        ScrollTrigger.create({
          trigger: step, start: 'top 55%', end: 'bottom 55%',
          onToggle: function (self) { if (self.isActive) show(i); }
        });
      });
      show(0);
    });
  });

  /* KINETIC TYPE — oversized rows of text drift sideways in opposite directions on scroll. */
  M.register('kinetic-type', function (M, mm) {
    M.qa('[data-fx="kinetic-type"]').forEach(function (sec) {
      mm.add(M.MQ.motion, function () {
        M.qa('.fx-kinetic__row', sec).forEach(function (row, i) {
          var amt = parseFloat(row.dataset.amount || 25) * (i % 2 ? 1 : -1);
          gsap.fromTo(row, { xPercent: -amt / 2 }, { xPercent: amt / 2, ease: 'none',
            scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true } });
        });
      });
    });
  });

  /* FOOTER REVEAL — footer sits underneath the page and is uncovered like a drawer. */
  M.register('footer-reveal', function (M, mm) {
    var f = M.q('[data-fx="footer-reveal"]');
    if (!f) return;
    var inner = M.q('.fx-footer__inner', f);
    mm.add(M.MQ.motion, function () {
      if (inner) gsap.fromTo(inner, { yPercent: -35, opacity: 0.4 }, { yPercent: 0, opacity: 1, ease: 'none',
        scrollTrigger: { trigger: f, start: 'top bottom', end: 'bottom bottom', scrub: true } });
    });
  });

  /* FADE-UP — the workhorse. Children of [data-fx="fade-up"][data-stagger] stagger in. */
  M.register('fade-up', function (M, mm) {
    M.qa('[data-fx="fade-up"]').forEach(function (el) {
      mm.add(M.MQ.motion, function () {
        var kids = el.hasAttribute('data-stagger') ? el.children : el;
        if (kids !== el) gsap.set(el, { opacity: 1, y: 0 });
        gsap.fromTo(kids, { opacity: 0, y: 40 }, {
          opacity: 1, y: 0, duration: 1.1, ease: M.ease.out,
          stagger: parseFloat(el.dataset.stagger || 0.08),
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        });
      });
    });
  });
})();

// Rouveraki: marks this file as an ES module so the bundler and TypeScript can import it.
export {};
