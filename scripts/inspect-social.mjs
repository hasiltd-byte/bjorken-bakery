import {writeFile} from 'node:fs/promises';
for(const [name,url] of [['instagram','https://www.instagram.com/_bjorken_/'],['facebook','https://www.facebook.com/p/%D7%91%D7%99%D7%95%D7%A8%D7%A7%D7%9F-Bj%C3%B6rken-61593858941976/']]){
 try{const r=await fetch(url,{signal:AbortSignal.timeout(20000)}),t=await r.text();await writeFile('.local/'+name+'-public.html',t);console.log(JSON.stringify({name,status:r.status,length:t.length,title:t.match(/<title>(.*?)<\/title>/)?.[1],meta:(t.match(/<meta[^>]*>/g)||[]).filter(m=>m.includes('og:image'))}));}catch(e){console.log(name,e.message)}
}
