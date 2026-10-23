/* No customer pages, HTML, API responses, requests or admin data are cached. */
const CACHE='bjorken-public-shell-v1',SHELL=['/offline.html','/pwa/icon-192.png','/pwa/icon-512.png','/pwa/maskable-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('bjorken-public-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.search)return;
 if(SHELL.includes(url.pathname)){event.respondWith(caches.match(request).then(hit=>hit||fetch(request)));return}
 if(request.mode==='navigate'&&['/','/install','/designs','/designs/sunlight','/designs/hearth'].includes(url.pathname))event.respondWith(fetch(request).catch(()=>caches.match('/offline.html')));
});
