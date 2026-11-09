/*
 * Rouveraki service worker. It makes the site installable as an app and shows
 * a friendly page when the phone is offline. It deliberately caches nothing
 * else: menu prices and order status must always come fresh from the network.
 */
const OFFLINE_HTML = `<!doctype html><html lang="el"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Ρουβεράκι</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f6efe6;color:#2b1d14;text-align:center;padding:24px}
h1{font-size:1.6rem;margin:0 0 .5rem}p{opacity:.75;margin:0 0 1.5rem}
button{font:inherit;font-weight:700;border:0;border-radius:999px;padding:.9rem 1.6rem;background:#a16207;color:#fff}</style></head>
<body><div><h1>Χωρίς σύνδεση</h1><p>Έλεγξε το internet και δοκίμασε ξανά.<br>You are offline.</p>
<button onclick="location.reload()">Δοκίμασε ξανά</button></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate") return; // everything else: straight to the network
  event.respondWith(
    fetch(req).catch(
      () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
