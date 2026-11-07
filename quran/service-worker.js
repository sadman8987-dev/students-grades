'use strict';
const VERSION = 'quran-karim-v34';
const SHELL = [
  './', './index.html', './style.css', './app.js', './manifest.json',
  './icon.svg', './mushaf-calligraphy.jpeg'
];
const DATA_CACHE = VERSION + '-data';
const AUDIO_CACHE = VERSION + '-audio';
const AUDIO_HOSTS = new Set([
  'api.alquran.cloud',
  'cdn.mp3quran.net',
  'everyayah.com',
  'www.everyayah.com',
  'server6.mp3quran.net', 'server7.mp3quran.net',
  'server8.mp3quran.net', 'server9.mp3quran.net',
  'server10.mp3quran.net', 'server11.mp3quran.net',
  'server12.mp3quran.net', 'server13.mp3quran.net',
  'archive.org', 'ia903409.us.archive.org'
]);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('quran-karim-') && ![VERSION, DATA_CACHE, AUDIO_CACHE].includes(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function rangedResponse(request, response) {
  const range = request.headers.get('range');
  if (!range || response.type === 'opaque') return response;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return response;
  const bytes = await response.clone().arrayBuffer();
  const size = bytes.byteLength;
  let start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : size - 1;
  if (!match[1] && match[2]) start = Math.max(0, size - Number(match[2]));
  end = Math.min(end, size - 1);
  if (start >= size || end < start) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  const headers = new Headers(response.headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + size);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers });
}

async function cacheResponse(cacheName, request, response) {
  try {
    // Keep complete responses only. Partial 206 audio responses cannot serve a later offline play.
    if (response && (response.type === 'opaque' || (response.ok && response.status === 200))) {
      await (await caches.open(cacheName)).put(request, response.clone());
    }
  } catch (_) {}
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await cacheResponse(VERSION, request, response);
        return response;
      } catch (_) {
        if (request.mode === 'navigate') return (await caches.match('./index.html')) || Response.error();
        return Response.error();
      }
    })());
    return;
  }

  if (url.hostname === 'api.alquran.cloud') {
    event.respondWith((async () => {
      const cache = await caches.open(DATA_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        await cacheResponse(DATA_CACHE, request, response);
        return response;
      } catch (_) {
        return (await cache.match(request)) || Response.error();
      }
    })());
    return;
  }

  if (AUDIO_HOSTS.has(url.hostname) || /\.mp3(\?|$)/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(AUDIO_CACHE);
      // Match by URL without the Range header: the cache stores complete audio files.
      const key = new Request(request.url, { method: 'GET' });
      const cached = await cache.match(key);
      if (cached) return rangedResponse(request, cached);
      try {
        const response = await fetch(request);
        if (response.status === 200 || response.type === 'opaque') {
          await cacheResponse(AUDIO_CACHE, key, response);
        }
        return response;
      } catch (_) {
        return (await cache.match(key)) || Response.error();
      }
    })());
  }
});
