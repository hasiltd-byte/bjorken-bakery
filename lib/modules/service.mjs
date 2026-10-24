import {randomUUID,scryptSync,randomBytes} from 'node:crypto';
import {scopedStore} from './core/store.mjs';
import {registry,businessPresets,featureState,moduleError,requireRole,roles,spaceFrom} from './core/registry.mjs';
import {text,dateTime,secret,hash} from './core/validation.mjs';
import {israelDate} from '../../shared/schedule.mjs';
import {seedProducts} from '../../shared/catalog.mjs';
import {publicTracking} from './orders/core.mjs';
import {hasAgreedFinalQuote} from './orders/lifecycle.mjs';
import {passwordFields} from '../server/auth.mjs';
import {ordersRoutes} from './orders/service.mjs';
import {deliveryRoutes} from './delivery/service.mjs';
import {clubRoutes} from './club/service.mjs';
import {reportsRoutes} from './reports/service.mjs';
import {paymentProvider,notificationProvider,routingProvider} from './adapters/providers.mjs';
export function createModuleService({db,businessId,ownerUsername,verifyOwner,body,actor,rate,publicReady}){
 const live=scopedStore(db,businessId,'live');
 async function grants(space='live'){return JSON.parse(await db.getConfig('hasi:'+businessId+':'+(space==='demo'?'demoLicenses':'licenses'),'{}'))}
 return {grants,async handle(req,path){
  if(path.startsWith('/api/tracking/')){
   const match=path.match(/^\/api\/tracking\/([a-f0-9]{48})(\/consent)?$/),ip=req.headers.get('x-forwarded-for')||'local';rate('tracking-ip:'+ip,2400);if(!match)throw moduleError('קישור לא נמצא.',404);rate('tracking:'+hash(match[1])+':'+ip,240);
   let order=await db.one('Order',{businessId,trackingHash:hash(match[1])});if(!order)throw moduleError('קישור לא נמצא.',404);
   if(match[2]&&req.method==='POST'){if(!await publicReady())throw moduleError('האתר במצב Preview. אין אישורי הזמנה אמיתיים.',403);const b=await body(req);order=await db.transaction(async()=>{const current=await db.one('Order',{id:order.id,businessId});if(current.status!=='pending_confirmation'||!current.finalQuote||b.version!==current.finalQuote.version||b.agreed!==true)throw moduleError('המחיר השתנה או שהבקשה אינה ממתינה לאישור.',409);return db.update('Order',{id:current.id},{$set:{finalQuote:{...current.finalQuote,customerAgreedAt:Date.now(),agreementSource:'customer_tracking_link',agreementReference:null},updated_at:Math.max(Date.now(),current.updated_at+1)}})});await live.audit('order.customer-price-agreement',null,order.id,{version:order.finalQuote.version})}
   else if(req.method!=='GET'||match[2])throw moduleError('פעולה לא נמצאה.',404);
   return Response.json(publicTracking(order),{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})
  }
  if(!path.startsWith('/api/modules/'))return null;
  const url=new URL(req.url),sub=path.slice('/api/modules'.length),space=spaceFrom(url),store=scopedStore(db,businessId,space),licenses=await grants(space),json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}}),ready=space==='demo'||await publicReady();
  const features=Object.fromEntries(Object.keys(registry).map(key=>[key,{...featureState(licenses,key,space),allowed:ready&&featureState(licenses,key,space).allowed}]));
  if(sub==='/public/features'&&req.method==='GET')return json({features,space,siteMode:space==='demo'?'demo':ready?'live':'preview'});
  const essential=sub.startsWith('/public/delivery-track/')||sub.startsWith('/public/club/manage/');
  if(!ready&&sub.startsWith('/public/')&&!essential)throw moduleError('האתר במצב Preview. השירות אינו פתוח לפעולות אמיתיות.',403);
  if(!ready&&!['GET','HEAD'].includes(req.method)&&/^\/(orders|food|delivery|club|reviews)(\/|$)/.test(sub))throw moduleError('האתר במצב Preview. פעולות נתוני העסק חסומות.',403);
  const who=sub.startsWith('/public/')?null:await actor(req);if(who)requireRole(who,roles);
  const catalog=async()=>space==='demo'?(await store.list('product')).map(r=>r.data):db.find('MenuItem',{deleted:{$ne:true},hidden:{$ne:true}},{sortOrder:1});
  const ctx={db,store,space,businessId,grants:licenses,ready,actor:who,method:req.method,body:()=>body(req),json,catalog,rate,request:req};
  if(sub==='/me'&&req.method==='GET')return json({actor:{username:who.username,role:who.role},businessId,space,siteMode:space==='demo'?'demo':ready?'live':'preview',features,providers:{payment:paymentProvider.status,notifications:notificationProvider.status,routing:routingProvider.status},profiles:businessPresets});
  if(sub==='/licenses'&&req.method==='PATCH'){
   if(space==='demo')throw moduleError('אין לשנות רישיון עסק מתוך הדגמה.',403);
   requireRole(who,['admin']);const b=await body(req);if(!registry[b.feature]||registry[b.feature].base||!['demo','trial','active','expired','disabled'].includes(b.status))throw moduleError('רישיון לא תקין.');
   const grant={status:b.status,reference:text(b.reference||'',b.status==='demo'?0:4,200),expiresAt:b.expiresAt?dateTime(b.expiresAt):null,grantedBy:who.username,updatedAt:Date.now()};
   if(['trial','active'].includes(b.status)&&(!grant.expiresAt||Date.parse(grant.expiresAt)<=Date.now()||b.acknowledged!==true))throw moduleError('הפעלה דורשת מועד תוקף עתידי ואישור ידני מפורש.');
   await db.transaction(async()=>{const current=await grants();current[b.feature]=grant;await db.setConfig('hasi:'+businessId+':licenses',JSON.stringify(current));await live.audit('license.changed',who,b.feature,grant)});return json({ok:true});
  }
  if(sub==='/demo'&&req.method==='POST'){
   requireRole(who,['admin']);await db.transaction(async()=>{const current=Object.fromEntries(Object.keys(registry).filter(name=>!registry[name].base).map(name=>[name,{status:'demo'}]));await db.setConfig('hasi:'+businessId+':demoLicenses',JSON.stringify(current));const demo=scopedStore(db,businessId,'demo');
    for(const p of seedProducts.slice(0,3))if(!await demo.get('product',p.id))await demo.add('product',{...p,name:p.name+' · דוגמה',price:20,salePrice:null,stock:12},p.id);
    if(!(await demo.list('order')).length)for(const [i,status]of ['pending_confirmation','confirmed','preparing'].entries()){const now=Date.now(),id=randomUUID();await demo.add('order',{id,status,updated_at:now,created_at:now,priceConfirmed:status!=='pending_confirmation',availabilityConfirmed:status!=='pending_confirmation',reserved:true,payload:{name:'לקוח לדוגמה '+(i+1),phone:'0500000000',date:israelDate(),pickup:'10:00',kind:'takeaway',notes:'נתוני הדגמה בלבד',items:[{id:'cinnamon',name:'מאפה לדוגמה',price:20,quantity:2}]},timeline:[{status,at:now}]},id)}
    await demo.audit('demo.opened',who,'pilot');
   });return json({ok:true,space:'demo'});
  }
  if(sub==='/staff'&&req.method==='GET'){requireRole(who,['admin']);const users=space==='demo'?[]:await db.find('StaffUser',{businessId});return json({users:users.map(({username,role,active})=>({username,role,active}))})}
  if(sub==='/staff'&&req.method==='POST'){
   requireRole(who,['admin']);if(space==='demo')throw moduleError('אין ליצור חשבון אמיתי מתוך הדגמה.',403);const b=await body(req),username=text(b.username,3,60),fields=passwordFields(b.password);if(!/^[a-zA-Z0-9_-]+$/.test(username)||!roles.includes(b.role)||b.role==='admin'||username===ownerUsername)throw moduleError('משתמש או תפקיד לא תקינים.');
   await db.transaction(async()=>{if(await db.one('StaffUser',{businessId,username}))throw moduleError('משתמש כבר קיים.',409);await db.create('StaffUser',{_id:randomUUID(),businessId,username,role:b.role,active:true,...fields,mustChangePassword:false});await live.audit('staff.created',who,username,{role:b.role})});return json({ok:true},201);
  }
  const reset=sub.match(/^\/staff\/([a-zA-Z0-9_-]+)\/reset-password$/);
  if(reset&&req.method==='POST'){
   requireRole(who,['admin']);if(space==='demo')throw moduleError('אין לאפס חשבונות אמיתיים מתוך הדגמה.',403);rate('staff-reset:'+who.username,5);const b=await body(req);if(!await verifyOwner(b.ownerPassword))throw moduleError('נדרש אימות מחדש של סיסמת המנהל.',403);const temporaryPassword=randomBytes(18).toString('base64url')+'7!';
   await db.transaction(async()=>{const user=await db.one('StaffUser',{businessId,username:reset[1]});if(!user)throw moduleError('עובד לא נמצא.',404);await db.update('StaffUser',{_id:user._id},{$set:{...passwordFields(temporaryPassword),mustChangePassword:true}});await db.removeMany('StaffSession',{businessId,username:user.username});await live.audit('staff.password.reset',who,user.username)});return json({temporaryPassword,mustChangePassword:true,message:'מסרו את הסיסמה הזמנית לעובד בערוץ מאומת. היא תוצג בתגובה זו בלבד.'});
  }
  const staffChange=sub.match(/^\/staff\/([a-zA-Z0-9_-]+)$/);
  if(staffChange&&req.method==='PATCH'){requireRole(who,['admin']);if(space==='demo')throw moduleError('אין לשנות חשבונות מתוך הדגמה.',403);const b=await body(req);if(b.active!==undefined&&typeof b.active!=='boolean'||b.role!==undefined&&(!roles.includes(b.role)||b.role==='admin')||b.active===undefined&&b.role===undefined)throw moduleError('מצב משתמש או תפקיד אינם תקינים.');await db.transaction(async()=>{const user=await db.one('StaffUser',{businessId,username:staffChange[1]});if(!user)throw moduleError('משתמש לא נמצא.',404);const fields={...(b.active!==undefined?{active:b.active}:{}),...(b.role?{role:b.role}:{})};await db.update('StaffUser',{_id:user._id},{$set:fields});if(b.active===false||b.role&&b.role!==user.role)await db.removeMany('StaffSession',{businessId,username:user.username});await live.audit('staff.status',who,user.username,fields)});return json({ok:true})}
  if(sub==='/catalog'&&req.method==='GET')return json({products:await catalog()});
  const orderResponse=await ordersRoutes(ctx,sub);if(orderResponse)return orderResponse;
  const deliveryResponse=await deliveryRoutes(ctx,sub);if(deliveryResponse)return deliveryResponse;
  const clubResponse=await clubRoutes(ctx,sub);if(clubResponse)return clubResponse;
  const reportResponse=await reportsRoutes(ctx,sub);if(reportResponse)return reportResponse;
  throw moduleError('פעולה לא נמצאה.',404);
 }};
}
