// Service worker mínimo do PWA. NÃO cacheia a app (nada de chunk hasheado do Next → sem stale
// pós-deploy) nem rotas autenticadas. Só precacheia a página offline + ícones, e serve /offline
// quando uma NAVEGAÇÃO falha por rede. Tudo o mais passa direto. [PWA / painel]
const CACHE_NAME = "sdt-shell-v1";
const OFFLINE_URL = "/offline";
// Só a /offline: é o único recurso que o fetch handler serve de volta. Manter a lista mínima evita
// que um 404 futuro de outro asset derrube o install atômico (cache.addAll) inteiro. [lente]
const PRECACHE = [OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  // Limpa versões antigas do cache do shell (bump em CACHE_NAME rebusca a /offline no próximo deploy).
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Só navegações GET same-origin. Non-GET (submits), cross-origin, /api/* (auth/dados) e
  // subrecursos (/_next, imagens) passam direto pro browser/rede.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return;
  if (req.mode !== "navigate") return;
  // Fallback SÓ em falha de rede (fetch rejeitado). 401/403/500 passam intactos — não viram offline.
  event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
});
