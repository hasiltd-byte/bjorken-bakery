import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pilotFixture} from './helpers/pilot.mjs';
import {addDays,israelDate} from '../shared/schedule.mjs';
import {israelLocalToIso,israelLocalValue,suggestedDeliverySlug} from '../shared/delivery-route.mjs';

const input=(slug='review-route')=>({slug,title:'מסלול חולתה לשישי',closeAtLocal:israelLocalValue(new Date(Date.now()+86400000).toISOString()),minimum:20,activation:20,freeShipping:0,shipping:10,redeliveryFee:15,paymentPolicy:'אימות תשלום ידני באסמכתא בלבד',noShowPolicy:'תיאום איסוף מאוחר באישור וללא קנס מפתיע',stops:[{area:'יישוב בדיקה',address:'נקודת חלוקה לדוגמה 10',date:addDays(israelDate(),2),from:'12:00',to:'12:20'}]});
async function setup(){const f=await pilotFixture();await f.call('/modules/demo','POST',{});const call=(path,method='GET',data,role='admin')=>f.call('/modules'+path+(path.includes('?')?'&':'?')+'space=demo',method,data,role);return {...f,call}}
async function state(f,slug,action,extra={}){const current=(await f.call('/delivery/routes/'+slug)).data.route;return f.call('/delivery/routes/'+slug+'/state','POST',{revision:current.revision,action,...extra})}
async function order(f,slug,quantity=1){const route=(await f.call('/public/delivery/'+slug,'GET',undefined,'public')).data.route;const created=await f.call('/public/delivery/'+slug,'POST',{nonce:randomUUID(),name:'לקוח דמו בלבד',phone:'0501234567',stopId:route.stops[0].id,items:[{id:'cinnamon',quantity}],acknowledged:true,shippingAgreed:true},'public');assert.equal(created.status,201);const token=created.data.trackingUrl.split('/').at(-1).split('?')[0],detail=(await f.call('/delivery/routes/'+slug)).data,row=detail.orders.find(o=>o.name==='לקוח דמו בלבד'&&o.status==='awaiting_payment_verification');return {token,row}}

