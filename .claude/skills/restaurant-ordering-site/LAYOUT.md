# Exact layout, photography and effects

SKILL.md is the workflow. This file is the **finished specification**: the
section order, the photo assignments, the animation parameters and the category
table exactly as they ship in the reference build. Reproduce these verbatim and
the new site looks like Rouveraki with different words in it. Every number here
was read out of the shipped code, not remembered.

Reference: `C:\Users\maggi\rouveraki`.

---

## 1. Page composition

### Homepage (`src/app/page.tsx`)

Sections in this order. The order matters: it alternates dark full-bleed
photography against calm content, and the two pinned sections are separated by
a marquee and a card strip so the reader is never pinned twice in a row.

| # | Section | Component | Background | Full bleed |
| --- | --- | --- | --- | --- |
| 1 | Hero | `Hero` | photo crossfade | yes |
| 2 | Marquee | `motion/Marquee` | band | yes |
| 3 | Day-part strip | `DaypartStrip` | paper | no, `max-w-content` |
| 4 | Pinned horizontal story | `cinematic/HorizontalStory` | band | yes |
| 5 | Scroll-break wipe | `cinematic/ScrollBreak` | photo | yes |
| 6 | Interactive menu preview | `cinematic/MenuShowcase` | paper | no, `max-w-content` |
| 7 | Story | `StorySection` | surface | no |
| 8 | Location + map | `LocationSection` | paper | no |
| — | Cursor trail | `cinematic/CursorTrail` | fixed overlay `z-[45]` | n/a |

`Header` and `Footer` come from the root layout, not from the page. `Intro`
plays once per tab session over everything.

### Hero internals, back to front

The z-order is load-bearing. Getting it wrong is what made the first hero read
as a flat black rectangle.

1. `.cine-stack` at `-z-20`: the photo layers, one absolutely-positioned div
   per slide, crossfaded by a generated keyframe.
2. Legibility scrim at `-z-10`: `linear-gradient(to top, rgba(0,0,0,0.92) 0%,
   rgba(0,0,0,0.78) 26%, rgba(0,0,0,0.42) 52%, rgba(0,0,0,0.18) 100%)`.
   Weighted to the bottom, where the copy sits.
3. `.cine-veil` at `-z-10`: plain `bg-black/55`, opacity animated. **Never a
   `backdrop-filter`** — see TRAPS.md.
4. `WireGlobe` at `-z-10`, `opacity-40`: the rotating wireframe.
5. Warm radial at `-z-10`, `mix-blend-soft-light`:
   `radial-gradient(120% 90% at 20% 100%, rgb(var(--accent-rgb) / 0.55), transparent 60%)`.
6. `ScrollCue`.
7. `.cine-copy`: eyebrow, wordmark, gold rule, subhead, two CTAs.

The section itself is `relative isolate flex min-h-[100svh] items-end
overflow-hidden [contain:paint]`. Copy sits at the bottom, not centred.

Copy entrance delays, in order: status pill 150ms, wordmark 260ms (then 55ms
per word), gold rule 620ms, subhead 900ms, CTAs 1040ms.

### Menu page (`/menu`)

Sticky category pill rail under the header, then one section per category with
`id={slug}` so `MenuShowcase` can deep-link into it. Items are a responsive
grid of `ItemThumb` cards, each one a `.tilt` card with `.img-zoom` on the
photo. Tapping opens `ItemSheet` (Vaul) for quantity and per-item notes.
`CartBar` floats above everything on `z-40`.

### Remaining routes

`/checkout` (fulfilment, contact, zone, payment), `/order/[code]` (tracking,
no personal data in the payload), `/admin/orders`, `/admin/kitchen`,
`/admin/menu`, five `/legal/*` pages.

**Admin gets no motion at all.** No reveals, no tilt, no trail. Staff use it
forty times an hour.

---

## 2. Categories

Twelve, in this order. `slug` is the anchor id and the database key; `daypart`
drives the three homepage cards. Reproduce the shape, swap the words.

