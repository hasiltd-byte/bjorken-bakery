import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {createService} from '../lib/server/service.mjs';
import {settings} from '../shared/catalog.mjs';
import {nextPickupDate,addDays,israelDate} from '../shared/schedule.mjs';
test('service worker never intercepts private/API/checkout requests and only precaches public shell',async()=>{
 const handlers={},added=[];vm.runInNewContext(await readFile('public/sw.js','utf8'),{self:{location:{origin:'https://bakery.example'},addEventListener:(name,handler)=>handlers[name]=handler},caches:{open:async()=>({addAll:async urls=>added.push(...urls)})},URL,fetch:async()=>({ok:true})});
 let installed;handlers.install({waitUntil:p=>installed=p});await installed;assert.deepEqual(added,['/offline.html','/pwa/icon-192.png','/pwa/icon-512.png','/pwa/maskable-512.png']);
 for(const path of ['/admin','/admin/menu','/order','/order/api/menu','/order/api/requests','/track/secret','/club/manage/secret','/?token=secret']){let intercepted=false;handlers.fetch({request:{method:'GET',url:'https://bakery.example'+path,mode:'navigate'},respondWith:()=>intercepted=true});assert.equal(intercepted,false,path)}
});
test('normal delivery is opt-in, requires an address and takes its fee from the server',async()=>{
 const replica=await MongoMemoryReplSet.create({binary:{downloadDir:'.local/mongodb-binaries'},replSet:{count:1}});let service;
 try{service=await createService({mongoUri:replica.getUri('bjorken_test'),dbName:'bjorken_test'});process.env.BJORKEN_ENABLE_LIVE='true';let config={...settings,ordersOpen:true,ownerApproved:true,whatsappVerified:true,whatsapp:'0501234567'};await service.db.setConfig('business',JSON.stringify(config));
 const date=nextPickupDate(config,new Date(addDays(israelDate(),1)+'T04:00:00Z')),payload={nonce:randomUUID(),kind:'delivery',name:'לקוח משלוח',phone:'0501234567',date,pickup:'09:00',deliveryAddress:'רחוב לדוגמה 12, הגליל',notes:'',acknowledged:true,items:[{id:'cinnamon',quantity:1}]};
 const send=async data=>service.handle(new Request('http://localhost/order/api/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}));assert.equal((await send(payload)).status,400);
 config={...config,deliveryEnabled:true,deliveryFee:25};await service.db.setConfig('business',JSON.stringify(config));assert.equal((await send({...payload,deliveryAddress:''})).status,400);const response=await send({...payload,deliveryFee:0});assert.equal(response.status,201);const result=await response.json(),stored=await service.db.one('Order',{id:result.id});assert.equal(stored.payload.deliveryFee,25);assert.match(decodeURIComponent(result.whatsappUrl),/משלוח בתיאום/);assert.match(decodeURIComponent(result.whatsappUrl),/₪25/);
 }finally{delete process.env.BJORKEN_ENABLE_LIVE;await service?.close();await replica.stop()}
});
