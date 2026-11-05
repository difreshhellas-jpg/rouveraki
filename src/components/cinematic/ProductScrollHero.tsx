"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/LanguageProvider";

/**
 * Scroll-driven product film: a wrapped gyros pita comes apart while its
 * fillings lift off and hang in the air around it.
 *
 * The frames are the same 100-frame sequence the Kyknos site uses
 * (public/hero/webp). They sit on a flat off-white ground, so this stage is
 * painted in that ground and the frames are drawn "contain" on it.
 *
 * Mechanics, in order of what goes wrong if you get them wrong:
 *  - Canvas, not <img> swapping, drawn from a rAF loop. Scroll only writes a
 *    target; drawing in the scroll handler is how scroll-jacked heroes stutter.
 *  - The displayed position chases the target with exponential smoothing, and
 *    two neighbouring frames are cross-faded by the fractional part, so even a
 *    fast flick moves like film instead of stepping between stills.
 *  - Frame 1 is requested first and painted alone; the rest stream in behind
 *    it. Scroll is never blocked: until a frame arrives the nearest loaded one
 *    is shown.
 *  - Phones load every second frame (half the decoded memory); the cross-fade
 *    hides the difference.
 *  - Sticky inside a tall wrapper rather than position: fixed, because it needs
 *    no scroll-position bookkeeping and cannot overlap the next section.
 *  - prefers-reduced-motion (or no JS): the wrapper collapses to one screen
 *    showing the unfolded composition, with all of the copy visible.
 */

const FRAMES = 100;
const POSTER_INDEX = FRAMES - 1; // "all ingredients in the air", for static fallbacks
/** The frames' own background, sampled from their corners. */
const GROUND = "#fbfbf8";

const src = (i: number) => `/hero/webp/frame-${String(i + 1).padStart(3, "0")}.webp`;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