| # | slug | Greek | English | daypart |
| --- | --- | --- | --- | --- |
| 1 | `pites` | Πίτες | Pites | grill |
| 2 | `souvlakia` | Σουβλάκια | Souvlaki | grill |
| 3 | `gyros` | Γύρος | Gyros | grill |
| 4 | `kalamakia` | Καλαμάκια | Kalamaki | grill |
| 5 | `zymarika` | Ζυμαρικά | Pasta | grill |
| 6 | `orektika` | Ορεκτικά | Starters | grill |
| 7 | `salates` | Σαλάτες | Salads | grill |
| 8 | `kafedes` | Καφέδες | Coffee | morning |
| 9 | `rofimata` | Ροφήματα | Hot drinks | morning |
| 10 | `chymoi` | Χυμοί | Juices | morning |
| 11 | `anapsyktika` | Αναψυκτικά | Soft drinks | evening |
| 12 | `pota` | Ποτά | Drinks | evening |

`AGE_GATED_CATEGORIES = ["pota"]`, enforced server-side in the order route, not
only in the seed. Day-part cards: morning uses `CupIcon`, grill `FlameIcon`,
evening `GlassIcon`, all from `@phosphor-icons/react`.

Hours: shop 06:00–01:00, delivery 08:00–00:00. Both wrap midnight.

---

## 3. Photography

`source.unsplash.com` is retired and returns 503. These are direct CDN ids,
each one opened and checked against its subject before assignment.

```ts
const CDN = "https://images.unsplash.com";
export const photo = (id: string, w = 800, h = 800): string =>
  `${CDN}/${id}?w=${w}&h=${h}&fit=crop&auto=format&q=70`;
```

One id serves every size; width and height are appended per use site.

| Key | Unsplash id | Subject |
| --- | --- | --- |
| `gyrosPita` | `photo-1529006557810-274b9b2fc783` | gyros in pita with fries |
| `mezeSpread` | `photo-1600891964599-f61ba0e24092` | wings, dip, sharing plates |
| `pasta` | `photo-1621996346565-e3dbc646d9a9` | penne in tomato sauce |
| `salad` | `photo-1546069901-ba9599a7e63c` | mixed salad bowl |
| `coffee` | `photo-1495474472287-4d71bcdd2085` | three coffees, overhead |
| `barInterior` | `photo-1514933651103-005eec06c04b` | lit bar counter at night |
| `cocktails` | `photo-1544145945-f90425340c7e` | three cocktails |
| `spirit` | `photo-1470337458703-46ad1756a187` | spirit poured over ice |
| `wine` | `photo-1510812431401-41d2bd2722f3` | red wine glasses, toasting |
| `bread` | `photo-1509440159596-0249088772ff` | rustic loaves |
| `patty` | `photo-1521305916504-4a1121188589` | grilled patty in a bun |

### Where each one is used

| Use site | Photo | Size requested |
| --- | --- | --- |
| Hero slide 1 | `gyrosPita` | 2000x1400 |
| Hero slide 2 | `mezeSpread` | 2000x1400 |
| Hero slide 3 | `coffee` | 2000x1400 |
| Day-part: morning | `coffee` | card |
| Day-part: grill | `gyrosPita` | card |
| Day-part: evening | `cocktails` | card |
| Horizontal panel 1 "Στα κάρβουνα" | `gyrosPita` | 1600x1200 |
| Horizontal panel 2 "Για μοίρασμα" | `mezeSpread` | 1600x1200 |
| Horizontal panel 3 "Από τις έξι" | `coffee` | 1600x1200 |
| Horizontal panel 4 "Μέχρι τη μία" | `barInterior` | 1600x1200 |
| Scroll-break | `patty` | 1800x1100 |
| Story section (parallax) | `barInterior` | 1200x900 |
| Menu preview | per category, below | 900x1100 |

**The bar interior is deliberately not a hero slide.** Under the hero's
legibility scrim it read as a solid black frame. The middle slide is a bright
food shot instead.

### Category defaults

```
pites, souvlakia, gyros, kalamakia -> gyrosPita
zymarika -> pasta          orektika -> mezeSpread     salates -> salad
kafedes, rofimata -> coffee
chymoi, anapsyktika -> cocktails   (TODO:OWNER, these two borrow)
pota -> spirit
```

