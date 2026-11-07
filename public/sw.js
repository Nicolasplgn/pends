// Service worker mínimo do Pends: torna o app instalável e mostra uma
// tela offline amigável. Dados sempre vêm da rede (nada financeiro em cache).
const OFFLINE_HTML = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pends offline</title><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#050811;color:#94a3b8;font-family:monospace;text-align:center"><div><div style="font-size:40px">📡</div><p>Sem conexão.<br>O Pends volta assim que a internet voltar.</p></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }))
  );
});
