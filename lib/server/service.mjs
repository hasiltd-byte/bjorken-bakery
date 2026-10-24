import {adjustProductStock} from '../modules/orders/stock.mjs';
import {expireRequests,quoteFromInput} from '../modules/orders/lifecycle.mjs';
import {safeOrder} from '../modules/orders/core.mjs';
import {ownerAuth,strongPassword,passwordFields,verifyPassword} from './auth.mjs';
import {consumeTotp} from './totp.mjs';
import {siteOrigin} from '../modules/pwa/profile.mjs';
import {couponForOrder} from '../modules/club/service.mjs';
import {scopedStore} from '../modules/core/store.mjs';
import {requireFeature} from '../modules/core/registry.mjs';
import {createModuleService} from '../modules/service.mjs';
import {hash,secret} from '../modules/core/validation.mjs';
import {transitionLiveOrder,orderScope} from '../modules/orders/core.mjs';
import {randomBytes,createHash,timingSafeEqual,randomUUID,scryptSync} from 'node:crypto';
import {connectDatabase} from './database.mjs';
import {createProducts,publicProducts} from './products.mjs';
import {productImage} from '../../shared/images.mjs';
import {settings as defaults,seedProducts} from '../../shared/catalog.mjs';
import {requestTimeAllowed,validDate} from '../../shared/schedule.mjs';
import {israelDate,normalizedPhone,liveReady,orderMessage,statuses} from '../../shared/order.mjs';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const equal=(a,b)=>timingSafeEqual(createHash('sha256').update(String(a)).digest(),createHash('sha256').update(String(b)).digest());
export async function createService(options={}){
 const businessId=options.businessId||'bjorken';
 const totpSecret=()=>Object.hasOwn(options,'totpSecret')?options.totpSecret:process.env.BJORKEN_ADMIN_TOTP_SECRET;
 const db=await connectDatabase(options);await db.initialize(seedProducts);
 // Import only public contact fields once; never infer WhatsApp verification or owner approval.
 await db.transaction(async()=>{if(!await db.one('Config',{key:'publicContactV1'})){const stored=JSON.parse(await db.getConfig('business','{}'));for(const key of ['phone','whatsapp','email','mapQuery','navigation','contactSource'])if(!stored[key])stored[key]=defaults[key];stored.revision=(stored.revision||0)+1;await db.setConfig('business',JSON.stringify(stored));await db.setConfig('publicContactV1','imported')}});
 const rates=new Map();
 async function config(){return {...defaults, ...JSON.parse(await db.getConfig('business','{}'))}}
 function rate(key,max=30){const now=Date.now();for(const [k,v] of rates)if(v.until<now)rates.delete(k);const r=rates.get(key)||{count:0,until:now+900000};rates.set(key,r);if(++r.count>max)throw fail('יותר מדי ניסיונות. נסו שוב בעוד מספר דקות.',429)}
 async function body(req,max=128000,raw=false){if(Number(req.headers.get('content-length'))>max)throw fail('הקובץ גדול מדי.',413);const chunks=[];let size=0;for await(const chunk of req.body||[]){size+=chunk.length;if(size>max)throw fail('הבקשה גדולה מדי.',413);chunks.push(chunk)}const bytes=Buffer.concat(chunks);if(raw)return bytes;try{return (()=>{const parsed=JSON.parse(bytes.toString());if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();return parsed})()}catch{throw fail('בקשה לא תקינה.')}}
 const cookie=req=>(req.headers.get('cookie')||'').match(/(?:^|;\s*)bjorken_staff=([a-f0-9]{64})/)?.[1];
 async function staff(req,allowed=['admin','manager']){const token=cookie(req),session=token?await db.one('StaffSession',{token,expiresAt:{$gt:new Date()}}):null;if(!session||session.businessId&&session.businessId!==businessId)throw fail('יש להתחבר לממשק הניהול.',401);if(session.mustChangePassword&&!new URL(req.url).pathname.startsWith('/order/api/security'))throw fail('יש להחליף סיסמה דרך מסך אבטחת החשבון לפני המשך עבודה.',428);const role=session.role||'admin';if(role==='admin'&&totpSecret()&&(!session.mfaVerified||session.mfaKeyId!==createHash('sha256').update(totpSecret()).digest('hex')))throw fail('יש להתחבר מחדש עם קוד אימות דו־שלבי.',401);if(!allowed.includes(role))throw fail('אין הרשאה לפעולה זו.',403);return {token,role,username:session.username||'owner',businessId,mustChangePassword:!!session.mustChangePassword}}
 // Next.js authenticates and validates uploads; Cloudinary stores image bytes.
 async function products(req,path){let result;const handler=createProducts({db,readBody:(_r,max,raw)=>body(req,max,raw),response:(_r,status,data)=>{result=Response.json(data,{status})},fail,imageUploader:options.imageUploader,cloudName:options.cloudName||process.env.CLOUDINARY_CLOUD_NAME});const yes=await handler.handle({method:req.method},{},path);return yes?result:null}
 const ownerUsername=options.username||process.env.BJORKEN_ADMIN_USERNAME;
 const verifyOwner=async password=>{const stored=await ownerAuth(db,businessId);return stored?verifyPassword(password,stored):equal(password,options.password||process.env.BJORKEN_ADMIN_PASSWORD)};
 const modules=createModuleService({db,businessId,ownerUsername,verifyOwner,body,publicReady:async()=>liveReady(await config()),actor:req=>staff(req,['admin','manager','cashier','kitchen','driver']),rate});
 async function handle(req){try{
 const url=new URL(req.url),path=url.pathname.replace(/^\/order\/api/,'/api');
 const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 if(!['GET','HEAD'].includes(req.method)){const origin=req.headers.get('origin'),host=req.headers.get('host')||url.host;if(origin&&(new URL(origin).host!==host||!['http:','https:'].includes(new URL(origin).protocol)))throw fail('מקור בקשה לא מורשה.',403);if(req.headers.get('sec-fetch-site')==='cross-site')throw fail('מקור בקשה לא מורשה.',403)}
 if(url.searchParams.get('space')!=='demo'&&path!=='/api/modules/demo')await expireRequests(db,businessId);
 const moduleResponse=await modules.handle(req,path);if(moduleResponse)return moduleResponse;
 if(path==='/api/menu'&&req.method==='GET'){const s=await config();return json({products:(await publicProducts(db)).filter(p=>!p.hidden),settings:s,live:liveReady(s),connected:true})}
 if(path==='/api/login'&&req.method==='POST'){
  rate('login',200);rate('login:'+ (req.headers.get('x-forwarded-for')||'local'),10);
  const username=options.username||process.env.BJORKEN_ADMIN_USERNAME,password=options.password||process.env.BJORKEN_ADMIN_PASSWORD;
  if(!username||!password)throw fail('יש להגדיר פרטי מנהל חדשים בשרת.',503);
  const b=await body(req);if(typeof b.username!=='string'||typeof b.password!=='string'||b.username.length>100||b.password.length>200)throw fail('פרטי הכניסה אינם נכונים.',401);let role='admin',mustChangePassword=false;if(!equal(b.username,username)||!await verifyOwner(b.password)){const user=await db.one('StaffUser',{businessId,username:b.username,active:true});if(!user||!verifyPassword(b.password,user))throw fail('פרטי הכניסה אינם נכונים.',401);role=user.role;mustChangePassword=!!user.mustChangePassword||!strongPassword(b.password)}else mustChangePassword=!strongPassword(b.password);
  if(role==='admin'&&totpSecret())await consumeTotp(db,businessId,totpSecret(),b.otp);
  const token=randomBytes(32).toString('hex');await db.create('StaffSession',{token,businessId,role,username:b.username,mustChangePassword,mfaVerified:role==='admin'&&!!totpSecret(),mfaKeyId:role==='admin'&&totpSecret()?createHash('sha256').update(totpSecret()).digest('hex'):null,expiresAt:new Date(Date.now()+12*3600000)});
  return Response.json({ok:true,mustChangePassword},{headers:{'Set-Cookie':`bjorken_staff=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${url.protocol==='https:'?'; Secure':''}`,'Cache-Control':'no-store'}})
 }
 if(path==='/api/logout'&&req.method==='POST'){await db.remove('StaffSession',{token:cookie(req)||''});return Response.json({ok:true},{headers:{'Set-Cookie':'bjorken_staff=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'}})}
 if(path.startsWith('/api/security')){
  const who=await staff(req,['admin','manager','cashier','kitchen','driver']);
  if(path==='/api/security'&&req.method==='GET')return json({username:who.username,role:who.role,mustChangePassword:who.mustChangePassword,passwordMinimumLength:12,mfaStatus:totpSecret()?'enabled':'not_configured'});
  if(path==='/api/security/password'&&req.method==='POST'){
   rate('password:'+who.username,5);const b=await body(req);const fields=passwordFields(b.newPassword);
   await db.transaction(async()=>{const valid=who.role==='admin'?await verifyOwner(b.currentPassword):verifyPassword(b.currentPassword,await db.one('StaffUser',{businessId,username:who.username,active:true}));if(!valid)throw fail('הסיסמה הנוכחית שגויה.',403);if(b.currentPassword===b.newPassword)throw fail('בחרו סיסמה חדשה.');if(who.role==='admin')await db.setConfig('hasi:'+businessId+':ownerAuth',JSON.stringify({...fields,changedAt:Date.now()}));else await db.update('StaffUser',{businessId,username:who.username},{$set:{...fields,mustChangePassword:false}});await db.removeMany('StaffSession',{businessId,username:who.username});await scopedStore(db,businessId,'live').audit('security.password.changed',who,who.username)});
   return Response.json({ok:true,message:'הסיסמה הוחלפה וכל החיבורים נותקו. התחברו מחדש.'},{headers:{'Set-Cookie':'bjorken_staff=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0','Cache-Control':'no-store'}});
  }throw fail('פעולה לא נמצאה.',404);
 }
 if(path.startsWith('/api/admin')){
  await staff(req);
  if(path==='/api/admin/images'&&req.method==='POST')rate('images:'+cookie(req),40);
  const productResponse=await products(req,path);if(productResponse)return productResponse;
  if(path==='/api/admin/settings'&&req.method==='GET')return json({settings:await config(),liveEnabled:process.env.BJORKEN_ENABLE_LIVE==='true'});
  if(path==='/api/admin/settings'&&req.method==='PATCH'){
   const b=await body(req),s={...defaults};
   for(const k of ['name','headline','description','address','weekdayHours','fridayHours','saturdayHours','pickupDate','closeAt','whatsapp','phone','banner','instagram','navigation','heroImage','email','mapQuery','contactSource']){if(typeof b[k]!=='string'||b[k].length>1000)throw fail('שדה הגדרות לא תקין.');s[k]=b[k].trim()}
   for(const k of ['ordersOpen','whatsappVerified','ownerApproved','imagesApproved','catalogApproved']){if(typeof b[k]!=='boolean')throw fail('אישור חסר.');s[k]=b[k]}
   s.requestHoldMinutes=b.requestHoldMinutes??defaults.requestHoldMinutes;if(!Number.isInteger(s.requestHoldMinutes)||s.requestHoldMinutes<5||s.requestHoldMinutes>1440)throw fail('תוקף בקשה חייב להיות 5–1440 דקות.');
   s.deliveryEnabled=b.deliveryEnabled??false;s.deliveryFee=b.deliveryFee??null;s.deliveryNote=b.deliveryNote??defaults.deliveryNote;if(typeof s.deliveryEnabled!=='boolean'||typeof s.deliveryNote!=='string'||s.deliveryNote.length>500||s.deliveryFee!==null&&(typeof s.deliveryFee!=='number'||!Number.isFinite(s.deliveryFee)||s.deliveryFee<0||s.deliveryFee>10000||Math.abs(s.deliveryFee*100-Math.round(s.deliveryFee*100))>1e-6))throw fail('הגדרות משלוח אינן תקינות.');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(s.pickupDate)||!Number.isFinite(Date.parse(s.pickupDate+'T12:00:00Z'))||new Date(s.pickupDate+'T12:00:00Z').toISOString().slice(0,10)!==s.pickupDate)throw fail('תאריך איסוף לא תקין.');
   if(s.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email))throw fail('כתובת מייל לא תקינה.');
   if(!Array.isArray(b.weeklyPickup)||b.weeklyPickup.length!==7||new Set(b.weeklyPickup.map(h=>h.day)).size!==7||b.weeklyPickup.some(h=>!Number.isInteger(h.day)||h.day<0||h.day>6||typeof h.enabled!=='boolean'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(h.open)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(h.close)||h.open>=h.close))throw fail('בדקו את שעות האיסוף השבועיות.');s.weeklyPickup=b.weeklyPickup.map(({day,enabled,open,close})=>({day,enabled,open,close}));
   if(!Array.isArray(b.blockedDates)||b.blockedDates.length>366||b.blockedDates.some(d=>!validDate(d)))throw fail('תאריכים חסומים אינם תקינים.');s.blockedDates=[...new Set(b.blockedDates)];
   if(!Array.isArray(b.pickupSlots)||!b.pickupSlots.length||b.pickupSlots.length>48||b.pickupSlots.some(x=>typeof x!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(x)))throw fail('חלונות איסוף לא תקינים.');s.pickupSlots=[...new Set(b.pickupSlots)].sort();
   if(!Number.isInteger(b.capacity)||b.capacity<1||b.capacity>10000)throw fail('מכסת הזמנות לא תקינה.');s.capacity=b.capacity;
   if(s.closeAt&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/.test(s.closeAt)||!Number.isFinite(Date.parse(s.closeAt))))throw fail('מועד סגירה חייב לכלול אזור זמן.');
   for(const k of ['navigation','instagram','contactSource'])if(s[k]){try{if(new URL(s[k]).protocol!=='https:')throw 0}catch{throw fail('קישור חייב להתחיל ב-https.')}}
   if(!productImage(s.heroImage,options.cloudName||process.env.CLOUDINARY_CLOUD_NAME))throw fail('בחרו תמונה שהועלתה לאתר או ל־Cloudinary של העסק.');
   if(s.whatsappVerified&&!normalizedPhone(s.whatsapp))throw fail('יש להזין מספר WhatsApp נייד תקין.');
   await db.transaction(async()=>{const old=await config();if(b.revision!==old.revision)throw fail('ההגדרות השתנו. רעננו ונסו שוב.',409);if(old.whatsapp!==s.whatsapp)s.whatsappVerified=false;s.revision=old.revision+1;await db.setConfig('business',JSON.stringify(s))});return json({settings:s})
  }
  if(path==='/api/admin/orders'&&req.method==='GET')return json({orders:(await db.find('Order',orderScope(businessId), {created_at:-1},500)).map(o=>safeOrder(o,'admin'))});
  if(path==='/api/admin/maintenance/expire'&&req.method==='POST')return json({expired:await expireRequests(db,businessId)});
  const quoteMatch=path.match(/^\/api\/admin\/orders\/([a-f0-9-]+)\/quote$/);
  if(quoteMatch&&req.method==='PATCH'){
   if(!liveReady(await config()))throw fail('האתר במצב Preview. לא ניתן לאשר מחיר להזמנה אמיתית.',403);
   const b=await body(req),who=await staff(req);const order=await db.transaction(async()=>{const old=await db.one('Order',{id:quoteMatch[1],...orderScope(businessId)});if(!old)throw fail('הבקשה לא נמצאה.',404);if(b.updated_at!==old.updated_at)throw fail('הבקשה השתנתה. רעננו.',409);const finalQuote=quoteFromInput(old,b,who);return db.update('Order',{id:old.id},{$set:{finalQuote,updated_at:Math.max(Date.now(),old.updated_at+1)}})});
   await scopedStore(db,businessId,'live').audit('order.quote',who,order.id,{version:order.finalQuote.version});return json({order:safeOrder(order,'admin')});
  }
  const match=path.match(/^\/api\/admin\/orders\/([a-f0-9-]+)$/);
  if(match&&req.method==='PATCH'){
   if(!liveReady(await config()))throw fail('האתר במצב Preview. עדכון הזמנה אמיתית חסום.',403);
   const b=await body(req);if(!statuses.includes(b.status)||typeof b.priceConfirmed!=='boolean'||typeof b.availabilityConfirmed!=='boolean')throw fail('סטטוס לא תקין.');
   const result=await transitionLiveOrder(db,businessId,match[1],b,await staff(req));return json({order:result})
  }
 }
 if(path==='/api/requests'&&req.method==='POST'){
  rate('requests',200);rate('request:'+(req.headers.get('x-forwarded-for')||'local'),30);
  const b=await body(req);if(typeof b.nonce!=='string'||!/^[a-f0-9-]{36}$/.test(b.nonce))throw fail('מזהה בקשה לא תקין.');
  if(typeof b.name!=='string'||b.name.trim().length<2||b.name.length>60||!normalizedPhone(b.phone)||typeof b.notes!=='string'||b.notes.length>500||b.acknowledged!==true)throw fail('בדקו שם, טלפון ואישור תנאי הבקשה.');
  b.kind ||= 'takeaway';
  if(!['takeaway','event','delivery'].includes(b.kind)||b.kind==='event'&&(!Number.isInteger(b.guests)||b.guests<1||b.guests>10000||b.notes.trim().length<5))throw fail('יש למלא מספר משתתפים ותיאור קצר לאירוע.');
  if(!Array.isArray(b.items)||(b.kind!=='event'&&!b.items.length)||b.items.length>40||b.items.some(x=>!x||typeof x.id!=='string')||new Set(b.items.map(x=>x.id)).size!==b.items.length)throw fail('סל לא תקין.');
  const result=await db.transaction(async()=>{
   const s=await config();if(!liveReady(s))throw fail('האתר במצב Preview. לא נשלחות בקשות אמיתיות.',403);
   if(!requestTimeAllowed(s,b.date,b.pickup,b.kind))throw fail(b.kind==='event'?'בחרו תאריך ושעה עתידיים תקינים לבקשת האירוע.':'מועד האיסוף אינו זמין.');
   if(b.kind==='delivery'&&(!s.deliveryEnabled||typeof b.deliveryAddress!=='string'||b.deliveryAddress.trim().length<8||b.deliveryAddress.length>300))throw fail('משלוח דורש אישור עסק וכתובת מלאה.');
   const fingerprint=JSON.stringify({name:b.name.trim(),phone:normalizedPhone(b.phone),date:b.date,pickup:b.pickup,notes:b.notes,kind:b.kind,guests:b.kind==='event'?b.guests:null,deliveryAddress:b.kind==='delivery'?b.deliveryAddress.trim():null,coupon:b.coupon||'',items:b.items});
   const previous=await db.one('Order',{nonce:b.nonce,...orderScope(businessId)});if(previous){if(previous.payload.fingerprint!==fingerprint)throw fail('מזהה הבקשה כבר בשימוש.',409);if(previous.status==='expired')throw fail('תוקף הבקשה פג והמלאי שוחרר. התחילו בקשה חדשה.',410);return {order:previous,s}}
   if(await db.count('Order',{...orderScope(businessId),'payload.date':b.date,status:{$nin:['cancelled','declined','expired']}})>=s.capacity)throw fail('מכסת הבקשות מלאה.');
   const items=[];for(const line of b.items){const p=await db.one('MenuItem',{id:line.id,deleted:{$ne:true},hidden:{$ne:true},available:true});if(!p||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>p.maxPerOrder||p.stock!==null&&p.stock<line.quantity)throw fail('כמות או זמינות השתנו. רעננו את התפריט.',409);items.push({id:p.id,name:p.name,price:p.salePrice??p.price,quantity:line.quantity});await adjustProductStock(db,p.id,-line.quantity)}
   let coupon=null;if(b.coupon){requireFeature(await modules.grants(),'club','live');const store=scopedStore(db,businessId,'live');coupon=await couponForOrder(store,b.coupon,items);await store.set('coupon',coupon.code,{...coupon.row.data,used:coupon.row.data.used+1},coupon.row.revision)}
   const trackingToken=secret();const order=await db.create('Order',{businessId,expiresAt:Date.now()+(s.requestHoldMinutes??30)*60000,trackingToken,trackingHash:hash(trackingToken),timeline:[{status:'pending_confirmation',at:Date.now(),actor:'customer'}],id:randomUUID(),nonce:b.nonce,payload:{name:b.name.trim(),phone:normalizedPhone(b.phone),date:b.date,pickup:b.pickup,notes:b.notes,kind:b.kind,guests:b.kind==='event'?b.guests:null,deliveryAddress:b.kind==='delivery'?b.deliveryAddress.trim():null,deliveryFee:b.kind==='delivery'?s.deliveryFee:null,items,fingerprint,...(coupon?{coupon:coupon.code,discountCents:coupon.discountCents}:{})},status:'pending_confirmation',created_at:Date.now(),updated_at:Date.now(),payment:'at_pickup',priceConfirmed:false,availabilityConfirmed:false,reserved:items.length>0});return {order,s}
  });return json({id:result.order.id,status:result.order.status,...(result.order.trackingToken?{trackingUrl:'/track/'+result.order.trackingToken}:{}),whatsappUrl:'https://wa.me/'+normalizedPhone(result.s.whatsapp)+'?text='+encodeURIComponent(orderMessage(result.order.payload)+(result.order.trackingToken?'\nמעקב אחר הבקשה: '+siteOrigin(req)+'/track/'+result.order.trackingToken:''))},201)
 }
 const media=path.match(/^\/order\/media\/([a-f0-9-]+\.jpg)$/);if(media&&req.method==='GET'){const file=await db.video(media[1]);if(!file)throw fail('תמונה לא נמצאה.',404);const {Readable}=await import('node:stream');return new Response(Readable.toWeb(db.videoStream(file._id)),{headers:{'Content-Type':'image/jpeg','Cache-Control':'public,max-age=31536000,immutable'}})}
 throw fail('הפעולה לא נמצאה.',404);
 }catch(e){return Response.json({error:e.status?e.message:'שירות הנתונים אינו זמין כרגע.'},{status:e.status||503,headers:{'Cache-Control':'no-store'}})}}
 const maintenance=setInterval(()=>expireRequests(db,businessId).catch(()=>{}),60000);maintenance.unref();
 return {handle,db,close:()=>{clearInterval(maintenance);return db.close()}};
}
