/*!
 * three-hero.js — WebGL hero layers for luxury-web-animations (ES module)
 * Load AFTER motion-core.js:
 *   <script type="module" src="/js/three-hero.js"></script>
 * Effects: wire-3d (line-art object reacting to mouse + scroll) · particle-wave (shader point field)
 * Both: pause off-screen, cap DPR, share GSAP's ticker (synced with Lenis), dispose on teardown.
 */
// Rouveraki: bundled from npm. The site CSP (script-src 'self') blocks CDN modules.
import * as THREE from 'three';

const M = window.Motion;

function makeStage(host, canvas, fov = 40, z = 10) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.z = z;

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
  io.observe(host);

  return {
    renderer, scene, camera,
    isVisible: () => visible && !document.hidden,
    destroy() {
      ro.disconnect(); io.disconnect();
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) [].concat(o.material).forEach(m => m.dispose());
      });
      renderer.dispose();
    }
  };
}

function pointerTracker(host) {
  const p = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = e => {
    const r = host.getBoundingClientRect();
    p.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    p.ty = -(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  p.destroy = () => window.removeEventListener('pointermove', onMove);
  return p;
}

/* ------------------------------------------------------------------
 * WIRE-3D — faceted line-art object + orbit rings + vertex points.
 * <section data-fx="wire-3d" data-color="#c9a36b" data-shape="ico|torus|knot">
 *   <canvas class="fx-webgl"></canvas> …content…
 * </section>
 * ------------------------------------------------------------------ */
M.register('wire-3d', (M, mm) => {
  M.qa('[data-fx="wire-3d"]').forEach(host => {
    mm.add(M.MQ.motion, () => {
      const canvas = M.q('canvas', host);
      const stage = makeStage(host, canvas);
      const { scene, camera, renderer } = stage;
      const color = new THREE.Color(host.dataset.color || '#ffffff');
      const group = new THREE.Group();
      scene.add(group);

      const shape = host.dataset.shape || 'ico';
      const base = shape === 'torus' ? new THREE.TorusGeometry(2.2, 0.8, 18, 60)
        : shape === 'knot' ? new THREE.TorusKnotGeometry(1.8, 0.5, 140, 14, 2, 3)
        : new THREE.IcosahedronGeometry(2.6, 2);

      const lines = new THREE.LineSegments(
        new THREE.EdgesGeometry(base, 1),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 })
      );
      const dots = new THREE.Points(base, new THREE.PointsMaterial({ color, size: 0.045, transparent: true, opacity: 0.9 }));
      group.add(lines, dots);

      // Orbit rings
      const ringMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.22 });
      [3.6, 4.3, 5.1].forEach((r, i) => {
        const pts = [];
        for (let a = 0; a <= 128; a++) {
          const t = (a / 128) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, 0));
        }
        const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), ringMat);
        ring.rotation.x = Math.PI / 2 + i * 0.35;
        ring.rotation.y = i * 0.5;
        ring.userData.spin = 0.0015 * (i % 2 ? -1 : 1) * (1 + i * 0.4);
        group.add(ring);
      });

      const ptr = pointerTracker(host);
      const scroll = { p: 0 };
      const st = ScrollTrigger.create({
        trigger: host, start: 'top top', end: 'bottom top', scrub: true,
        onUpdate: s => { scroll.p = s.progress; }
      });

      // Entrance
      group.scale.setScalar(0.001);
      M.intro.then(() => gsap.to(group.scale, { x: 1, y: 1, z: 1, duration: 2.2, ease: M.ease.out }));

      const tick = (time) => {
        if (!stage.isVisible()) return;
        ptr.x = M.lerp(ptr.x, ptr.tx, 0.05);
        ptr.y = M.lerp(ptr.y, ptr.ty, 0.05);
        group.rotation.y = time * 0.12 + ptr.x * 0.6 + scroll.p * Math.PI;
        group.rotation.x = ptr.y * 0.4 + scroll.p * 0.8;
        group.position.y = scroll.p * 2.5;
        group.children.forEach(c => { if (c.userData.spin) c.rotation.z += c.userData.spin; });
        camera.position.z = 10 - scroll.p * 3;
        renderer.render(scene, camera);
      };
      gsap.ticker.add(tick);

      return () => {
        gsap.ticker.remove(tick);
        st.kill(); ptr.destroy(); stage.destroy();
      };
    });
  });
});