Per-item keyword overrides, matched on the Greek name, so a wine row never
shows a whisky glass: `κρασί`→wine, `cocktail|spritz`→cocktails,
`μπιφτέκι`→patty, `ψωμ|σκόρδου`→bread, `μπύρα`→barInterior.

Every menu item also carries its own `image` column. Category defaults only
fill in items that have none, so swapping in the owner's real photography later
is a data change from `/admin/menu`, not a code change.

Each slide has a CSS gradient behind it for the moment before it decodes:
`#3a1d10→#8d3d1f→#c2703f`, `#0c2231→#123449→#3c6c85`, `#5a3211→#a8631f→#d9a45c`.

---

## 4. Effect inventory

Two rules govern all of it.

**Everything is CSS.** No animation library. Motion was removed after its
`x`/`y`/`scale` props turned out not to be hardware-accelerated, and the site's
own CSP (`script-src 'self'`) would block a CDN script anyway. This is also why
the bundle survived: the whole cinematic pass cost 3 kB.

**Every scroll effect sits inside `@supports (animation-timeline: view())`,**
so a browser without timelines renders a normal readable block rather than an
empty scroll void.

### Easing tokens

```css
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

### Interaction effects

| Effect | Class | Parameters |
| --- | --- | --- |
| Button press | `.btn` | `transform 160ms var(--ease-out)`, `:active scale(0.97)` |
| Button lift | `.btn-lift` | `translateY(-3px)` + `--shadow-lift`, 250ms, hover-gated |
| Ripple | `.ripple-host` / `.ripple` | `scale(0)→scale(2.6)`, opacity `0.28→0`, 620ms; diameter `Math.hypot(w,h)*2`, removed on `animationend` |
| 3D tilt | `.tilt` | `perspective(900px)` + `rotateX/rotateY` from `--rx`/`--ry`, 320ms |
| Tilt glint | `.tilt-glint` | `radial-gradient(420px circle at var(--gx) var(--gy), rgb(255 255 255 / 0.18), transparent 60%)` |
| Image zoom | `.img-zoom img` | `transform 600ms var(--ease-out)`; promote to a layer on `:hover` only |
| Magnetic | `Magnetic.tsx` | eased falloff `sign(v) * (1 - (1-|v|)²)`, mouse only |

**The tilt works on phones.** On a fine pointer it follows the cursor; on
touch, `Tilt.tsx` sets `data-tilt-scroll` and the same 3D rotation is driven by
the card's own travel through the viewport (`animation-range: entry 10% exit
90%`). Not a reduced substitute, the same effect from a different input.

### Entrance effects

| Effect | Class | Parameters |
| --- | --- | --- |
| Word stagger | `.stagger-word` | `translateY(0.5em) rotate(1.5deg)` → 0, 760ms, `--d` per word, 55ms step (38ms for the per-character variant). Server-rendered spans; `aria-label` on parent, `aria-hidden` on spans |
| Block fade-up | `.fade-up` | `translateY(14px)` → 0, 700ms, `--d`. Separate from `.stagger-word` because that one forces `inline-block` and collapses a paragraph onto one line |
| Scroll reveal | `.reveal` | `opacity 0→1`, `translateY(28px)→0`, `animation-range: entry 0% entry 38%` |
| Intro | `Intro.tsx` | 2s, three keyframes (veil, mark, rule), `pointer-events: none`, unmounts, once per tab session |

`.reveal` is a scroll-driven animation, **not** an IntersectionObserver. With
an observer, content that never triggers stays stranded at opacity 0 — that is
what made the whole page below the hero invisible. Here, if the timeline is
unsupported the rule never applies and content is simply visible.

### Ambient effects

| Effect | Parameters |
| --- | --- |
| Hero crossfade | one generated keyframe per layer, `HOLD = 6s`, `FADE = 1.2s`, `animationDelay: -(count - i) * HOLD` |
| Ken Burns | `hero-drift`, linear, well below the strobing threshold |
| Marquee | `.marquee__inner` 32s linear infinite, `translateX(-50%)`, **track duplicated**, edge mask `transparent → black 8% → black 92% → transparent`, pauses on hover |
| Scroll cue | 1px × 56px line, `::after` highlight travelling `-100% → 250%` over 2s, no "Scroll" label |
| Wireframe globe | canvas 2D icosahedron, ~2 kB, `t += 0.0016`/frame, pauses on IntersectionObserver + `visibilitychange` |
| Cursor trail | `MAX_POINTS = 26`, `DECAY = 0.045`, loop stops when empty, `z-[45]`, `(hover: hover) and (pointer: fine)` only |

The globe is hand-rolled because Three.js is roughly 150 kB gzipped to draw
thirty lines on a site whose entire first-load budget is 150 kB.

### The six cinematic scroll sections

| # | Effect | Subject / timeline | Range | Keyframe |
| --- | --- | --- | --- | --- |
| 1 | Hero pull-back | `view()` on `.cine-stack` | `exit 0%` → `exit 100%` | `scale(1.14) blur(0)` → `scale(1) blur(9px)` |
| 1b | Hero veil | `view()` on `.cine-veil` | `exit 0%` → `exit 100%` | opacity 0 → 1 |
| 1c | Hero copy | `view()` on `.cine-copy` | `exit 0%` → `exit 70%` | opacity 1 → 0, `translateY(0 → -64px)` |
| 2 | Horizontal pan | named `--hstory` on `.hstory-outer` | `contain 0%` → `contain 100%` | `translate3d(0,0,0)` → `translate3d(calc(-100% + 100vw),0,0)` |
| 3 | Scroll-break wipe | named `--wipe` on `.wipe-outer` | `contain 0%` → `contain 100%` | `clip-path: inset(0 0 0 0)` → `inset(0 0 100% 0)` |
| 4 | Wireframe globe | rAF canvas, not a timeline | — | — |
| 5 | Cursor trail | rAF canvas, not a timeline | — | — |
| 6 | Menu preview swap | React state + CSS transitions | — | opacity 320ms, transform 700ms |
| — | Parallax (story photo) | `view()` on `.parallax-media` | `cover 0%` → `cover 100%` | `translate3d(0,-8%,0) scale(1.18)` → `translate3d(0,8%,0) scale(1.18)` |

Three details that are not optional, each one a bug that cost real time:

- **Sections 2 and 3 must use a named timeline declared on the tall outer
  element.** An anonymous `view()` on an element exactly one viewport tall is
  degenerate: its `contain` phase is a single point, and the animation never
  leaves frame one.
- **Both need `view-timeline-inset: 0`.** `auto` inherits the scroller's
  `scroll-padding`, and `html` carries `scroll-padding-top: 136px` so anchor
  links clear the fixed header. Inherited, it starts the pan 336px early and
  clips the first panel.
- **The pan track must not be a flex item.** As a child of a `flex` rail its
  `width: 400%` is shrunk straight back to one viewport by default
  `flex-shrink`. Keep the rail a plain block; drive geometry from a `--panels`
  custom property set inline so the count and the width cannot disagree.

### Geometry

```css
.hstory-outer { height: <panels * 100>svh; --panels: <count>; }
.hstory-rail  { position: sticky; top: 0; height: 100svh; overflow: hidden; }
.hstory-track { display: flex; height: 100%; width: calc(var(--panels) * 100%); }
.hstory-panel { flex: 0 0 calc(100% / var(--panels)); }
.wipe-outer   { height: 160svh; }
.wipe-panel   { position: sticky; top: 0; height: 100svh; }
```

### The four horizontal panels

| # | Greek | English | Photo |
| --- | --- | --- | --- |
| 01 | Στα κάρβουνα / Γύρος, καλαμάκια και πίτες, ψημένα τη στιγμή που τα ζητάς. | Over charcoal | `gyrosPita` |
| 02 | Για μοίρασμα / Ορεκτικά και πιάτα που μπαίνουν στη μέση του τραπεζιού. | To share | `mezeSpread` |
| 03 | Από τις έξι / Ο πρώτος καφές της ημέρας, πριν ξυπνήσει η μαρίνα. | From six | `coffee` |
| 04 | Μέχρι τη μία / Ένα ποτό όταν ησυχάσουν τα σκάφη. | Until one | `barInterior` |

Each panel: full-bleed photo, `bg-gradient-to-t from-black/85 via-black/35
to-black/10`, counter eyebrow `01 / 04`, display headline at
`clamp(2rem, 6vw, 4rem)`, one line of body.

### The scroll-break

Full-bleed `patty` photo, a **weighted** scrim
`linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 45%,
rgba(0,0,0,0.38) 100%)`, a warm radial in `soft-light`, the eyebrow
"Ρουβεράκι" and one display line: **"Στα κάρβουνα, με την ώρα τους."** /
"Over charcoal, in their own time."

It must carry a photograph. The first version wiped band `#050403` away to
reveal paper `#0c0a09` with a 12px half-opacity label: it animated perfectly
and was completely invisible. An effect that works and cannot be seen is worse
than no effect, because it still costs scroll distance. A flat `bg-black/65`
over a dark shot has the same failure mode — it rendered as pure black.

