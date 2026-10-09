/*!
 * hero.js — cinematic hero effects for luxury-web-animations
 * Requires: motion-core.js, GSAP + ScrollTrigger. SplitText for masked-headline.
 * Effects: preloader · zoom-blur-hero · masked-headline · expand-media · video-scrub
 *          image-sequence · mouse-parallax · text-mask-zoom
 */
(function () {
  'use strict';
  var M = window.Motion;
  if (!M) return;
  var gsap = M.gsap;

  /* ------------------------------------------------------------------
   * PRELOADER — counter tracks real image loading, then column curtains lift.
   * Resolves Motion.intro so hero reveals start exactly as the curtain clears.
   * ------------------------------------------------------------------ */
  M.register('preloader', function (M) {
    var el = M.q('[data-fx="preloader"]');
    if (!el) return;
    var count = M.q('.fx-preloader__count', el);
    var brand = M.q('.fx-preloader__brand', el);
    var panels = M.qa('.fx-preloader__panel', el);
    var once = el.hasAttribute('data-once');

    function done() {
      el.remove();
      M.startScroll();
      M.finishIntro();
      M.refresh();
    }

    if (M.reduce || (once && sessionStorage.getItem('fx-preloaded'))) { done(); return; }
    if (once) sessionStorage.setItem('fx-preloaded', '1');

    M.stopScroll();
    var imgs = M.qa('img').filter(function (i) { return i.loading !== 'lazy'; });
    var total = Math.max(imgs.length, 1);
    var loaded = 0;
    var shown = { v: 0 };
    var minTime = parseFloat(el.dataset.minTime || 1.2);
    var t0 = performance.now();

    function setCount() { if (count) count.textContent = Math.round(shown.v); }
    function progressTo(p) {
      gsap.to(shown, { v: p, duration: 0.6, ease: 'power2.out', overwrite: true, onUpdate: setCount });
    }
    function tick() { loaded++; progressTo(Math.min(99, (loaded / total) * 100)); }
    imgs.forEach(function (img) {
      if (img.complete) tick();
      else { img.addEventListener('load', tick, { once: true }); img.addEventListener('error', tick, { once: true }); }
    });

    function exit() {
      var wait = Math.max(0, minTime - (performance.now() - t0) / 1000);
      var tl = gsap.timeline({ delay: wait, onComplete: done });
      tl.to(shown, { v: 100, duration: 0.5, ease: 'power2.inOut', onUpdate: setCount })
        .to([count, brand].filter(Boolean), { yPercent: -110, opacity: 0, duration: 0.6, ease: M.ease.inOut, stagger: 0.05 }, '+=0.1')
        .to(panels, { yPercent: -100, duration: 1.1, ease: M.ease.inOut, stagger: { each: 0.07, from: 'start' } }, '-=0.25')
        .add(function () { M.finishIntro(); }, '-=0.55'); // hero starts under the lifting curtain
    }
    if (d().readyState === 'complete') exit();
    else window.addEventListener('load', exit, { once: true });
  });

  function d() { return document; }

  /* ------------------------------------------------------------------
   * ZOOM-BLUR HERO — media zooms out, blurs and darkens as you leave;
   * headline lifts and fades; next section slides OVER the pinned hero.
   * Intro: media settles from 1.18 → 1 when Motion.intro resolves.
   * ------------------------------------------------------------------ */
  M.register('zoom-blur-hero', function (M, mm) {
    M.qa('[data-fx="zoom-blur-hero"]').forEach(function (hero) {
      var media = M.q('.fx-hero__media', hero);
      var shade = M.q('.fx-hero__shade', hero);
      var content = M.q('.fx-hero__content', hero);
      var blurMax = parseFloat(hero.dataset.blur || 12);

      mm.add({ desktop: '(min-width: 768px)', motion: M.MQ.motion }, function (ctx) {
        if (!ctx.conditions.motion) return;
        var isDesktop = ctx.conditions.desktop;

        gsap.set(media, { scale: 1.18 });
        M.intro.then(function () {
          gsap.to(media, { scale: 1, duration: 2.4, ease: M.ease.out });
        });

        var tl = gsap.timeline({
          scrollTrigger: {
            trigger: hero, start: 'top top', end: 'bottom top',
            scrub: true, pin: true, pinSpacing: false
          }
        });
        tl.to(media, {
          scale: 0.86,
          borderRadius: isDesktop ? 28 : 16,
          filter: isDesktop ? 'blur(' + blurMax + 'px)' : 'blur(0px)', // blur is costly on mobile GPUs
          ease: 'none'
        }, 0)
          .to(shade, { opacity: 0.75, ease: 'none' }, 0)
          .to(content, { yPercent: -45, opacity: 0, ease: 'none', duration: 0.6 }, 0);
      });
    });
  });

  /* ------------------------------------------------------------------
   * MASKED HEADLINE / SPLIT REVEAL — lines (or words/chars) rise out of masks.
   * data-split="lines|words|chars" (default lines)
   * data-trigger="load|scroll" (default load → waits for Motion.intro)
   * data-delay="0.2"
   * ------------------------------------------------------------------ */
  M.register('masked-headline', function (M, mm) {
    if (!window.SplitText) return;
    M.qa('[data-fx="masked-headline"], [data-fx="split-reveal"]').forEach(function (el) {
      var type = el.dataset.split || 'lines';
      var onScroll = (el.dataset.trigger || (el.dataset.fx === 'split-reveal' ? 'scroll' : 'load')) === 'scroll';
      var delay = parseFloat(el.dataset.delay || (onScroll ? 0 : 0.15));
      var played = false;

      mm.add(M.MQ.motion, function () {
        var split = SplitText.create(el, {
          type: type === 'chars' ? 'words, chars' : type,
          mask: type,
          autoSplit: type === 'lines',
          onSplit: function (self) {
            gsap.set(el, { visibility: 'visible' });
            var targets = self[type];
            var vars = {
              yPercent: 115,
              rotate: type === 'chars' ? 6 : 2,
              duration: type === 'chars' ? 1 : 1.3,
              ease: M.ease.out,
              stagger: type === 'chars' ? 0.018 : type === 'words' ? 0.04 : 0.1,
              paused: true
            };
            var tw = gsap.from(targets, vars);
            if (played) { tw.progress(1); return tw; }
            if (onScroll) {
              gsap.delayedCall(0, function () {
                ScrollTrigger.create({
                  trigger: el, start: 'top 88%', once: true,
                  onEnter: function () { played = true; tw.delay(delay).play(); }
                });
              });
            } else {
              M.intro.then(function () { played = true; tw.delay(delay).play(); });
            }
            return tw;
          }
        });
        return function () { split.revert(); };
      });
    });
  });

  /* ------------------------------------------------------------------
   * EXPAND MEDIA — a small framed image/video scrubs open to full-bleed
   * while two title halves slide apart. Pinned.
   * ------------------------------------------------------------------ */
  M.register('expand-media', function (M, mm) {
    M.qa('[data-fx="expand-media"]').forEach(function (sec) {
      var frame = M.q('.fx-expand__frame', sec);
      var inner = M.q('.fx-expand__frame > *', sec);
      var left = M.q('.fx-expand__left', sec);
      var right = M.q('.fx-expand__right', sec);
      var length = sec.dataset.length || '150%';

      mm.add(M.MQ.motion, function () {
        var tl = gsap.timeline({
          scrollTrigger: { trigger: sec, start: 'top top', end: '+=' + length, pin: true, scrub: 1 }
        });
        tl.fromTo(frame,
          { clipPath: 'inset(30% 34% 30% 34% round 24px)' },
          { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none' }, 0)
          .fromTo(inner, { scale: 1.35 }, { scale: 1, ease: 'none' }, 0);
        if (left) tl.to(left, { xPercent: -120, opacity: 0, ease: 'none' }, 0);
        if (right) tl.to(right, { xPercent: 120, opacity: 0, ease: 'none' }, 0);
      });
    });
  });

  /* ------------------------------------------------------------------
   * VIDEO SCRUB — video.currentTime follows the scrollbar (Apple-style).
   * Encode with dense keyframes or it stutters:
   *   ffmpeg -i in.mp4 -vf scale=1920:-2 -c:v libx264 -g 4 -crf 23 -an -movflags +faststart out.mp4
   * ------------------------------------------------------------------ */
  M.register('video-scrub', function (M, mm) {
    M.qa('[data-fx="video-scrub"]').forEach(function (sec) {
      var video = M.q('video', sec);
      if (!video) return;
      video.muted = true; video.playsInline = true; video.pause();
      // iOS won't paint frames until the video has been "played" once by a gesture.
      document.addEventListener('touchstart', function unlock() {
        video.play().then(function () { video.pause(); }).catch(function () {});
      }, { once: true, passive: true });

      mm.add(M.MQ.motion, function () {
        var tw;
        function build() {
          tw = gsap.fromTo(video, { currentTime: 0 }, {
            currentTime: video.duration || 1, ease: 'none',
            scrollTrigger: { trigger: sec, start: 'top top', end: '+=' + (sec.dataset.length || '300%'), pin: true, scrub: 0.6 }
          });
        }
        if (video.readyState >= 1) build();
        else video.addEventListener('loadedmetadata', build, { once: true });
        return function () { if (tw) tw.kill(); };
      });
    });
  });

  /* ------------------------------------------------------------------
   * IMAGE SEQUENCE — canvas flipbook scrubbed by scroll (smoother than video).
   * <section data-fx="image-sequence" data-src="/seq/frame_####.webp" data-count="120" data-pad="4">
   * ------------------------------------------------------------------ */
  M.register('image-sequence', function (M, mm) {
    M.qa('[data-fx="image-sequence"]').forEach(function (sec) {
      var canvas = M.q('canvas', sec);
      var ctx = canvas.getContext('2d');
      var count = parseInt(sec.dataset.count, 10);
      var pattern = sec.dataset.src;
      var pad = parseInt(sec.dataset.pad || '4', 10);
      var state = { frame: 0 };
      var imgs = [];

      function url(i) {
        return pattern.replace(/#+/, String(i + 1).padStart(pad, '0'));
      }
      for (var i = 0; i < count; i++) {
        var im = new Image();
        im.decoding = 'async';
        im.src = url(i);
        imgs.push(im);
      }
      function render() {
        var img = imgs[Math.round(state.frame)];
        if (!img || !img.complete || !img.naturalWidth) return;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        var s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        var dw = img.naturalWidth * s, dh = img.naturalHeight * s;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      }
      imgs[0].addEventListener('load', render);
      window.addEventListener('resize', render);

      mm.add(M.MQ.motion, function () {
        var tw = gsap.to(state, {
          frame: count - 1, snap: 'frame', ease: 'none', onUpdate: render,
          scrollTrigger: { trigger: sec, start: 'top top', end: '+=' + (sec.dataset.length || '300%'), pin: true, scrub: 0.5 }
        });
        return function () { tw.kill(); };
      });
      mm.add('(prefers-reduced-motion: reduce)', function () {
        state.frame = Math.floor(count / 2);
        imgs[state.frame].addEventListener('load', render);
        render();
      });
    });
  });

  /* ------------------------------------------------------------------
   * MOUSE PARALLAX — layered depth that follows the pointer.
   * Children get data-depth="0.2 … 1.5" (higher = moves more = closer).
   * ------------------------------------------------------------------ */
  M.register('mouse-parallax', function (M, mm) {
    M.qa('[data-fx="mouse-parallax"]').forEach(function (scene) {
      mm.add(M.MQ.pointer, function () {
        var range = parseFloat(scene.dataset.range || 50);
        var layers = M.qa('[data-depth]', scene).map(function (el) {
          return {
            d: parseFloat(el.dataset.depth),
            x: gsap.quickTo(el, 'x', { duration: 1.4, ease: 'power3.out' }),
            y: gsap.quickTo(el, 'y', { duration: 1.4, ease: 'power3.out' })
          };
        });
        function onMove(e) {
          var r = scene.getBoundingClientRect();
          var nx = (e.clientX - r.left) / r.width - 0.5;
          var ny = (e.clientY - r.top) / r.height - 0.5;
          layers.forEach(function (l) { l.x(nx * l.d * range); l.y(ny * l.d * range * 0.7); });
        }
        function onLeave() { layers.forEach(function (l) { l.x(0); l.y(0); }); }
        scene.addEventListener('pointermove', onMove);
        scene.addEventListener('pointerleave', onLeave);
        return function () {
          scene.removeEventListener('pointermove', onMove);
          scene.removeEventListener('pointerleave', onLeave);
        };
      });
    });
  });

  /* ------------------------------------------------------------------
   * TEXT-MASK ZOOM — giant word is a window onto the image/video behind it;
   * scrolling flies the camera THROUGH a letter into the scene.
   * data-origin="50% 50%" sets which point of the word you fly through (aim at a counter/gap).
   * ------------------------------------------------------------------ */
  M.register('text-mask-zoom', function (M, mm) {
    M.qa('[data-fx="text-mask-zoom"]').forEach(function (sec) {
      var mask = M.q('.fx-tmask__mask', sec);
      var media = M.q('.fx-tmask__media', sec);
      var after = M.q('.fx-tmask__after', sec);
      mm.add(M.MQ.motion, function () {
        gsap.set(mask, { transformOrigin: sec.dataset.origin || '50% 50%' });
        var tl = gsap.timeline({
          scrollTrigger: { trigger: sec, start: 'top top', end: '+=' + (sec.dataset.length || '200%'), pin: true, scrub: 1 }
        });
        tl.to(mask, { scale: parseFloat(sec.dataset.zoom || 60), ease: 'power2.in' }, 0)
          .fromTo(media, { scale: 1.3 }, { scale: 1, ease: 'none' }, 0)
          .to(mask, { opacity: 0, duration: 0.1 }, 0.9);
        if (after) tl.from(after, { opacity: 0, y: 40, duration: 0.2 }, 0.85);
      });
    });
  });
})();

// Rouveraki: marks this file as an ES module so the bundler and TypeScript can import it.
export {};
