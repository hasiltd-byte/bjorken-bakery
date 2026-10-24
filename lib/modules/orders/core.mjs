import {randomUUID} from 'node:crypto';
import {moduleError,requireRole} from '../core/registry.mjs';
import {orderLabels,transitions} from '../../../shared/modules/order-state.mjs';
import {adjustProductStock} from './stock.mjs';
import {releaseOrderReservation,requiresFinalQuote,hasAgreedFinalQuote} from './lifecycle.mjs';
export {orderLabels,transitions};
export const orderScope=businessId=>businessId==='bjorken'?{$or:[{businessId},{businessId:{$exists:false}}]}:{businessId};
export function safeOrder(order,role='admin'){
 const {trackingToken,trackingHash,_id,nonce,...out}=order;out.payload={...out.payload};delete out.payload.fingerprint;
 if(role==='kitchen')return {id:order.id,status:order.status,created_at:order.created_at,updated_at:order.updated_at,priceConfirmed:order.priceConfirmed,availabilityConfirmed:order.availabilityConfirmed,payload:{date:order.payload.date,pickup:order.payload.pickup,kind:order.payload.kind,items:order.payload.items.map(({id,name,quantity})=>({id,name,quantity}))}};
 return out;
}
export function publicTracking(order){return {reference:order.id.slice(-8).toUpperCase(),status:order.status,label:orderLabels[order.status],date:order.payload.date,time:order.payload.pickup,kind:order.payload.kind,items:order.payload.items.map(({name,quantity})=>({name,quantity})),timeline:(order.timeline||[]).map(({status,at})=>({status,label:orderLabels[status],at})),expiresAt:order.expiresAt||null,finalQuote:order.finalQuote?{version:order.finalQuote.version,totalCents:order.finalQuote.totalCents,lines:order.finalQuote.lines,customerAgreedAt:order.finalQuote.customerAgreedAt}:null,updatedAt:order.updated_at}}
export function validateTransition(order,b,actor){
 requireRole(actor,['admin','manager','cashier','kitchen','driver']);
 if(!Object.hasOwn(transitions,b.status))throw moduleError('סטטוס לא תקין.');
 if(b.updated_at!==order.updated_at)throw moduleError('ההזמנה השתנתה. רעננו.',409);
 if(b.status!==order.status&&!transitions[order.status].includes(b.status))throw moduleError('מעבר סטטוס אינו אפשרי.');
 if(actor.role==='kitchen'&&!(['preparing','ready'].includes(b.status)&&['confirmed','preparing'].includes(order.status)))throw moduleError('האופה יכול לקדם הכנה ומוכנות בלבד.',403);
 if(actor.role==='driver'&&!(order.payload.kind==='delivery'&&['out_for_delivery','delivered','not_collected'].includes(b.status)))throw moduleError('הרשאת שליח אינה מאפשרת פעולה זו.',403);
 if(['confirmed','preparing','ready','collected','out_for_delivery','delivered','not_collected'].includes(b.status)&&(!(b.priceConfirmed??order.priceConfirmed)||!(b.availabilityConfirmed??order.availabilityConfirmed)))throw moduleError('יש לאשר מול הלקוח מחיר, זמינות ומועד.');
 if(['confirmed','preparing','ready','collected','out_for_delivery','delivered','not_collected'].includes(b.status)&&requiresFinalQuote(order)&&!hasAgreedFinalQuote(order))throw moduleError('נדרש מחיר סופי מספרי והסכמת לקוח לפני אישור ההזמנה.');
 if(order.payload.kind!=='delivery'&&['out_for_delivery','delivered'].includes(b.status))throw moduleError('הזמנת איסוף אינה משלוח.');
}
export async function transitionLiveOrder(db,businessId,id,b,actor){return db.transaction(async()=>{
 const order=await db.one('Order',{id,...orderScope(businessId)});if(!order)throw moduleError('הבקשה לא נמצאה.',404);validateTransition(order,b,actor);
 const changed=b.status!==order.status,now=Math.max(Date.now(),order.updated_at+1);let reserved=order.reserved;
 const released=['declined','cancelled'].includes(b.status)?await releaseOrderReservation(db,businessId,order):{};if(Object.hasOwn(released,'reserved'))reserved=released.reserved;
 const values={...released,status:b.status,reserved,priceConfirmed:b.priceConfirmed??order.priceConfirmed,availabilityConfirmed:b.availabilityConfirmed??order.availabilityConfirmed,updated_at:now};
 return db.update('Order',{id:order.id},{$set:values,...(changed?{$push:{timeline:{id:randomUUID(),status:b.status,at:now,actor:actor.username,role:actor.role}}}:{})});
})}