test('Israel civil times reject impossible dates; slug suggestions are safe without requiring English input',()=>{
 assert.equal(israelLocalToIso('2026-10-24T12:00'),'2026-10-24T09:00:00.000Z');assert.equal(israelLocalValue('2026-10-24T09:00:00Z'),'2026-10-24T12:00');assert.equal(israelLocalToIso('2026-02-30T12:00'),null);assert.match(suggestedDeliverySlug('חלוקה לחולתה — שישי'),/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});
test('Route drafts, explicit publication, field-level errors and optimistic edits protect existing links',async()=>{
 const f=await setup();try{
  const invalid=await f.call('/delivery/routes','POST',{...input(),slug:'לא שם אנגלי',closeAtLocal:'2020-01-01T10:00',shipping:-1,stops:[]});assert.equal(invalid.status,400);for(const field of ['slug','closeAtLocal','shipping','stops'])assert.ok(invalid.data.fields[field]);
  const created=await f.call('/delivery/routes','POST',input());assert.equal(created.status,201);assert.equal(created.data.route.state,'draft');assert.equal((await f.call('/public/delivery/review-route','GET',undefined,'public')).status,404);
  const edited=await f.call('/delivery/routes/review-route','PATCH',{...input(),revision:created.data.route.revision,stops:created.data.route.stops.map(s=>({...s,address:'כתובת דמו חדשה לפני פרסום'}))});assert.equal(edited.status,200);assert.equal((await f.call('/delivery/routes/review-route','PATCH',{...input(),revision:0})).status,409);
  assert.equal((await state(f,'review-route','publish')).status,200);assert.equal((await f.call('/public/delivery/review-route','GET',undefined,'public')).status,200);
  const duplicate=await f.call('/delivery/routes','POST',input());assert.equal(duplicate.status,409);assert.ok(duplicate.data.fields.slug);
  assert.equal((await state(f,'review-route','close')).status,200);const closed=(await f.call('/public/delivery/review-route','GET',undefined,'public')).data;assert.equal(closed.route.closed,true);
 }finally{await f.close()}
});
test('Departure decision requires revalidation after cancellation; free shipping stays committed and assigned driver can record no-show/return',async()=>{
 const f=await setup();try{
  await f.staff('driver');assert.equal((await f.call('/delivery/routes','POST',{...input(),activation:80,freeShipping:80,publish:true,driverUsername:'review-driver'})).status,201);
  const first=await order(f,'review-route',2),second=await order(f,'review-route',2);
  for(const o of [first,second])assert.equal((await f.call('/delivery/orders/'+o.row.id+'/verify-payment','POST',{amount:50,reference:'demo-reference-only',verified:true})).status,200);
  assert.equal((await state(f,'review-route','ready')).status,200);
  assert.equal((await f.call('/delivery/orders/'+second.row.id+'/status','POST',{status:'cancelled'})).status,200);
  assert.equal((await state(f,'review-route','dispatch')).status,409);assert.equal((await state(f,'review-route','ready')).status,409);
  assert.equal((await f.call('/public/delivery/review-route','GET',undefined,'public')).data.route.shippingCents,0);
  assert.equal((await state(f,'review-route','ready',{overrideMinimum:true,reason:'אושרה יציאה מיוחדת על חשבון העסק'})).status,200);assert.equal((await state(f,'review-route','dispatch')).status,200);
  assert.equal((await f.call('/delivery/orders/'+first.row.id+'/status','POST',{status:'not_collected'},'driver')).status,200);assert.equal((await f.call('/delivery/orders/'+first.row.id+'/status','POST',{status:'returned',note:'הוחזר לעסק לבדיקת בטיחות'},'driver')).status,200);
  const detail=(await f.call('/delivery/routes/review-route')).data;assert.equal(detail.orders.find(o=>o.id===first.row.id).status,'returned');assert.ok(detail.refunds.every(r=>r.status==='pending_manual_refund'));assert.equal((await state(f,'review-route','completed')).status,200);
 }finally{await f.close()}
});
test('Material changes require every affected customer consent; cancelling an unviable route queues bounded manual refunds',async()=>{
 const f=await setup();try{
  await f.call('/delivery/routes','POST',{...input(),publish:true});const o=await order(f,'review-route');await f.call('/delivery/orders/'+o.row.id+'/verify-payment','POST',{amount:30,reference:'demo-proof-only',verified:true});let route=(await f.call('/delivery/routes/review-route')).data.route;
  const changed={...input(),revision:route.revision,stops:route.stops.map(s=>({...s,address:'נקודת חלוקה חלופית לדוגמה 20'}))};assert.equal((await f.call('/delivery/routes/review-route','PATCH',changed)).status,409);
  assert.equal((await f.call('/delivery/routes/review-route','PATCH',{...changed,proposal:true,customerNoticePrepared:true,reason:'שינוי כתובת בתיאום עם לקוחות',noticeReference:'תועדה פנייה ידנית לדמו בלבד'})).status,200);
  assert.equal((await state(f,'review-route','apply-change')).status,409);
  const track=(await f.call('/public/delivery-track/'+o.token,'GET',undefined,'public')).data;assert.ok(track.changeProposal);assert.equal(JSON.stringify(track).includes('תועדה פנייה ידנית'),false);
  assert.equal((await f.call('/public/delivery-track/'+o.token+'/change-consent','POST',{proposalId:track.changeProposal.id,agreed:true},'public')).status,200);assert.equal((await state(f,'review-route','apply-change')).status,200);
  route=(await f.call('/delivery/routes/review-route')).data.route;assert.equal(route.stops[0].address,'נקודת חלוקה חלופית לדוגמה 20');
  assert.equal((await state(f,'review-route','cancel',{confirmed:true,reason:'בוטל בתיאום — החזר ידני יטופל'})).status,200);const detail=(await f.call('/delivery/routes/review-route')).data;assert.equal(detail.orders[0].status,'cancelled');assert.equal(detail.refunds.reduce((n,r)=>n+r.amountCents,0),3000);assert.equal(detail.refunds[0].status,'pending_manual_refund');
  assert.equal((await f.call('/public/delivery-track/'+o.token,'GET',undefined,'public')).data.routeState,'cancelled');
 }finally{await f.close()}
});
