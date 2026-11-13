/* MAZDA Jobs service worker (web/PWA only; the Android app does not register it).
   Caches the app shell so it opens offline. Never caches config, scan data or Supabase calls. */
"use strict";
const CACHE="mazda-jobs-v2";
const SHELL=["./","index.html","app.css","app.js","manifest.webmanifest","icon-192.png","icon-512.png","fonts/inter-latin-wght-normal.woff2","fonts/inter-latin-ext-wght-normal.woff2"];
self.addEventListener("install",(e)=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener("activate",(e)=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener("fetch",(e)=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==self.location.origin) return;
  if(/\/(config|scan)\.json$/.test(u.pathname)) return;
  /* Network first, so a new deploy shows up on the next open; cache as the offline fallback. */
  e.respondWith(fetch(e.request).then(r=>{ if(r.ok){ const cp=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,cp)); } return r; })
    .catch(()=>caches.match(e.request).then(r=>r||caches.match("index.html"))));
});
