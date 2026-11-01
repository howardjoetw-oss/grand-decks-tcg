/* v9: network-first for JSON, cache-first shell fallback. Never serve HTML to JSON requests. */
const CACHE='grand-decks-shell-v12-release-effect-1';
const SHELL=['./','./index.html','./style.css','./app.js','./results.js','./version-history.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
const DATA=['./data/decks.json','./data/cards.json','./data/sync-status.json','./data/meta.json','./data/integrity.json','./data/rules.json','./data/topdecks-sets.json','./data/community.json'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('grand-decks-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  const isData=url.pathname.includes('/data/');
  event.respondWith(fetch(req).then(res=>{
    if(res.ok){const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{});}
    return res;
  }).catch(async()=>{
    const cache=await caches.open(CACHE);
    const saved=await cache.match(req,{ignoreSearch:true});if(saved)return saved;
    if(!isData&&req.mode==='navigate')return cache.match('./index.html');
    return new Response(JSON.stringify({error:'目前離線，且尚未快取此資料'}),{status:503,headers:{'Content-Type':'application/json'}});
  }));
});
