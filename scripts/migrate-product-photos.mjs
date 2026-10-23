// Explicit, resumable migration: only pictures and the confirmed honey-cake name change.
import nextEnv from '@next/env';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {productPhotoMap} from '../shared/product-photo-map.mjs';
nextEnv.loadEnvConfig(process.cwd());
if(!process.argv.includes('--apply'))throw Error('Pass --apply to upload the prepared photos and update the bakery catalog.');
const root='http://localhost:3030',manifest=JSON.parse(await readFile('visual-references/product-photos-v3.json','utf8'));
await mkdir('.local',{recursive:true});
let uploads={};try{uploads=JSON.parse(await readFile('.local/product-photos-v3-upload.json','utf8'))}catch{}
let cookie='';
async function api(path,method='GET',data){
 const raw=Buffer.isBuffer(data),response=await fetch(root+'/order/api'+path,{method,headers:{origin:root,...(cookie?{cookie}:{}),...(data?{'content-type':raw?'image/webp':'application/json'}:{})},body:data?(raw?data:JSON.stringify(data)):undefined,signal:AbortSignal.timeout(60000)});
 const result=await response.json();if(!response.ok)throw Error(path+': '+(result.error||response.status));
 const session=response.headers.get('set-cookie');if(session)cookie=session.split(';')[0];return result;
}
await api('/login','POST',{username:process.env.BJORKEN_ADMIN_USERNAME,password:process.env.BJORKEN_ADMIN_PASSWORD});
for(const photo of manifest){
 if(!uploads[photo.asset]||uploads[photo.asset].sourceHash!==photo.sourceHash){
  const uploaded=await api('/admin/images','POST',await readFile('public'+photo.asset));
  uploads[photo.asset]={...uploaded,sourceHash:photo.sourceHash};
  await writeFile('.local/product-photos-v3-upload.json',JSON.stringify(uploads,null,2));
 }
 console.log('Photo ready:',photo.id,photo.index);
}
for(const [id,mapping]of Object.entries(productPhotoMap)){
 const current=(await api('/admin/products')).products.find(p=>p.id===id);
 if(!current)throw Error('Missing existing product: '+id);
 const photos=manifest.filter(photo=>photo.id===id).sort((a,b)=>a.index-b.index).map(photo=>uploads[photo.asset].url);
 const changes={image:photos[0],gallery:photos.slice(1),...(mapping.name?{name:mapping.name,en:mapping.en}:{})};
 if(current.image!==changes.image||JSON.stringify(current.gallery||[])!==JSON.stringify(changes.gallery)||(mapping.name&&current.name!==mapping.name)){
  await api('/admin/products/'+id,'PATCH',{...current,...changes});
 }
 console.log('Catalog updated:',id);
}
const menu=await api('/menu');
if(menu.products.some(p=>!p.image||p.image.includes('placeholder')))throw Error('A public product still lacks a photograph.');
if(menu.products.find(p=>p.id==='yeast')?.name!==productPhotoMap.yeast.name)throw Error('Honey cake was not renamed.');
console.log('Verified:',menu.products.length,'public products with photographs; honey cake renamed; business settings untouched.');