### The menu preview

Two columns at `lg`, `[1.15fr_1fr]`. Left: twelve rows, each a `Link` to
`/menu#<slug>`, hairline between. Right: a sticky `aspect-[4/5]` card at
`top-28`.

Row active state, all three at once: colour to accent, `padding-left: 1.25rem`
over 420ms, and a 32px hairline (`h-px w-8`, hidden below `sm`) drawn in with
`scaleX(0 → 1)` from the left over 420ms. Arrow fades in at 300ms.

**All twelve preview images are rendered and stacked**, switching on opacity,
so a swap never waits on a network request mid-interaction.

Hover, focus and touch all set the same state. A hover-preview gallery is a
lovely way to browse and a poor way to order, which is why every row is a real
link into `/menu` rather than a filter.

---

## 5. Mobile and reduced motion

The standing rule: **build the effect itself on phones, never a desktop-only
version with a reduced mobile substitute.**

| Effect | On a phone |
| --- | --- |
| Horizontal pan | real swipeable `scroll-snap-type: x mandatory` carousel, panels `flex: 0 0 86%`, `scroll-snap-align: center`, scrollbar hidden. The rail scrolls, so the track is `width: auto` |
| Scroll-break wipe | unchanged — it is vertical and hijacks nothing |
| Hero pull-back | unchanged |
| Card tilt | unchanged effect, driven by scroll instead of cursor |
| Cursor trail | absent. A phone has no cursor and there is nothing to substitute |
| Magnetic buttons | absent, same reason |

