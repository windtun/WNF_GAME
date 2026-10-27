// 牌搭子 service worker：版本 202610271914
const CACHE='pdz-202610271914';
const CORE=["./", "index.html", "peerjs.min.js?v=202610271914", "engine.js?v=202610271914", "seven.js?v=202610271914", "mahjong.js?v=202610271914", "blokus.js?v=202610271914", "rummi.js?v=202610271914", "dice.js?v=202610271914", "darkchess.js?v=202610271914", "pickred.js?v=202610271914", "progress.js?v=202610271914", "app.js?v=202610271914", "icon-180.png", "icon-192.png", "icon-512.png", "maskable-512.png", "manifest.webmanifest"];
self.addEventListener('install', e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e=>{
  const r=e.request; if(r.method!=='GET') return;
  const u=new URL(r.url);
  // 網頁本身：先抓網路（拿到新版），沒網路才用快取
  if(r.mode==='navigate'){ e.respondWith(fetch(r).then(res=>{ const cp=res.clone(); caches.open(CACHE).then(c=>c.put('index.html',cp)); return res; }).catch(()=>caches.match('index.html'))); return; }
  if(u.origin===location.origin){ e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{ if(res.ok){ const cp=res.clone(); caches.open(CACHE).then(c=>c.put(r,cp)); } return res; }))); return; }
  // 字型：有快取先用，背景更新
  if(/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)){ e.respondWith(caches.open(CACHE).then(c=>c.match(r).then(hit=>{ const net=fetch(r).then(res=>{ c.put(r,res.clone()); return res; }).catch(()=>hit); return hit||net; }))); }
});
