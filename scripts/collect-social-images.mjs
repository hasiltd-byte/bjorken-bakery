import {readFile,writeFile,mkdir} from 'node:fs/promises';
const candidates=[];
for(const site of ['instagram','facebook']){
 const html=await readFile('.local/'+site+'-public.html','utf8');
 function visit(v,path=''){
  if(!v||typeof v!=='object')return;
  if(typeof v.uri==='string'&&/scontent|fbcdn/.test(v.uri))candidates.push({site,url:v.uri,width:v.width,height:v.height,path});
  if(typeof v.url==='string'&&/scontent|fbcdn/.test(v.url))candidates.push({site,url:v.url,width:v.width,height:v.height,path});
  if(typeof v.display_url==='string')candidates.push({site,url:v.display_url,width:v.dimensions?.width,height:v.dimensions?.height,path,caption:JSON.stringify(v.edge_media_to_caption||v.caption||'').slice(0,800)});
  for(const [k,x] of Object.entries(v))visit(x,path+'.'+k);
 }
 for(const m of html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)){try{visit(JSON.parse(m[1]))}catch{}}
}
const unique=[...new Map(candidates.map(c=>[c.url,c])).values()];await mkdir('.local/social-downloads',{recursive:true});await writeFile('.local/social-images.json',JSON.stringify(unique,null,2));console.log(JSON.stringify(unique.map((x,i)=>({i,site:x.site,width:x.width,height:x.height,path:x.path.slice(-150),caption:x.caption})),null,2));
