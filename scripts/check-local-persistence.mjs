import {readFile,writeFile,unlink} from 'node:fs/promises';
import assert from 'node:assert/strict';
const root='http://localhost:3030/order/api';
const credentials=JSON.parse(await readFile('.local/credentials.json','utf8'));
const login=await fetch(root+'/login',{method:'POST',headers:{'Content-Type':'application/json',origin:'http://localhost:3030'},body:JSON.stringify(credentials)});assert.equal(login.status,200);
const cookie=login.headers.get('set-cookie').split(';')[0];
async function api(path,method='GET',body){const r=await fetch(root+path,{method,headers:{cookie,origin:'http://localhost:3030','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();assert.equal(r.status,200,d.error);return d}
const current=(await api('/admin/settings')).settings;
if(process.argv.includes('--prepare')){await writeFile('.local/persistence-check.json',JSON.stringify(current));await api('/admin/settings','PATCH',{...current,banner:'בדיקת התמדה מקומית'});console.log('Prepared persistent setting. Restart the local preview, then run this script without --prepare.')}
else {assert.equal(current.banner,'בדיקת התמדה מקומית');const original=JSON.parse(await readFile('.local/persistence-check.json','utf8'));await api('/admin/settings','PATCH',{...original,revision:current.revision});await unlink('.local/persistence-check.json');console.log('PASS: settings and admin credentials persisted through full MongoDB and Next.js restart. Original settings restored.')}