Pinning the viewport and hijacking vertical scroll is genuinely hostile on
touch. The sideways gesture is not, so the panels stay and the gesture changes.

`prefers-reduced-motion: reduce` must degrade **every** effect to a static,
fully readable page. Verified state: the pan collapses to a static swipeable
rail with `animation: none` and `transform: none`; the wipe becomes a static
24svh band with `clip-path: none`; `.reveal` is forced to `opacity: 1`; hero
slides stop and all but the first are hidden; the intro is `display: none`;
hover lifts and zooms are cancelled.

---

## 6. Adapting this to another restaurant

Change these and nothing else:

1. `src/lib/brand.ts` — name, address, phone, hours, the twelve categories,
   delivery zones, rejection reasons.
2. `src/lib/images.ts` — the photo ids and the category map. Open every
   candidate and look at it before assigning it.
3. The four horizontal panel headlines and the scroll-break line. These are the
   only places with real editorial voice; generic copy here is exactly what
   makes a site read as templated.
4. The day-part card copy and icons.
5. Tokens in `globals.css`, from the design-system generator, never guessed.

Do not change the effect parameters, the z-order of the hero, the timeline
names or the ranges. They are the part that took the longest to get right.

**Checks that must pass after adapting:** `npx tsc --noEmit`, `npm run verify`
(47), `npm run verify:api` (23, needs `tsx --conditions react-server` and a
server started with `TEST_CLOCK` pinned to mid-service), `npm run contrast`,
`npx eslint .`, and a build with `NEXT_DIST_DIR=.next-verify` so it does not
overwrite the `.next` the dev server is reading from. Every customer route
under 150 kB; the reference homepage is 142 kB.
