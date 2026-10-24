import {orderScope} from './core.mjs';
import {adjustProductStock} from './stock.mjs';
import {scopedStore} from '../core/store.mjs';
import {moduleError} from '../core/registry.mjs';
import {cents,text} from '../core/validation.mjs';

export async function releaseOrderReservation(db,businessId,order){
 if(order.reserved)for(const item of order.payload.items)await adjustProductStock(db,item.id,item.quantity);
 if(order.payload.coupon&&!order.couponReservationReleased){
  const store=scopedStore(db,businessId,'live'),coupon=await store.get('coupon',order.payload.coupon);
  if(coupon)await store.set('coupon',coupon.key,{...coupon.data,used:Math.max(0,coupon.data.used-1)},coupon.revision);
 }
 return {reserved:false,couponReservationReleased:!!order.payload.coupon};
}
// Lazy safety sweep on real API access. A scheduler may call the authenticated maintenance API too.
// Historical records without an explicit expiresAt are not assigned invented deadlines.
export async function expireRequests(db,businessId,now=Date.now()){
 const due=await db.find('Order',{...orderScope(businessId),status:'pending_confirmation',expiresAt:{$lte:now},paymentRecord:{$exists:false}},undefined,200);
 let expired=0;
 for(const candidate of due)await db.transaction(async()=>{
  const order=await db.one('Order',{id:candidate.id,...orderScope(businessId)});
  if(!order||order.status!=='pending_confirmation'||!Number.isFinite(order.expiresAt)||order.expiresAt>now||order.paymentRecord)return;
  const released=await releaseOrderReservation(db,businessId,order);
  await db.update('Order',{id:order.id},{$set:{...released,status:'expired',updated_at:Math.max(now,order.updated_at+1)},$push:{timeline:{status:'expired',at:now,actor:'reservation-expiry'}}});
  await scopedStore(db,businessId,'live').audit('order.expired',null,order.id,{released:true});expired++;
 });return expired;
}
export function requiresFinalQuote(order){return !order.payload.items.length||order.payload.items.some(i=>i.price==null)||(order.payload.kind==='delivery'&&order.payload.deliveryFee==null)}
export function hasAgreedFinalQuote(order){return !!(order.finalQuote&&Number.isSafeInteger(order.finalQuote.totalCents)&&order.finalQuote.totalCents>0&&order.finalQuote.customerAgreedAt)}
export function quoteFromInput(order,b,actor){
 if(!['pending_confirmation','confirmed'].includes(order.status))throw moduleError('ניתן לקבוע מחיר לפני תחילת הכנה בלבד.',409);
 const lines=order.payload.items.map(item=>{const price=b.unitPrices?.[item.id]??item.price;if(price==null)throw moduleError('יש להזין מחיר מספרי לכל מוצר.');return {id:item.id,name:item.name,quantity:item.quantity,unitPriceCents:cents(price)}});
 const productCents=lines.length?lines.reduce((n,i)=>n+i.unitPriceCents*i.quantity,0):cents(b.eventPrice);
 const shippingCents=order.payload.kind==='delivery'?cents(b.deliveryFee??order.payload.deliveryFee):0;
 const totalCents=Math.max(0,productCents-(order.payload.discountCents||0))+shippingCents;
 if(totalCents<=0)throw moduleError('נדרש מחיר סופי חיובי.');
 const manual=b.customerAgreed===true,reference=manual?text(b.customerAgreementReference,5,200):null;
 return {version:(order.finalQuote?.version||0)+1,lines,productCents,shippingCents,totalCents,createdAt:Date.now(),createdBy:actor.username,customerAgreedAt:manual?Date.now():null,agreementSource:manual?'staff_recorded_customer_agreement':null,agreementReference:reference};
}
