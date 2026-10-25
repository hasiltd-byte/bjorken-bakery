// Legacy catalog prices remain NIS at their boundary. All calculations use integer agorot.
export const nisToCents=value=>value==null?null:Math.round(value*100);
export function orderAmounts(order){
 const payload=order.payload,unknown=payload.items.some(i=>i.price==null),gross=payload.items.reduce((n,i)=>n+(nisToCents(i.price)??0)*i.quantity,0);
 if(order.finalQuote)return {productGrossCents:order.finalQuote.productCents,discountCents:payload.discountCents||0,productNetCents:Math.max(0,order.finalQuote.productCents-(payload.discountCents||0)),shippingCents:order.finalQuote.shippingCents,totalCents:order.finalQuote.totalCents,unknown:false};
 const discount=payload.discountCents||0,shipping=payload.kind==='delivery'?nisToCents(payload.deliveryFee):0;
 return {productGrossCents:gross,discountCents:discount,productNetCents:Math.max(0,gross-discount),shippingCents:shipping,totalCents:unknown||shipping===null?null:Math.max(0,gross-discount)+shipping,unknown};
}
export function paymentInPeriod(record,prefix){
 if(!record||!Number.isSafeInteger(record.amountCents)||!Number.isFinite(record.verifiedAt))return false;
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(record.verifiedAt));return day.startsWith(prefix);
}
export function groupPayments(order){
 const extra=Array.isArray(order.additionalPayments)?order.additionalPayments:order.rescheduled?.payment?[{...order.rescheduled.payment,kind:'redelivery'}]:[];
 return [...(order.payment?[{...order.payment,kind:'initial'}]:[]),...extra].filter(record=>Number.isFinite(record.verifiedAt)&&Number.isSafeInteger(record.amountCents));
}
