import {moduleError,requireRole} from '../core/registry.mjs';
import {text} from '../core/validation.mjs';
import {secret} from '../core/validation.mjs';
import {validateRouteInput} from './route-input.mjs';
import {routeProgress} from './domain.mjs';
import {routeDto} from './serializers.mjs';

const needsConsent=row=>!['collected','cancelled','returned'].includes(row.data.status);
export async function routeManagement(ctx,path,{getRoute,orders,cancelOrder}){
 const {db,store,actor,body,method,space,json}=ctx;
 if(path==='/delivery/slug-availability'&&method==='GET'){requireRole(actor,['admin','manager']);const slug=new URL(ctx.request.url).searchParams.get('value')||'';return json({available:slug.length>=3&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&!await store.get('route',slug)})}
 if(path==='/delivery/routes'&&method==='POST'){
  requireRole(actor,['admin','manager']);const b=await body(),data=validateRouteInput(b,{space});
  if(data.driverUsername&&!await db.one('StaffUser',{businessId:ctx.businessId,username:data.driverUsername,role:'driver',active:true}))throw Object.assign(moduleError('בחרו חשבון שליח פעיל.'),{fields:{driverUsername:'שם השליח לא נמצא או שתפקידו אינו שליח פעיל.'}});
  const row=await db.transaction(async()=>{if(await store.get('route',data.slug))throw Object.assign(moduleError('השם הקצר כבר נמצא בשימוש.',409),{fields:{slug:'בחרו שם קצר אחר לקישור.'}});return store.add('route',{...data,state:b.publish===true?'published':'draft',createdBy:actor.username},data.slug)});
  await store.audit('delivery.route.created',actor,row.key,{state:row.data.state});return json({route:routeDto(row,actor.role)},201);
 }
 const update=path.match(/^\/delivery\/routes\/([a-z0-9-]+)$/);
 if(update&&method==='PATCH'){
  requireRole(actor,['admin','manager']);const b=await body();const result=await db.transaction(async()=>{
   const old=await getRoute(update[1]);if(b.revision!==old.revision)throw moduleError('המסלול השתנה. רעננו לפני שמירה.',409);
   const proposed=validateRouteInput(b,{old:old.data,space});if(proposed.slug!==old.key)throw Object.assign(moduleError('לא ניתן לשנות כתובת קישור לאחר יצירה.'),{fields:{slug:'השם הקצר נשמר כדי שקישורים שכבר הועברו לא יישברו.'}});
   if(proposed.driverUsername&&!await db.one('StaffUser',{businessId:ctx.businessId,username:proposed.driverUsername,role:'driver',active:true}))throw Object.assign(moduleError('שליח לא נמצא.'),{fields:{driverUsername:'בחרו שליח פעיל.'}});
   const rows=await orders(old.key);
   if((old.data.state||'published')==='draft'&&!rows.length)return store.set('route',old.key,{...old.data,...proposed},old.revision);
   if(['dispatched','completed','cancelled'].includes(old.data.state))throw moduleError('המסלול כבר יצא או הסתיים. לא ניתן לשנות התחייבויות.',409);
   if(b.proposal!==true||b.customerNoticePrepared!==true)throw moduleError('לאחר פרסום נדרשת הצעת שינוי, הודעה ידנית והסכמת הלקוחות.',409);
   for(const key of ['minimumCents','activationCents','freeShippingCents','shippingCents','redeliveryFeeCents','paymentPolicy','noShowPolicy'])if(proposed[key]!==old.data[key])throw moduleError('לא משנים מחיר או מדיניות של הזמנות קיימות. פתחו מסלול חדש במקום.',409);
   if(rows.filter(needsConsent).some(row=>!proposed.stops.some(stop=>stop.id===row.data.stopId)))throw moduleError('אין להסיר נקודת חלוקה שנבחרה בהזמנה פעילה.',409);
   return store.set('route',old.key,{...old.data,changeProposal:{id:secret(),proposed,reason:text(b.reason,5,300),noticeReference:text(b.noticeReference,5,200),proposedAt:Date.now(),proposedBy:actor.username}},old.revision);
  });await store.audit('delivery.route.updated',actor,result.key,{proposalId:result.data.changeProposal?.id||null});return json({route:routeDto(result,actor.role)});
 }
 const state=path.match(/^\/delivery\/routes\/([a-z0-9-]+)\/state$/);
 if(state&&method==='POST'){
  requireRole(actor,['admin','manager']);const b=await body();const result=await db.transaction(async()=>{
   const row=await getRoute(state[1]);if(b.revision!==row.revision)throw moduleError('המסלול השתנה. רעננו לפני ביצוע הפעולה.',409);
   const data={...row.data},status=data.state||'published',rows=await orders(row.key),progress=routeProgress(data,rows.map(r=>({...r.data,orderId:r.key})));
   if(b.action==='apply-change'){
    if(!data.changeProposal)throw moduleError('אין הצעת שינוי להחלה.');if(rows.filter(needsConsent).some(r=>r.data.routeChangeConsent?.proposalId!==data.changeProposal.id))throw moduleError('חסרות הסכמות לקוחות. השינוי לא הוחל.',409);
    Object.assign(data,data.changeProposal.proposed,{changeAppliedAt:Date.now(),changeProposal:null});if(status==='ready')data.departureDecision={...data.departureDecision,requiresReview:true};
   }else if(b.action==='discard-change'){data.changeProposal=null}
   else if(b.action==='publish'&&status==='draft'){if(Date.parse(data.closeAt)<=Date.now())throw moduleError('מועד הסגירה חלף. ערכו את הטיוטה תחילה.');data.state='published';data.publishedAt=Date.now()}
   else if(b.action==='close'&&status==='published')data.state='closed';
   else if(b.action==='ready'&&['published','closed','ready'].includes(status)){
    if(data.changeProposal)throw moduleError('יש לטפל בהצעת השינוי לפני החלטת יציאה.',409);
    if(progress.sales<data.activationCents&&b.overrideMinimum!==true)throw moduleError('ההזמנות המאומתות אינן עומדות בסף. אפשר לבטל או לאשר יציאה חריגה מנומקת.',409);
    data.state='ready';data.departureDecision={at:Date.now(),by:actor.username,salesAtDecisionCents:progress.sales,minimumCents:data.activationCents,requiresReview:false,override:progress.sales<data.activationCents,reason:progress.sales<data.activationCents?text(b.reason,10,300):'',eligibleOrderIds:progress.eligible.map(o=>o.orderId).filter(Boolean)};
   }else if(b.action==='dispatch'&&status==='ready'){
    if(data.changeProposal||data.departureDecision?.requiresReview||!data.departureDecision)throw moduleError('החלטת היציאה דורשת בדיקה מחדש.',409);
    if(progress.sales<data.activationCents&&!data.departureDecision.override)throw moduleError('הסף השתנה. אשרו מחדש את החלטת היציאה.',409);
    data.state='dispatched';data.dispatchedAt=Date.now();data.departureDecision={...data.departureDecision,lockedAt:Date.now()};
    for(const order of rows.filter(r=>r.data.payment?.verifiedAt&&r.data.status==='confirmed'))await store.set('groupOrder',order.key,{...order.data,status:'out_for_delivery',timeline:[...order.data.timeline,{status:'out_for_delivery',at:Date.now()}]},order.revision);
   }else if(b.action==='completed'&&status==='dispatched'){
    if(rows.some(r=>r.data.payment?.verifiedAt&&!['collected','cancelled','returned'].includes(r.data.status)))throw moduleError('יש משלוחים בתשלום שטרם נמסרו או הוחזרו.',409);
    data.state='completed';data.completedAt=Date.now();for(const order of rows.filter(r=>r.data.status==='awaiting_payment_verification'))await cancelOrder(order,'route_completed');
   }else if(b.action==='cancel'&&!['completed','cancelled'].includes(status)){
    if(b.confirmed!==true)throw moduleError('יש לאשר ביטול מסלול וטיפול בזיכויים.');data.cancelReason=text(b.reason,5,300);data.state='cancelled';data.cancelledAt=Date.now();data.changeProposal=null;
    for(const order of rows.filter(r=>!['collected','cancelled'].includes(r.data.status)))await cancelOrder(order,'route_cancelled');
   }else throw moduleError('הפעולה אינה מתאימה למצב המסלול.',409);
   return store.set('route',row.key,data,row.revision);
  });await store.audit('delivery.route.'+b.action,actor,result.key,{state:result.data.state});return json({route:routeDto(result,actor.role)});
 }
 return null;
}
