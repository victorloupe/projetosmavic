const CACHE = 'mavic-v108';

const STATIC = [
  './',
  './login.html',
  './login.js',
  './index.html',
  './index.css',
  './common.js',
  './board.js',
  './dashboard.html',
  './dashboard.js',
  './orcamento.html',
  './orcamento.js',
  './pagamentos.html',
  './pagamentos.js',
  './relatorio.html',
  './relatorio.js',
  './clientes.html',
  './clientes.js',
  './servicos.html',
  './servicos.js',
  './config.js',
  './cliente.html',
  './cliente.css',
  './cliente.js',
  './LOGO NOVA.png',
  './icon.ico',
  './apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js',
];

// Instala e cacheia os arquivos estáticos
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

// Remove caches antigas ao ativar
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Estratégia: Network-first para páginas e scripts (garante atualização imediata nos deploys da Vercel)
// com fallback para cache se estiver offline.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Sempre busca da rede para chamadas ao Supabase
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Network-first com fallback para cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
