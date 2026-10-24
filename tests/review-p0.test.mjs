import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pilotFixture} from './helpers/pilot.mjs';
import {scopedStore} from '../lib/modules/core/store.mjs';
import {addDays,israelDate,nextPickupDate} from '../shared/schedule.mjs';

test('P0 role DTOs: driver, cashier, kitchen, manager and public never receive internal fields outside their scope',async()=>{
 const f=await pilotFixture();try{
  await f.call('/modules/demo','POST',{});for(const role of ['driver','cashier','kitchen','manager'])await f.staff(role);
  const store=scopedStore(f.db,'bjorken','demo'),route={slug:'dto-route',title:'מסלול בדיקה',stops:[{id:'stop',area:'יישוב בדיקה',address:'כתובת הדגמה 1',date:addDays(israelDate(),2),from:'10:00',to:'11:00'}],closeAt:new Date(Date.now()+86400000).toISOString(),activationCents:8000,freeShippingCents:20000,minimumCents:2000,shippingCents:1000,redeliveryFeeCents:0,driverUsername:'review-driver',noShowPolicy:'תיאום ידני בלבד',calculator:{contributionCents:999999},paymentMode:'simulation'};
  await store.add('route',route,route.slug);await store.add('route',{...route,slug:'other-route',driverUsername:'someone-else'},'other-route');
  const group=await store.add('groupOrder',{routeSlug:route.slug,name:'דוגמה',phone:'0500000000',stopId:'stop',items:[{id:'cinnamon',name:'מאפה',quantity:1,priceCents:2000,costSnapshot:{unitCostCents:700}}],payment:{verifiedAt:Date.now(),amountCents:3000,reference:'private-proof'},status:'confirmed',collectionCode:'PRIVATE-CODE',token:'PRIVATE-TOKEN',subtotalCents:2000,shippingCents:1000,totalCents:3000,timeline:[]});
  for(const suffix of ['/delivery/routes','/delivery/routes/dto-route','/delivery/routes/dto-route/orders','/delivery/routes/dto-route/calculator','/delivery/routes/dto-route/refunds']){
   const r=await f.call('/modules'+suffix+'?space=demo','GET',undefined,'driver');assert.equal(r.status,200);const serialized=JSON.stringify(r.data);for(const key of ['activationCents','freeShippingCents','calculator','contributionCents','priceCents','costSnapshot','private-proof','PRIVATE-CODE','PRIVATE-TOKEN'])assert.ok(!serialized.includes(key),key+' leaked via '+suffix);
  }
  assert.equal((await f.call('/modules/delivery/routes?space=demo','GET',undefined,'driver')).data.routes.length,1);
  assert.equal((await f.call('/modules/delivery/routes/other-route?space=demo','GET',undefined,'driver')).status,403);
  for(const role of ['cashier','kitchen','public'])assert.ok([401,403].includes((await f.call('/modules/delivery/routes?space=demo','GET',undefined,role)).status));
  assert.equal((await f.call('/modules/delivery/routes/dto-route?space=demo','GET',undefined,'manager')).data.route.activationCents,8000);
  const publicDto=await f.call('/modules/public/delivery/dto-route?space=demo','GET',undefined,'public');assert.equal(publicDto.status,200);for(const key of ['activationCents','freeShippingCents','contributionCents','costSnapshot','private-proof'])assert.ok(!JSON.stringify(publicDto.data).includes(key));
  assert.ok(group.key);
 }finally{await f.close()}
});

