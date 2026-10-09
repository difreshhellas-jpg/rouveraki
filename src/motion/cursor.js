/*!
 * cursor.js — pointer effects for luxury-web-animations (desktop / fine pointers only)
 * Requires: motion-core.js, GSAP
 * Effects: custom-cursor · ribbon-trail · image-trail · magnetic · spotlight · tilt · fill-button
 */
(function () {
  'use strict';
  var M = window.Motion;
  if (!M) return;
  var gsap = M.gsap;

  /* CUSTOM CURSOR — instant dot + lagging ring. Ring grows over links; shows a label
     over [data-cursor="View"]; hides over [data-cursor="hide"]. */
  M.register('custom-cursor', function (M, mm) {
    var el = M.q('[data-fx="custom-cursor"]');
    if (!el) return;
    mm.add(M.MQ.pointer, function () {
      var dot = M.q('.fx-cursor__dot', el);
      var ring = M.q('.fx-cursor__ring', el);
      var label = M.q('.fx-cursor__label', el);
      document.documentElement.classList.add('has-fx-cursor');
      var dx = gsap.quickSetter(dot, 'x', 'px'), dy = gsap.quickSetter(dot, 'y', 'px');
      var rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3.out' });
      var ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3.out' });
      var shown = false;

      function move(e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        if (!shown) { shown = true; gsap.to(el, { opacity: 1, duration: 0.3 }); gsap.set(ring, { x: e.clientX, y: e.clientY }); }
        dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
      }
      function over(e) {
        var t = e.target.closest('[data-cursor], a, button, [role="button"], input, textarea, select, label');
        el.classList.remove('is-link', 'is-label', 'is-hidden');
        if (!t) return;
        var mode = t.getAttribute('data-cursor');
        if (mode === 'hide') el.classList.add('is-hidden');
        else if (mode) { el.classList.add('is-label'); label.textContent = mode; }
        else el.classList.add('is-link');
      }
      function leave() { shown = false; gsap.to(el, { opacity: 0, duration: 0.3 }); }
      function down() { gsap.to(ring, { scale: 0.8, duration: 0.2 }); }
      function up() { gsap.to(ring, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' }); }

      window.addEventListener('pointermove', move, { passive: true });
      document.addEventListener('pointerover', over);
      document.documentElement.addEventListener('pointerleave', leave);
      window.addEventListener('pointerdown', down);
      window.addEventListener('pointerup', up);
      return function () {
        document.documentElement.classList.remove('has-fx-cursor');
        window.removeEventListener('pointermove', move);
        document.removeEventListener('pointerover', over);
        document.documentElement.removeEventListener('pointerleave', leave);
        window.removeEventListener('pointerdown', down);
        window.removeEventListener('pointerup', up);
      };
    });
  });

  /* RIBBON TRAIL — a smooth, tapering, fading ink ribbon (not a dotted 2000s trail).
     <canvas data-fx="ribbon-trail" data-color="#c9a36b" data-width="10" data-life="450"></canvas> */
  M.register('ribbon-trail', function (M, mm) {
    var canvas = M.q('[data-fx="ribbon-trail"]');
    if (!canvas) return;
    mm.add(M.MQ.pointer, function () {
      var ctx = canvas.getContext('2d');
      var color = canvas.dataset.color || getComputedStyle(document.documentElement).getPropertyValue('--fx-accent').trim() || '#fff';
      var maxW = parseFloat(canvas.dataset.width || 10);
      var life = parseFloat(canvas.dataset.life || 450);
      var pts = [];
      var dpr = Math.min(window.devicePixelRatio || 1, 2);

      function size() {
        canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      size();
      function move(e) {
        if (e.pointerType !== 'mouse') return;
        pts.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      }
      function tick() {
        var now = performance.now();
        while (pts.length && now - pts[0].t > life) pts.shift();
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        if (pts.length < 3) return;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color;
        for (var i = 1; i < pts.length - 1; i++) {
          var p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1];
          var a = 1 - (now - p1.t) / life;
          ctx.globalAlpha = a * a;
          ctx.lineWidth = Math.max(0.5, maxW * a);
          ctx.beginPath();
          ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
          ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      window.addEventListener('pointermove', move, { passive: true });
      window.addEventListener('resize', size);
      gsap.ticker.add(tick);
      return function () {
        gsap.ticker.remove(tick);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('resize', size);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      };
    });
  });

  /* IMAGE TRAIL — photos spawn along the pointer path inside a container, then fall away.
     Perfect over a hero or a "gallery" band: dishes, products, interiors. */
  M.register('image-trail', function (M, mm) {
    M.qa('[data-fx="image-trail"]').forEach(function (box) {
      var imgs = M.qa('.fx-itrail__img', box);
      if (!imgs.length) return;
      mm.add(M.MQ.pointer, function () {
        var threshold = parseFloat(box.dataset.threshold || 90);
        var last = null, idx = 0, z = 1;
        gsap.set(imgs, { xPercent: -50, yPercent: -50, opacity: 0 });
        function move(e) {
          var r = box.getBoundingClientRect();
          var x = e.clientX - r.left, y = e.clientY - r.top;
          if (!last) { last = { x: x, y: y }; return; }
          var dist = Math.hypot(x - last.x, y - last.y);
          if (dist < threshold) return;
          var img = imgs[idx++ % imgs.length];
          var angle = Math.atan2(y - last.y, x - last.x);
          gsap.killTweensOf(img);
          gsap.timeline()
            .set(img, { x: last.x, y: last.y, opacity: 1, scale: 0.4, rotate: gsap.utils.random(-12, 12), zIndex: ++z })
            .to(img, { x: x, y: y, scale: 1, duration: 0.7, ease: 'expo.out' })
            .to(img, { opacity: 0, scale: 0.2, x: x + Math.cos(angle) * 60, y: y + Math.sin(angle) * 60 + 80,
              duration: 0.9, ease: 'power3.in' }, 0.45);
          last = { x: x, y: y };
        }
        function leave() { last = null; }
        box.addEventListener('pointermove', move);
        box.addEventListener('pointerleave', leave);
        return function () { box.removeEventListener('pointermove', move); box.removeEventListener('pointerleave', leave); };
      });
    });
  });

  /* MAGNETIC — element leans to the pointer; its label leans further (depth); elastic snap-back.
     data-strength="0.35" · optional inner .fx-magnetic__label */
  M.register('magnetic', function (M, mm) {
    M.qa('[data-fx="magnetic"]').forEach(function (el) {
      mm.add(M.MQ.pointer, function () {
        var s = parseFloat(el.dataset.strength || 0.35);
        var label = M.q('.fx-magnetic__label', el);
        var xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
        var yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
        var lx = label && gsap.quickTo(label, 'x', { duration: 0.6, ease: 'power3.out' });
        var ly = label && gsap.quickTo(label, 'y', { duration: 0.6, ease: 'power3.out' });
        function move(e) {
          var r = el.getBoundingClientRect();
          var x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
          xTo(x * s); yTo(y * s);
          if (label) { lx(x * s * 0.6); ly(y * s * 0.6); }
        }
        function leave() {
          gsap.to(el, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.35)', overwrite: true });
          if (label) gsap.to(label, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.35)', overwrite: true });
        }
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerleave', leave);
        return function () { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
      });
    });
  });

  /* SPOTLIGHT — a soft circle follows the pointer and reveals a second image beneath
     (before/after, day/night, raw/plated). Touch: tap toggles. */
  M.register('spotlight', function (M, mm) {
    M.qa('[data-fx="spotlight"]').forEach(function (box) {
      var top = M.q('.fx-spot__top', box);
      var radius = parseFloat(box.dataset.radius || 170);
      var p = { x: 0, y: 0, r: 0 };
      function apply() {
        top.style.setProperty('--x', p.x + 'px');
        top.style.setProperty('--y', p.y + 'px');
        top.style.setProperty('--r', p.r + 'px');
      }
      mm.add(M.MQ.pointer, function () {
        var xTo = gsap.quickTo(p, 'x', { duration: 0.55, ease: 'power3.out', onUpdate: apply });
        var yTo = gsap.quickTo(p, 'y', { duration: 0.55, ease: 'power3.out', onUpdate: apply });
        function move(e) { var r = box.getBoundingClientRect(); xTo(e.clientX - r.left); yTo(e.clientY - r.top); }
        function enter(e) {
          var r = box.getBoundingClientRect(); p.x = e.clientX - r.left; p.y = e.clientY - r.top;
          gsap.to(p, { r: radius, duration: 0.8, ease: M.ease.out, onUpdate: apply, overwrite: 'auto' });
        }
        function leave() { gsap.to(p, { r: 0, duration: 0.6, ease: 'power3.inOut', onUpdate: apply, overwrite: 'auto' }); }
        box.addEventListener('pointermove', move);
        box.addEventListener('pointerenter', enter);
        box.addEventListener('pointerleave', leave);
        return function () {
          box.removeEventListener('pointermove', move);
          box.removeEventListener('pointerenter', enter);
          box.removeEventListener('pointerleave', leave);
        };
      });
      box.addEventListener('click', function () {
        if (!M.touch) return;
        var open = p.r > 0;
        p.x = box.clientWidth / 2; p.y = box.clientHeight / 2;
        gsap.to(p, { r: open ? 0 : Math.hypot(box.clientWidth, box.clientHeight), duration: 1, ease: M.ease.inOut, onUpdate: apply });
      });
    });
  });

  /* TILT — 3D card tilt with a moving specular glare. data-max="10" (degrees) */
  M.register('tilt', function (M, mm) {
    M.qa('[data-fx="tilt"]').forEach(function (card) {
      mm.add(M.MQ.pointer, function () {
        var max = parseFloat(card.dataset.max || 10);
        var glare = M.q('.fx-tilt__glare', card);
        gsap.set(card, { transformPerspective: 900, transformStyle: 'preserve-3d' });
        var rX = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3.out' });
        var rY = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3.out' });
        function move(e) {
          var r = card.getBoundingClientRect();
          var nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
          rY((nx - 0.5) * max * 2); rX(-(ny - 0.5) * max * 2);
          if (glare) { glare.style.setProperty('--gx', nx * 100 + '%'); glare.style.setProperty('--gy', ny * 100 + '%'); glare.style.opacity = 1; }
        }
        function leave() { rX(0); rY(0); if (glare) glare.style.opacity = 0; }
        card.addEventListener('pointermove', move);
        card.addEventListener('pointerleave', leave);
        return function () { card.removeEventListener('pointermove', move); card.removeEventListener('pointerleave', leave); };
      });
    });
  });

  /* FILL BUTTON — colour floods in from the exact point the pointer entered, drains toward where it left. */
  M.register('fill-button', function (M) {
    M.qa('[data-fx="fill-button"]').forEach(function (btn) {
      function setOrigin(e) {
        var r = btn.getBoundingClientRect();
        btn.style.setProperty('--fx', ((e.clientX - r.left) / r.width) * 100 + '%');
        btn.style.setProperty('--fy', ((e.clientY - r.top) / r.height) * 100 + '%');
      }
      btn.addEventListener('pointerenter', setOrigin);
      btn.addEventListener('pointerleave', setOrigin);
    });
  });
})();

// Rouveraki: marks this file as an ES module so the bundler and TypeScript can import it.
export {};
