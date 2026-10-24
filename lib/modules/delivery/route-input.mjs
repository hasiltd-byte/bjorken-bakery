import {randomUUID} from 'node:crypto';
import {moduleError} from '../core/registry.mjs';
import {cents} from '../core/validation.mjs';
import {validDate,israelDate} from '../../../shared/schedule.mjs';
import {israelLocalToIso,israelLocalValue,suggestedDeliverySlug} from '../../../shared/delivery-route.mjs';
export function validateRouteInput(b,{old,now=Date.now(),space='live'}={}){
 const fields={};const field=(key,value,min,max)=>{if(typeof value!=='string'||value.trim().length<min||value.length>max){fields[key]=`יש להזין ${min}–${max} תווים.`;return ''}return value.trim()};
 const title=field('title',b.title,3,120),slug=field('slug',b.slug||suggestedDeliverySlug(title),3,70);
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))fields.slug='השם הקצר יכול לכלול אותיות באנגלית, מספרים ומקפים בין מילים.';
 let closeAt=b.closeAtLocal?israelLocalToIso(b.closeAtLocal):b.closeAt;
 if(typeof closeAt!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(closeAt)||!Number.isFinite(Date.parse(closeAt))||Date.parse(closeAt)<=now)fields.closeAtLocal='בחרו תאריך ושעה עתידיים לסגירה, לפי שעון ישראל.';
 else closeAt=new Date(closeAt).toISOString();
 const money={};for(const [key,label]of Object.entries({minimum:'מינימום אישי',activation:'סף קיום',freeShipping:'סף משלוח חינם',shipping:'דמי משלוח',redeliveryFee:'דמי משלוח חוזר'})){try{money[key+'Cents']=cents(b[key]??(key==='redeliveryFee'?0:undefined))}catch{fields[key]=`${label}: הזינו סכום תקין בשקלים, עד שתי ספרות אחרי הנקודה.`}}
 if(!Array.isArray(b.stops)||b.stops.length<1||b.stops.length>20)fields.stops='יש להגדיר 1–20 נקודות חלוקה.';
 const used=new Set(),closeLocal=!fields.closeAtLocal?israelLocalValue(closeAt):null;
 const stops=(Array.isArray(b.stops)?b.stops:[]).slice(0,20).map((s,index)=>{
  s=s&&typeof s==='object'?s:{};const p='stops.'+index+'.';let id=old?.stops.some(stop=>stop.id===s.id)?s.id:randomUUID();if(used.has(id)){fields[p+'area']='נקודת חלוקה מופיעה פעמיים.';id=randomUUID()}used.add(id);
  const area=field(p+'area',s.area,2,80),address=field(p+'address',s.address,5,240);
  if(!validDate(s.date)||s.date<israelDate(new Date(now)))fields[p+'date']='בחרו תאריך חלוקה תקין שאינו בעבר.';
  for(const key of ['from','to'])if(typeof s[key]!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s[key]))fields[p+key]='בחרו שעה תקינה.';
  if(!fields[p+'from']&&!fields[p+'to']&&s.from>=s.to)fields[p+'to']='שעת הסיום חייבת להיות אחרי שעת ההתחלה.';
  if(closeLocal&&!fields[p+'date']&&!fields[p+'from']&&s.date+'T'+s.from<=closeLocal)fields[p+'date']='החלוקה חייבת להתחיל אחרי סגירת ההרשמה.';
  return {id,area,address,date:s.date,from:s.from,to:s.to};
 });
 const paymentPolicy=field('paymentPolicy',b.paymentPolicy,10,600),noShowPolicy=field('noShowPolicy',b.noShowPolicy,10,600),driverUsername=field('driverUsername',b.driverUsername||'',0,60);
 if(Object.keys(fields).length)throw Object.assign(moduleError('בדקו את השדות המסומנים בטופס.'),{fields});
 return {slug,title,stops,closeAt,minimumCents:money.minimumCents,activationCents:money.activationCents,freeShippingCents:money.freeShippingCents,shippingCents:money.shippingCents,redeliveryFeeCents:money.redeliveryFeeCents,paymentPolicy,noShowPolicy,driverUsername,paymentMode:space==='demo'?'simulation':'manual_verified'};
}