export default function ProductScrollHero() {
  const { pick, locale } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const beatARef = useRef<HTMLDivElement>(null);
  const beatBRef = useRef<HTMLDivElement>(null);
  const beatCRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLLIElement | null)[]>([]);
  const cueRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  // Only "has frame 1 arrived" and "all loaded" re-render; the percentage is
  // written straight to the DOM so 50 arriving frames don't re-render this tree.
  const [ready, setReady] = useState(0);
  const [still, setStill] = useState(false); // reduced motion: no pin, no scrub

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(mq.matches);
    const on = () => setStill(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const small = window.innerWidth < 760;
    const stride = small ? 2 : 1;
    const blendSteps = small ? 6 : 24;
    const indices: number[] = [];
    for (let i = 0; i < FRAMES; i += stride) indices.push(i);
    if (indices[indices.length - 1] !== FRAMES - 1) indices.push(FRAMES - 1);

    const imgs = new Map<number, HTMLImageElement>();
    const idle = (fn: () => void) =>
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(fn, { timeout: 600 })
        : setTimeout(fn, 30); // Safari has no requestIdleCallback
    let loaded = 0;
    let dead = false;

    const load = (i: number) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        const done = () => {
          imgs.set(i, img);
          loaded++;
          const r = loaded / indices.length;
          if (loaderRef.current) loaderRef.current.textContent = String(Math.round(r * 100));
          if (loaded === 1 || r === 1) setReady(r);
          resolve();
        };
        img.onerror = () => resolve();
        // Decode before the frame can be drawn (drawing an undecoded image
        // decodes it synchronously: the scroll stutter), but one at a time
        // when the phone is idle, never all at once during page load.
        img.onload = () =>
          idle(() => img.decode().then(done, () => (img.naturalWidth ? done() : resolve())));
        img.src = src(i);
      });

    // Frame 1 first, the poster frame second, then the rest in coarse-to-fine
    // order so a fast scroller always has something close by.
    const order = [...indices];
    const first = order.shift()!;
    const coarse = order.filter((_, k) => k % 6 === 0);
    const rest = order.filter((_, k) => k % 6 !== 0);
    // Nothing downloads until the visitor is about a screen away: on a slow
    // connection 50 frames competing with the first screen cost seconds.
    const start = async () => {
      await load(first);
      if (dead) return;
      draw(0);
      const queue = [...coarse, ...rest];
      const workers = Array.from({ length: small ? 2 : 6 }, async () => {
        while (!dead && queue.length) await load(queue.shift()!);
      });
      await Promise.all(workers);
    };
    const near = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          near.disconnect();
          void start();
        }
      },
      { rootMargin: "100% 0px" },
    );
    near.observe(wrap);

    // ---- canvas sizing --------------------------------------------------
    let cw = 0;
    let ch = 0;
    const size = () => {
      // Phones: 1.5x is visually the same on this soft, blurred-edge render and
      // pushes ~45% fewer pixels per frame than 2x.
      const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      const r = canvas.getBoundingClientRect();
      cw = Math.max(1, Math.round(r.width * dpr));
      ch = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
    };

    // Nearest loaded frame at or around a float position.
    const nearest = (pos: number, dir: 1 | -1) => {
      const base = Math.round(pos);
      for (let d = 0; d < FRAMES; d++) {
        const a = imgs.get(base + dir * d);
        if (a) return { img: a, idx: base + dir * d };
        const b = imgs.get(base - dir * d);
        if (b) return { img: b, idx: base - dir * d };
      }
      return null;
    };

    // Composition moves with the copy, not just the camera: on wide screens
    // the product sits right while the headline is on the left, steps left
    // when the ingredient list takes the right side, and re-centres for the
    // call to action. On phones it eases back a touch as the pieces spread, so
    // nothing leaves the screen. Frames are transparent, so shifting is free.
    const portrait = window.innerHeight > window.innerWidth * 1.05;
    const wide = !portrait && window.innerWidth >= 900;
    let zoom = 1;
    let dx = 0;
    let dy = 0;
    const compose = (p: number) => {
      if (wide) {
        dx = 0.16 * (1 - seg(p, 0.3, 0.46)) - 0.09 * seg(p, 0.46, 0.56) * (1 - seg(p, 0.82, 0.94));
        dy = 0.045 * seg(p, 0.38, 0.55);
        zoom = 1 - 0.05 * seg(p, 0.38, 0.55);
      } else {
        dx = 0;
        dy = 0;
        zoom = 1 - 0.09 * seg(p, 0.32, 0.55);
      }
    };

    const paint = (img: HTMLImageElement, alpha: number) => {
      // Wide: fit the whole frame (a little under, for air). Phone: size by
      // height and park the subject in the top of the stage, copy below it;
      // the frame runs wider than the screen and only its blank margin crops.
      const s = wide
        ? Math.min(cw / img.naturalWidth, ch / img.naturalHeight) * 0.84 * zoom
        : ((ch * 0.46) / img.naturalHeight) * zoom;
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      const cy = wide ? 0.58 : 0.35;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, (cw - w) / 2 + dx * cw, ch * cy - h / 2 + dy * ch, w, h);
    };

    let lastKey = "";
    function draw(p: number) {
      const pos = p * (FRAMES - 1);
      const lo = Math.floor(pos / stride) * stride;
      const hi = Math.min(lo + stride, FRAMES - 1);
      const f = hi === lo ? 0 : (pos - lo) / (hi - lo);
      const A = nearest(lo, 1);
      const B = nearest(hi, -1);
      if (!A) return;
      compose(p);
      // Phones blend in 6 steps between frames instead of 24: same look at
      // this motion blur, a quarter of the redraws.
      const key = `${A.idx}|${B?.idx}|${Math.round(f * blendSteps)}|${cw}x${ch}|${Math.round(dx * 400)}|${Math.round(dy * 400)}|${Math.round(zoom * 400)}`;
      if (key === lastKey) return; // same pixels as last time
      lastKey = key;
      ctx!.fillStyle = GROUND;
      ctx!.fillRect(0, 0, cw, ch);
      paint(A.img, 1);
      if (B && B.idx !== A.idx && f > 0.02) paint(B.img, f);
      ctx!.globalAlpha = 1;
    }

    // ---- copy beats, driven by the same smoothed progress ----------------
    const setBeat = (el: HTMLElement | null, inA: number, inB: number, outA: number, outB: number, p: number) => {
      if (!el) return;
      const vis = Math.min(seg(p, inA, inB), 1 - seg(p, outA, outB));
      el.style.opacity = String(vis);
      el.style.transform = `translate3d(0, ${(1 - seg(p, inA, inB)) * 28 - seg(p, outA, outB) * 22}px, 0)`;
      el.style.visibility = vis > 0.01 ? "visible" : "hidden";
    };
    const beats = (p: number) => {
      setBeat(beatARef.current, 0.0, 0.04, 0.26, 0.36, p);
      const b = beatBRef.current;
      if (b) {
        const vis = Math.min(seg(p, 0.42, 0.5), 1 - seg(p, 0.86, 0.93));
        b.style.opacity = String(vis);
        b.style.visibility = vis > 0.01 ? "visible" : "hidden";
      }
      chipRefs.current.forEach((chip, i) => {
        if (!chip) return;
        const t = seg(p, 0.46 + i * 0.045, 0.54 + i * 0.045);
        chip.style.opacity = String(t);
        chip.style.transform = `translate3d(0, ${(1 - t) * 16}px, 0)`;
      });
      setBeat(beatCRef.current, 0.84, 0.93, 1.1, 1.2, p);
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
      if (cueRef.current) cueRef.current.style.opacity = String(1 - seg(p, 0.0, 0.05));
    };

    // ---- scroll -> target, rAF -> smoothed draw --------------------------
    let target = 0;
    let shown = 0;
    let raf = 0;
    let running = false;

    const readScroll = () => {
      const r = wrap.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      target = total > 0 ? clamp01(-r.top / total) : 0;
      kick();
    };
    const tick = () => {
      const diff = target - shown;
      shown = Math.abs(diff) < 0.0004 ? target : shown + diff * 0.16;
      draw(shown);
      beats(shown);
      if (shown !== target) raf = requestAnimationFrame(tick);
      else running = false;
    };
    function kick() {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    }

    const onResize = () => {
      size();
      lastKey = "";
      readScroll();
    };
    size();
    readScroll();
    shown = target;
    beats(shown);
    window.addEventListener("scroll", readScroll, { passive: true });
    window.addEventListener("resize", onResize);
    // Frames keep arriving after mount: redraw when the current one lands.
    const poll = window.setInterval(() => {
      lastKey = "";
      draw(shown);
      if (imgs.size >= indices.length) window.clearInterval(poll);
    }, 400);

    return () => {
      dead = true;
      near.disconnect();
      cancelAnimationFrame(raf);
      window.clearInterval(poll);
      window.removeEventListener("scroll", readScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const chips = [
    pick("Γύρος χοιρινός", "Pork gyros"),
    pick("Τζατζίκι", "Tzatziki"),
    pick("Ντομάτα", "Tomato"),
    pick("Κρεμμύδι", "Onion"),
    pick("Πατάτες", "Fries"),
  ];

  return (
    <section
      aria-label={pick("Η πίτα γύρο του Ρουβεράκι", "The Rouveraki gyros pita")}
      className="relative text-[#1c1917]"
      style={{ background: GROUND }}
    >
      <div
        ref={wrapRef}
        className="psh-wrap relative"
        style={{ height: still ? "auto" : "440svh" }}
        data-still={still ? "" : undefined}
      >
        <div className="psh-stage sticky top-0 h-[100svh] w-full overflow-hidden">
          <div className="psh-media absolute inset-0">
          {/* static fallback = the same renders, no script needed */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src(still ? POSTER_INDEX : 0)}
            alt={pick(
              "Πίτα γύρο με πατάτες, τζατζίκι, ντομάτα και κρεμμύδι",
              "Gyros pita with fries, tzatziki, tomato and onion",
            )}
            className="absolute inset-0 h-full w-full object-contain"
            style={{ opacity: still || ready < 0.02 ? 1 : 0, background: GROUND }}
          />
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
            style={{ display: still ? "none" : "block" }}
          />

          {/* vignette so copy always has a floor */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(251,251,248,0.9) 0%, transparent 18%, transparent 62%, rgba(251,251,248,0.92) 100%)",
            }}
          />
          </div>

          {/* ---- beat A: closed, turning ------------------------------- */}
          <div
            ref={beatARef}
            className="psh-beat absolute inset-x-0 bottom-0 px-5 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] sm:px-10 md:bottom-auto md:top-1/2 md:max-w-xl md:-translate-y-1/2 md:pb-0 lg:left-[6vw]"
          >
            <p className="eyebrow !text-[#8a5a12]">{pick("Πίτα γύρο", "Gyros pita")}</p>
            <h2 className="mt-3 font-display text-[clamp(2.1rem,6.4vw,4.4rem)] font-semibold leading-[1.02] tracking-[-0.025em]">
              {pick("Ό,τι αγαπάς, τυλιγμένο.", "Everything you love, wrapped.")}
            </h2>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-black/70 sm:text-lg">
              {pick(
                "Ζεστή πίτα, γύρος στα κάρβουνα, φρέσκα υλικά. Δες τη να ανοίγει.",
                "Warm pita, charcoal gyros, fresh fillings. Scroll to watch it open.",
              )}
            </p>
          </div>

          {/* ---- beat B: the fillings ---------------------------------- */}
          <div
            ref={beatBRef}
            className="psh-beat absolute inset-x-0 bottom-0 px-5 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] sm:px-10 md:bottom-auto md:left-auto md:right-[5vw] md:top-1/2 md:w-[22rem] md:-translate-y-1/2 md:pb-0"
            style={{ opacity: 0, visibility: "hidden" }}
          >
            <p className="eyebrow !text-[#8a5a12]">{pick("Τίποτα παραπάνω", "Nothing extra")}</p>
            <h2 className="mt-3 font-display text-[clamp(1.8rem,5vw,3rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
              {pick("Πέντε υλικά. Όλα στη θέση τους.", "Five fillings. Each in its place.")}
            </h2>
            <ul className="mt-5 flex flex-wrap gap-2 md:flex-col md:items-start">
              {chips.map((c, i) => (
                <li
                  key={c}
                  ref={(el) => {
                    chipRefs.current[i] = el;
                  }}
                  className="rounded-full border border-black/15 bg-black/[0.04] px-4 py-2 text-sm font-medium text-black/80"
                  style={{ opacity: still ? 1 : 0 }}
                >
                  {c}
                </li>
              ))}
            </ul>
          </div>

          {/* ---- beat C: the order ------------------------------------- */}
          <div
            ref={beatCRef}
            className="psh-beat absolute inset-x-0 bottom-0 px-5 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] text-center sm:px-10"
            style={{ opacity: 0, visibility: "hidden" }}
          >
            <h2 className="mx-auto max-w-2xl font-display text-[clamp(2rem,6vw,3.8rem)] font-semibold leading-[1.04] tracking-[-0.025em]">
              {pick("Φτιάχνεται εκείνη τη στιγμή.", "Made the moment you order.")}
            </h2>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/menu#pites" className="btn-primary btn-lift group px-8 text-base">
                {pick("Παράγγειλε πίτα", "Order a pita")}
                <ArrowRight
                  size={18}
                  weight="bold"
                  className="transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:group-hover:translate-x-1"
                />
              </Link>
              <Link href="/menu" className="btn-secondary px-7 text-base">
                {pick("Δες το μενού", "See the menu")}
              </Link>
            </div>
          </div>

          {/* ---- chrome ------------------------------------------------- */}
          <div ref={cueRef} className="pointer-events-none absolute left-1/2 top-[5.5rem] -translate-x-1/2 text-center">
            <p className="eyebrow !text-black/50">{pick("Κύλισε", "Scroll")}</p>
          </div>
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-black/10">
            <span
              ref={barRef}
              className="block h-full origin-left bg-[#8a5a12]"
              style={{ transform: "scaleX(0)" }}
            />
          </div>
          {!still && ready < 1 && (
            <div aria-hidden="true" className="absolute right-4 top-24 text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45">
              {locale === "en" ? "Loading" : "Φόρτωση"} <span ref={loaderRef}>{Math.round(ready * 100)}</span>%
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
