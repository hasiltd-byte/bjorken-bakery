import {randomBytes,createHash,timingSafeEqual,randomUUID} from 'node:crypto';
import {connectDatabase} from './database.mjs';
import {createProducts,publicProducts} from './products.mjs';
import {productImage} from '../../shared/images.mjs';
import {settings as defaults,seedProducts} from '../../shared/catalog.mjs';
import {pickupTimes,validDate} from '../../shared/schedule.mjs';
import {israelDate,normalizedPhone,liveReady,orderMessage,statuses} from '../../shared/order.mjs';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const equal=(a,b)=>timingSafeEqual(createHash('sha256').update(String(a)).digest(),createHash('sha256').update(String(b)).digest());
export async function createService(options={}){
 const db=await connectDatabase(options);await db.initialize(seedProducts);
 // Import only public contact fields once; never infer WhatsApp verification or owner approval.
 await db.transaction(async()=>{if(!await db.one('Config',{key:'publicContactV1'})){const stored=JSON.parse(await db.getConfig('business','{}'));for(const key of ['phone','whatsapp','email','mapQuery','navigation','contactSource'])if(!stored[key])stored[key]=defaults[key];stored.revision=(stored.revision||0)+1;await db.setConfig('business',JSON.stringify(stored));await db.setConfig('publicContactV1','imported')}});
 const rates=new Map();
 async function config(){return {...defaults, ...JSON.parse(await db.getConfig('business','{}'))}}
 function rate(key,max=30){const now=Date.now();for(const [k,v] of rates)if(v.until<now)rates.delete(k);const r=rates.get(key)||{count:0,until:now+900000};rates.set(key,r);if(++r.count>max)throw fail('יותר מדי ניסיונות. נסו שוב בעוד מספר דקות.',429)}
 async function body(req,max=128000,raw=false){if(Number(req.headers.get('content-length'))>max)throw fail('הקובץ גדול מדי.',413);const chunks=[];let size=0;for await(const chunk of req.body||[]){size+=chunk.length;if(size>max)throw fail('הבקשה גדולה מדי.',413);chunks.push(chunk)}const bytes=Buffer.concat(chunks);if(raw)return bytes;try{return JSON.parse(bytes.toString())}catch{throw fail('בקשה לא תקינה.')}}
 const cookie=req=>(req.headers.get('cookie')||'').match(/(?:^|;\s*)bjorken_staff=([a-f0-9]{64})/)?.[1];
 async function staff(req){const token=cookie(req);if(!token||!await db.one('StaffSession',{token,expiresAt:{$gt:new Date()}}))throw fail('יש להתחבר לממשק הניהול.',401);return token}
 // Next.js authenticates and validates uploads; Cloudinary stores image bytes.
 async function products(req,path){let result;const handler=createProducts({db,readBody:(_r,max,raw)=>body(req,max,raw),response:(_r,status,data)=>{result=Response.json(data,{status})},fail,imageUploader:options.imageUploader,cloudName:options.cloudName||process.env.CLOUDINARY_CLOUD_NAME});const yes=await handler.handle({method:req.method},{},path);return yes?result:null}
 async function handle(req){try{
 const url=new URL(req.url),path=url.pathname.replace(/^\/order\/api/,'/api');
 const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 if(!['GET','HEAD'].includes(req.method)){const origin=req.headers.get('origin'),host=req.headers.get('host')||url.host;if(origin&&(new URL(origin).host!==host||!['http:','https:'].includes(new URL(origin).protocol)))throw fail('מקור בקשה לא מורשה.',403);if(req.headers.get('sec-fetch-site')==='cross-site')throw fail('מקור בקשה לא מורשה.',403)}
 if(path==='/api/menu'&&req.method==='GET'){const s=await config();return json({products:(await publicProducts(db)).filter(p=>!p.hidden),settings:s,live:liveReady(s),connected:true})}
 if(path==='/api/login'&&req.method==='POST'){
  rate('login',40);rate('login:'+ (req.headers.get('x-forwarded-for')||'local'),10);
  const username=options.username||process.env.BJORKEN_ADMIN_USERNAME,password=options.password||process.env.BJORKEN_ADMIN_PASSWORD;
  if(!username||!password||password.length<16)throw fail('יש להגדיר פרטי מנהל חדשים בשרת.',503);
  const b=await body(req);if(!equal(b.username,username)||!equal(b.password,password))throw fail('פרטי הכניסה אינם נכונים.',401);
  const token=randomBytes(32).toString('hex');await db.create('StaffSession',{token,expiresAt:new Date(Date.now()+12*3600000)});
  return Response.json({ok:true},{headers:{'Set-Cookie':`bjorken_staff=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${url.protocol==='https:'?'; Secure':''}`,'Cache-Control':'no-store'}})
 }
 if(path==='/api/logout'&&req.method==='POST'){await db.remove('StaffSession',{token:cookie(req)||''});return Response.json({ok:true},{headers:{'Set-Cookie':'bjorken_staff=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'}})}
 if(path.startsWith('/api/admin')){
  await staff(req);
  if(path==='/api/admin/images'&&req.method==='POST')rate('images:'+cookie(req),40);
  const productResponse=await products(req,path);if(productResponse)return productResponse;
  if(path==='/api/admin/settings'&&req.method==='GET')return json({settings:await config(),liveEnabled:process.env.BJORKEN_ENABLE_LIVE==='true'});
  if(path==='/api/admin/settings'&&req.method==='PATCH'){
   const b=await body(req),s={...defaults};
   for(const k of ['name','headline','description','address','weekdayHours','fridayHours','saturdayHours','pickupDate','closeAt','whatsapp','phone','banner','instagram','navigation','heroImage','email','mapQuery','contactSource']){if(typeof b[k]!=='string'||b[k].length>1000)throw fail('שדה הגדרות לא תקין.');s[k]=b[k].trim()}
   for(const k of ['ordersOpen','whatsappVerified','ownerApproved','imagesApproved','catalogApproved']){if(typeof b[k]!=='boolean')throw fail('אישור חסר.');s[k]=b[k]}
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
  if(path==='/api/admin/orders'&&req.method==='GET')return json({orders:await db.find('Order',{}, {created_at:-1},500)});
  const match=path.match(/^\/api\/admin\/orders\/([a-f0-9-]+)$/);
  if(match&&req.method==='PATCH'){
   const b=await body(req);if(!statuses.includes(b.status)||typeof b.priceConfirmed!=='boolean'||typeof b.availabilityConfirmed!=='boolean')throw fail('סטטוס לא תקין.');
   const result=await db.transaction(async()=>{const order=await db.one('Order',{id:match[1]});if(!order)throw fail('בקשה לא נמצאה.',404);if(b.updated_at!==order.updated_at)throw fail('הבקשה השתנתה. רעננו.',409);if(['collected','declined','cancelled'].includes(order.status)&&b.status!==order.status)throw fail('בקשה שהסתיימה לא נפתחת מחדש.');
    const transitions={pending_confirmation:['confirmed','declined','cancelled'],confirmed:['preparing','cancelled'],preparing:['ready','cancelled'],ready:['collected','cancelled'],collected:[],declined:[],cancelled:[]};
    if(b.status!==order.status&&!transitions[order.status].includes(b.status))throw fail('מעבר סטטוס לא מורשה.');
    if(['confirmed','preparing','ready','collected'].includes(b.status)&&(!b.priceConfirmed||!b.availabilityConfirmed))throw fail('יש לאשר מול הלקוח מחיר וזמינות לפני קידום הבקשה.');
    if(order.reserved&&['declined','cancelled'].includes(b.status)){for(const item of order.payload.items)await db.update('MenuItem',{id:item.id,stock:{$ne:null}},{$inc:{stock:item.quantity}});order.reserved=false}
    return db.update('Order',{id:order.id},{$set:{status:b.status,priceConfirmed:b.priceConfirmed,availabilityConfirmed:b.availabilityConfirmed,reserved:order.reserved,updated_at:Date.now()}})
   });return json({order:result})
  }
 }
 if(path==='/api/requests'&&req.method==='POST'){
  rate('requests',200);rate('request:'+(req.headers.get('x-forwarded-for')||'local'),30);
  const b=await body(req);if(typeof b.nonce!=='string'||!/^[a-f0-9-]{36}$/.test(b.nonce))throw fail('מזהה בקשה לא תקין.');
  if(typeof b.name!=='string'||b.name.trim().length<2||b.name.length>60||!normalizedPhone(b.phone)||typeof b.notes!=='string'||b.notes.length>500||b.acknowledged!==true)throw fail('בדקו שם, טלפון ואישור תנאי הבקשה.');
  b.kind ||= 'takeaway';
  if(!['takeaway','event'].includes(b.kind)||b.kind==='event'&&(!Number.isInteger(b.guests)||b.guests<1||b.guests>10000||b.notes.trim().length<5))throw fail('יש למלא מספר משתתפים ותיאור קצר לאירוע.');
  if(!Array.isArray(b.items)||(b.kind==='takeaway'&&!b.items.length)||b.items.length>40||b.items.some(x=>!x||typeof x.id!=='string')||new Set(b.items.map(x=>x.id)).size!==b.items.length)throw fail('סל לא תקין.');
  const result=await db.transaction(async()=>{
   const s=await config();if(!liveReady(s))throw fail('האתר במצב Preview. לא נשלחות בקשות אמיתיות.',403);
   if(!pickupTimes(s,b.date).includes(b.pickup))throw fail('מועד האיסוף אינו זמין.');
   const fingerprint=JSON.stringify({name:b.name.trim(),phone:normalizedPhone(b.phone),date:b.date,pickup:b.pickup,notes:b.notes,kind:b.kind,guests:b.kind==='event'?b.guests:null,items:b.items});
   const previous=await db.one('Order',{nonce:b.nonce});if(previous){if(previous.payload.fingerprint!==fingerprint)throw fail('מזהה הבקשה כבר בשימוש.',409);return {order:previous,s}}
   if(await db.count('Order',{'payload.date':b.date,status:{$nin:['cancelled','declined']}})>=s.capacity)throw fail('מכסת הבקשות מלאה.');
   const items=[];for(const line of b.items){const p=await db.one('MenuItem',{id:line.id,deleted:{$ne:true},hidden:{$ne:true},available:true});if(!p||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>p.maxPerOrder||p.stock!==null&&p.stock<line.quantity)throw fail('כמות או זמינות השתנו. רעננו את התפריט.',409);items.push({id:p.id,name:p.name,price:p.salePrice??p.price,quantity:line.quantity});if(p.stock!==null)await db.update('MenuItem',{id:p.id},{$inc:{stock:-line.quantity}})}
   const order=await db.create('Order',{id:randomUUID(),nonce:b.nonce,payload:{name:b.name.trim(),phone:normalizedPhone(b.phone),date:b.date,pickup:b.pickup,notes:b.notes,kind:b.kind,guests:b.kind==='event'?b.guests:null,items,fingerprint},status:'pending_confirmation',created_at:Date.now(),updated_at:Date.now(),payment:'at_pickup',priceConfirmed:false,availabilityConfirmed:false,reserved:items.length>0});return {order,s}
  });return json({id:result.order.id,status:result.order.status,whatsappUrl:'https://wa.me/'+normalizedPhone(result.s.whatsapp)+'?text='+encodeURIComponent(orderMessage(result.order.payload))},201)
 }
 const media=path.match(/^\/order\/media\/([a-f0-9-]+\.jpg)$/);if(media&&req.method==='GET'){const file=await db.video(media[1]);if(!file)throw fail('תמונה לא נמצאה.',404);const {Readable}=await import('node:stream');return new Response(Readable.toWeb(db.videoStream(file._id)),{headers:{'Content-Type':'image/jpeg','Cache-Control':'public,max-age=31536000,immutable'}})}
 throw fail('הפעולה לא נמצאה.',404);
 }catch(e){return Response.json({error:e.status?e.message:'שירות הנתונים אינו זמין כרגע.'},{status:e.status||503,headers:{'Cache-Control':'no-store'}})}}
 return {handle,db,close:()=>db.close()};
}
