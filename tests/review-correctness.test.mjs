import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pilotFixture} from './helpers/pilot.mjs';
import {scopedStore} from '../lib/modules/core/store.mjs';
import {addDays,israelDate,nextPickupDate} from '../shared/schedule.mjs';
import {expireRequests} from '../lib/modules/orders/lifecycle.mjs';

async function payload(f,items=[{id:'cinnamon',quantity:1}]){const config=await f.enableShop();return {nonce:randomUUID(),name:'לקוח בדיקה בלבד',phone:'0501234567',date:nextPickupDate(config,new Date(addDays(israelDate(),1)+'T04:00:00Z')),pickup:'09:00',notes:'',acknowledged:true,items}}
test('Preview blocks public/live module actions and demo never modifies live grants or real product/order rows',async()=>{
 const f=await pilotFixture();try{
  await f.enableShop();for(const feature of ['foodPro','groupDelivery','club','reviews'])await f.license(feature);
  const grantBefore=await f.db.getConfig('hasi:bjorken:licenses','{}'),productsBefore=await f.db.find('MenuItem');process.env.BJORKEN_ENABLE_LIVE='false';
  for(const [path,method,data]of [['/modules/public/club/join','POST',{name:'דוגמה'}],['/modules/public/reviews','POST',{rating:5}],['/modules/public/reviews','GET'],['/modules/public/delivery/any-route','GET'],['/modules/delivery/routes','POST',{}],['/modules/food/count','POST',{productId:'cinnamon',stock:99}],['/modules/club/coupons','POST',{}]])assert.equal((await f.call(path,method,data,'admin')).status,403,path);
  assert.equal((await f.call('/modules/public/features','GET',undefined,'public')).data.features.club.allowed,false);
  assert.equal((await f.call('/modules/demo','POST',{})).status,200);assert.equal(await f.db.getConfig('hasi:bjorken:licenses','{}'),grantBefore);assert.deepEqual(await f.db.find('MenuItem'),productsBefore);assert.equal(await f.db.count('Order'),0);
  assert.equal((await f.call('/modules/public/reviews?space=demo','POST',{name:'דוגמה בלבד',rating:1,text:'משוב דמו בלבד',publicConsent:false})).status,201);
  assert.equal((await f.call('/modules/licenses?space=demo','PATCH',{feature:'club',status:'active'})).status,403);
 }finally{await f.close()}
});
test('Unsent WhatsApp request expires once: stock and coupon release; confirmed/paid requests and undated historical records survive',async()=>{
 const f=await pilotFixture();try{
  const b=await payload(f);await f.license('club');await f.db.update('MenuItem',{id:'cinnamon'},{$set:{price:20,stock:5}});
  await f.call('/modules/club/coupons','POST',{code:'HOLD',title:'קופון הדגמה',type:'fixed',value:5,minimum:10,maxUses:1,expiresAt:new Date(Date.now()+86400000).toISOString()});b.coupon='HOLD';
  const request=await f.call('/requests','POST',b,'public');assert.equal(request.status,201);let order=await f.db.one('Order',{id:request.data.id});assert.ok(order.expiresAt>Date.now());assert.equal(order.status,'pending_confirmation');assert.equal((await f.db.one('MenuItem',{id:'cinnamon'})).stock,4);
  const demoSnapshot=await f.db.find('Order');await f.call('/modules/demo','POST',{});assert.deepEqual(await f.db.find('Order'),demoSnapshot);
  await f.db.update('Order',{id:order.id},{$set:{expiresAt:Date.now()-1}});assert.equal(await expireRequests(f.db,'bjorken'),1);assert.equal(await expireRequests(f.db,'bjorken'),0);assert.equal((await f.db.one('MenuItem',{id:'cinnamon'})).stock,5);assert.equal((await scopedStore(f.db,'bjorken','live').get('coupon','HOLD')).data.used,0);assert.equal((await f.call('/requests','POST',b,'public')).status,410);
  const accepted=await f.call('/requests','POST',{...b,nonce:randomUUID()},'public');order=await f.db.one('Order',{id:accepted.data.id});assert.equal((await f.call('/admin/orders/'+order.id,'PATCH',{status:'confirmed',updated_at:order.updated_at,priceConfirmed:true,availabilityConfirmed:true})).status,200);await f.db.update('Order',{id:order.id},{$set:{expiresAt:Date.now()-1}});assert.equal(await expireRequests(f.db,'bjorken'),0);assert.equal((await f.db.one('Order',{id:order.id})).status,'confirmed');assert.equal((await f.db.one('MenuItem',{id:'cinnamon'})).stock,4);
 }finally{await f.close()}
});
test('Unknown prices require numeric quote plus customer agreement; no checkbox-only confirmation, stale agreement or kitchen PII',async()=>{
 const f=await pilotFixture();try{
  const b=await payload(f);await f.license('foodPro');await f.staff('kitchen');b.notes='שם פרטי 0501234567 customer@example.test';const request=await f.call('/requests','POST',b,'public');let order=await f.db.one('Order',{id:request.data.id});
  assert.equal((await f.call('/admin/orders/'+order.id,'PATCH',{updated_at:order.updated_at,status:'confirmed',priceConfirmed:true,availabilityConfirmed:true})).status,400);
  const quote=await f.call('/admin/orders/'+order.id+'/quote','PATCH',{updated_at:order.updated_at,unitPrices:{cinnamon:20}});assert.equal(quote.status,200);order=quote.data.order;assert.equal(order.finalQuote.totalCents,2000);assert.equal(order.finalQuote.customerAgreedAt,null);
  const track=request.data.trackingUrl.replace('/track/','/tracking/');assert.equal((await f.call(track+'/consent','POST',{version:0,agreed:true},'public')).status,409);assert.equal((await f.call(track+'/consent','POST',{version:1,agreed:true},'public')).status,200);order=await f.db.one('Order',{id:order.id});
  assert.equal((await f.call('/admin/orders/'+order.id,'PATCH',{updated_at:order.updated_at,status:'confirmed',priceConfirmed:true,availabilityConfirmed:true})).status,200);
  const kitchen=(await f.call('/modules/orders','GET',undefined,'kitchen')).data.orders[0];for(const key of ['notes','phone','deliveryAddress','finalQuote','costSnapshot','customer@example.test'])assert.ok(!JSON.stringify(kitchen).includes(key));
 }finally{await f.close()}
});
test('Staff role/reset operations require owner identity and revoke sessions; temporary/weak passwords are restricted until changed',async()=>{
 const f=await pilotFixture();try{
  await f.staff('cashier');await f.staff('manager');const username='review-cashier';
  assert.equal((await f.call('/modules/staff/'+username,'PATCH',{role:'driver'},'manager')).status,403);
  assert.equal((await f.call('/modules/staff/'+username,'PATCH',{role:'driver'})).status,200);assert.equal((await f.call('/modules/me','GET',undefined,'cashier')).status,401);
  assert.equal((await f.call('/modules/staff/'+username+'/reset-password','POST',{ownerPassword:'wrong'})).status,403);
  const reset=await f.call('/modules/staff/'+username+'/reset-password','POST',{ownerPassword:'Isolated-owner-pass-2026'});assert.equal(reset.status,200);const login=await f.call('/login','POST',{username,password:reset.data.temporaryPassword},'public');assert.equal(login.data.mustChangePassword,true);f.cookies.cashier=login.response.headers.get('set-cookie').split(';')[0];
  assert.equal((await f.call('/modules/me','GET',undefined,'cashier')).status,428);assert.equal((await f.call('/security','GET',undefined,'cashier')).status,200);
  assert.equal((await f.call('/security/password','POST',{currentPassword:reset.data.temporaryPassword,newPassword:'short'},'cashier')).status,400);
  assert.equal((await f.call('/security/password','POST',{currentPassword:reset.data.temporaryPassword,newPassword:'New-isolated-password-2026'},'cashier')).status,200);assert.equal((await f.call('/modules/me','GET',undefined,'cashier')).status,401);
  assert.equal((await f.call('/login','POST',{username,password:reset.data.temporaryPassword},'public')).status,401);const current=await f.call('/login','POST',{username,password:'New-isolated-password-2026'},'public');assert.equal(current.status,200);assert.equal(current.data.mustChangePassword,false);
  const audit=JSON.stringify(await scopedStore(f.db,'bjorken','live').list('audit'));assert.ok(!audit.includes(reset.data.temporaryPassword));assert.ok(!audit.includes('New-isolated-password-2026'));
 }finally{await f.close()}
});
