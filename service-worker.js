const CACHE_NAME = 'bellagio-cache-v4';
const PRECACHE = ['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install', (e)=>{ self.skipWaiting(); e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(PRECACHE))); });
self.addEventListener('activate', (e)=>{ e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE_NAME?caches.delete(k):null))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', (e)=>{ const url=new URL(e.request.url); if(url.origin===location.origin){ e.respondWith(fetch(e.request).then(resp=>{ const copy=resp.clone(); caches.open(CACHE_NAME).then(c=>c.put(e.request,copy)); return resp; }).catch(()=>caches.match(e.request))); } else { e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))); } });