/* ------------------------------------------------------------------
 * PARTICLE-WAVE — a field of points undulating like the sea; the pointer
 * sends a soft ripple through it. Great behind marina/coastal/tech heroes.
 * <section data-fx="particle-wave" data-color="#f2ece2"><canvas class="fx-webgl"></canvas>…</section>
 * ------------------------------------------------------------------ */
M.register('particle-wave', (M, mm) => {
  M.qa('[data-fx="particle-wave"]').forEach(host => {
    mm.add(M.MQ.motion, () => {
      const canvas = M.q('canvas', host);
      const stage = makeStage(host, canvas, 50, 9);
      const { scene, camera, renderer } = stage;
      camera.position.set(0, 3.2, 9);
      camera.lookAt(0, 0, 0);

      const isSmall = window.innerWidth < 768;
      const cols = isSmall ? 90 : 160, rows = isSmall ? 50 : 80, gap = 0.18;
      const positions = new Float32Array(cols * rows * 3);
      let i = 0;
      for (let x = 0; x < cols; x++) {
        for (let z = 0; z < rows; z++) {
          positions[i++] = (x - cols / 2) * gap;
          positions[i++] = 0;
          positions[i++] = (z - rows / 2) * gap;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const uniforms = {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uColor: { value: new THREE.Color(host.dataset.color || '#ffffff') },
        uSize: { value: parseFloat(host.dataset.size || 3.4) * renderer.getPixelRatio() },
        uScroll: { value: 0 }
      };
      const mat = new THREE.ShaderMaterial({
        uniforms, transparent: true, depthWrite: false,
        vertexShader: /* glsl */`
          uniform float uTime; uniform vec2 uMouse; uniform float uSize; uniform float uScroll;
          varying float vFade;
          void main() {
            vec3 p = position;
            float w = sin(p.x * 0.55 + uTime * 0.9) * 0.35 + cos(p.z * 0.7 + uTime * 0.6) * 0.3;
            float d = distance(p.xz, uMouse * vec2(9.0, 5.0));
            w += sin(d * 2.2 - uTime * 3.0) * 0.25 * smoothstep(3.5, 0.0, d);
            p.y += w - uScroll * 1.5;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = uSize * (6.0 / -mv.z);
            vFade = smoothstep(18.0, 4.0, -mv.z);
          }`,
        fragmentShader: /* glsl */`
          uniform vec3 uColor; varying float vFade;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;
            gl_FragColor = vec4(uColor, (1.0 - d * 2.0) * vFade * 0.9);
          }`
      });
      scene.add(new THREE.Points(geo, mat));

      const ptr = pointerTracker(host);
      const st = ScrollTrigger.create({
        trigger: host, start: 'top top', end: 'bottom top', scrub: true,
        onUpdate: s => { uniforms.uScroll.value = s.progress; }
      });

      const tick = (time) => {
        if (!stage.isVisible()) return;
        ptr.x = M.lerp(ptr.x, ptr.tx, 0.06);
        ptr.y = M.lerp(ptr.y, ptr.ty, 0.06);
        uniforms.uTime.value = time;
        uniforms.uMouse.value.set(ptr.x, -ptr.y);
        renderer.render(scene, camera);
      };
      gsap.ticker.add(tick);

      return () => {
        gsap.ticker.remove(tick);
        st.kill(); ptr.destroy(); stage.destroy();
      };
    });
  });
});
