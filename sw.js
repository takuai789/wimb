// WIMB Service Worker
// 自動アップデート対応版。
// - HTML/JS本体（index.html）はネットワーク優先で常に最新を取りに行く
// - 取得失敗時（オフライン）はキャッシュにフォールバック
// - アイコン等の静的アセットはキャッシュ優先（速さ重視）
// CACHE の数字を上げるたびに「新しいバージョン」として検知される。
// リリース時は index.html の APP_VERSION と必ずセットで上げること。
const CACHE = 'wimb-v1-7-0';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  // skipWaiting はしない。新SWは待機し、ユーザーが「更新」を押したら有効化する。
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ページから「すぐ有効化して」と言われたら待機を解除
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 別オリジン（Google Fonts等）: ネットワーク優先・失敗時キャッシュ
  if (url.origin !== location.origin) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // HTMLナビゲーション（index.html / ルート）: ネットワーク優先で最新を取得
  const isHTML = req.mode === 'navigate'
    || url.pathname.endsWith('/')
    || url.pathname.endsWith('index.html');
  if (isHTML) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // その他の同一オリジン（アイコン等）: キャッシュ優先・無ければ取得
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
