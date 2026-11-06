// Offline support: cache the app shell so the app opens without a network.
// Bump VERSION in version.js on every release (and add any new files below).
// Registered as a module worker so it can share version.js with the page.
import { VERSION as APP_VERSION } from './version.js';
const VERSION = `flyingblind-v${APP_VERSION}`;

const FILES = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'format.js',
  'speech.js',
  'pitch.js',
  'version.js',
  'tone.js',
  'devices/driver.js',
  'devices/simulator.js',
  'devices/leica-disto.js',
  'devices/bosch-glm.js',
  'devices/generic-ble.js',
  'devices/esp32-lidar.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so edits show up immediately), cache as the offline fallback.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;
  event.respondWith(
    // no-cache: always check with the server, so the browser's HTTP cache can't serve stale code.
    fetch(event.request.url, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