test('P0 inventory: stale content form, two employees/tabs, cancellation and production completion preserve stock revisions',async()=>{
 const f=await pilotFixture();try{
  await f.staff('manager');const config=await f.enableShop();await f.license('foodPro');await f.db.update('MenuItem',{id:'cinnamon'},{$set:{price:20,stock:5}});
  const snapshot=(await f.call('/admin/products')).data.products.find(p=>p.id==='cinnamon');
  const date=nextPickupDate(config,new Date(addDays(israelDate(),1)+'T04:00:00Z'));
  const request=await f.call('/requests','POST',{nonce:randomUUID(),name:'לקוח דוגמה',phone:'0501234567',date,pickup:'09:00',notes:'',acknowledged:true,items:[{id:'cinnamon',quantity:1}]},'public');assert.equal(request.status,201);
  assert.equal((await f.db.one('MenuItem',{id:'cinnamon'})).stock,4);
  assert.equal((await f.call('/admin/products/cinnamon','PATCH',{...snapshot,description:'עריכת תיאור בלבד',stockChanged:false},'manager')).status,409);
  assert.equal((await f.db.one('MenuItem',{id:'cinnamon'})).stock,4);
  let current=(await f.call('/admin/products')).data.products.find(p=>p.id==='cinnamon');
  const edits=await Promise.all([f.call('/admin/products/cinnamon','PATCH',{...current,description:'עובד ראשון',stockChanged:false}),f.call('/admin/products/cinnamon','PATCH',{...current,description:'עובד שני',stockChanged:false},'manager')]);assert.deepEqual(edits.map(r=>r.status).sort(),[200,409]);
  const order=await f.db.one('Order',{id:request.data.id});assert.equal((await f.call('/admin/orders/'+order.id,'PATCH',{status:'cancelled',priceConfirmed:false,availabilityConfirmed:false,updated_at:order.updated_at})).status,200);
  assert.equal((await f.db.one('MenuItem',{id:'cinnamon'})).stock,5);
  assert.equal((await f.call('/admin/orders/'+order.id,'PATCH',{status:'cancelled',priceConfirmed:false,availabilityConfirmed:false,updated_at:order.updated_at})).status,409);
  const batch=(await f.call('/modules/food/batches','POST',{productId:'cinnamon',quantity:2})).data.batch;
  await f.call('/modules/food/batches/'+batch.id,'PATCH',{revision:0,status:'preparing'});await f.call('/modules/food/batches/'+batch.id,'PATCH',{revision:1,status:'in_oven'});
  const finished=await Promise.all([f.call('/modules/food/batches/'+batch.id,'PATCH',{revision:2,status:'ready'}),f.call('/modules/food/batches/'+batch.id,'PATCH',{revision:2,status:'ready'},'manager')]);assert.deepEqual(finished.map(r=>r.status).sort(),[200,409]);
  current=await f.db.one('MenuItem',{id:'cinnamon'});assert.equal(current.stock,7);assert.equal(current.stockRevision,3);
 }finally{await f.close()}
});

test('P0 receipts use verification month, include redelivery/refunds and never invent dates for historical payments',async()=>{
 const f=await pilotFixture();try{
  await f.enableShop();await f.license('ordersPro');const store=scopedStore(f.db,'bjorken','live');
  const previous=Date.parse('2026-09-30T12:00:00Z'),paid=Date.parse('2026-10-01T12:00:00Z');
  const id=randomUUID();await f.db.create('Order',{id,nonce:randomUUID(),businessId:'bjorken',status:'confirmed',created_at:previous,updated_at:previous,payload:{items:[{id:'cinnamon',name:'מאפה',quantity:1,price:20}],kind:'takeaway'},paymentRecord:{amountCents:2000,verifiedAt:paid,reference:'test-only'}});
  await f.db.create('Order',{id:randomUUID(),nonce:randomUUID(),businessId:'bjorken',status:'confirmed',created_at:previous,payload:{items:[],kind:'takeaway'},paymentRecord:{amountCents:90000,reference:'undated-legacy'}});
  await store.add('groupOrder',{status:'confirmed',items:[],subtotalCents:2000,totalCents:3000,shippingCents:1000,payment:{amountCents:3000,verifiedAt:paid},rescheduled:{payment:{amountCents:1500,verifiedAt:paid}}});
  await store.add('refund',{amountCents:500,status:'verified_refund',verifiedAt:paid});await store.add('refund',{amountCents:700,status:'pending_manual_refund'});
  const october=(await f.call('/modules/reports?period=month&date=2026-10-01')).data,september=(await f.call('/modules/reports?period=month&date=2026-09-01')).data;
  assert.equal(october.verifiedReceiptsCents,6500);assert.equal(october.verifiedRefundsCents,500);assert.equal(october.verifiedRevenueCents,6000);assert.equal(october.shippingReceiptsCents,2500);assert.equal(october.pendingRefundsCents,700);assert.equal(october.paymentsWithoutVerifiedDate,1);assert.equal(september.verifiedReceiptsCents,0);
  assert.equal((await f.call('/modules/orders/'+id+'/payment','PATCH',{amount:20,reference:'duplicate-test',verified:true})).status,409);assert.equal((await f.db.one('Order',{id})).paymentRecord.verifiedAt,paid);
 }finally{await f.close()}
});
