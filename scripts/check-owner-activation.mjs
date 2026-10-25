import {chromium} from 'playwright';
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createService} from '../lib/server/service.mjs';
import {provisionOwner} from '../lib/server/owner-setup.mjs';
import {activateBjorken} from '../lib/server/bjorken-activation.mjs';
import {checkPilotDeliveryUi} from './check-pilot-delivery-ui.mjs';

const root='http://127.0.0.1:3034',mongo=await MongoMemoryReplSet.create({binary:{downloadDir:'.local/mongodb-binaries'},replSet:{count:1}});
let service,server,browser;const errors=[];
try{
 service=await createService({mongoUri:mongo.getUri('bjorken_test'),dbName:'bjorken_test',username:'',password:'',totpSecret:''});
 const owner=await provisionOwner(service.db,'bjorken');assert.ok(owner.created);
 // Empty strings override .env in Next: this is deliberately not environment authentication.
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3034'],{stdio:'inherit',env:{...process.env,MONGODB_URI:mongo.getUri('bjorken_test'),MONGO_URI:mongo.getUri('bjorken_test'),MONGO_DB_NAME:'bjorken_test',BJORKEN_ADMIN_USERNAME:'',BJORKEN_ADMIN_PASSWORD:'',BJORKEN_ADMIN_TOTP_SECRET:'',BJORKEN_ENABLE_LIVE:'true'}});
 let ready=false;for(let i=0;i<100;i++){try{if((await fetch(root+'/order/api/menu')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,200))}assert.ok(ready,'isolated server ready');
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:390,height:900}});context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
 await context.route('https://wa.me/**',r=>r.fulfill({contentType:'text/html',body:'WhatsApp intercepted. No message sent.'}));
 await mkdir('.qa/owner',{recursive:true});await mkdir('.qa/pilot',{recursive:true});const page=await context.newPage();
 async function login(password){await page.goto(root+'/admin/modules');await page.getByLabel('שם משתמש',{exact:true}).fill(owner.username);await page.getByLabel('סיסמה',{exact:true}).fill(password);await page.getByRole('button',{name:'כניסה למסכי העבודה',exact:true}).click()}
 await login(owner.temporaryPassword);await page.waitForURL(root+'/admin/security');await page.getByText('נדרשת החלפת סיסמה לפני המשך עבודה.',{exact:false}).waitFor();
 assert.equal((await page.request.get(root+'/order/api/admin/products')).status(),428);
 const permanent='Isolated-browser-permanent-pass-2026';
 await page.locator('[name=currentPassword]').fill(owner.temporaryPassword);await page.locator('[name=newPassword]').fill(permanent);await page.locator('[name=confirm]').fill(permanent);await page.getByRole('button',{name:'החלפת סיסמה וניתוק כל החיבורים',exact:true}).click();await page.getByRole('status').waitFor();
 assert.equal((await page.request.get(root+'/order/api/security')).status(),401);
 await login(permanent);await page.getByRole('button',{name:'יציאה',exact:true}).waitFor();
 const activation=await activateBjorken(service.db,{whatsapp:'0504453592',imagesApproved:true,reference:'isolated-browser-approved-owner'});assert.ok(activation.activated);
 await page.reload();await page.getByRole('button',{name:'משלוחים קבוצתיים',exact:true}).waitFor();
 for(const [name,path] of [['הזמנות','/orders'],['מוכר ואופה','/food'],['משלוחים קבוצתיים','/delivery/routes'],['מועדון וקופונים','/club'],['משוב','/reviews'],['דוחות','/reports?'],['עלות ורווחיות','/costs'],['ניתוח עסקי מתקדם','/analytics?'],['הרשאות צוות','/staff'],['יומן פעולות','/audit?']]){
  const loaded=page.waitForResponse(r=>r.url().startsWith(root+'/order/api/modules'+path)&&r.request().method()==='GET');await page.getByRole('button',{name,exact:true}).click();assert.equal((await loaded).status(),200,name+' API');assert.equal(await page.getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');
 }
 await page.getByRole('button',{name:'משלוחים קבוצתיים',exact:true}).click();await page.getByText('אין מוצרים עם מחיר מספרי הזמינים למשלוח קבוצתי.',{exact:false}).waitFor();await page.screenshot({path:'.qa/owner/live-modules-mobile.png',fullPage:true});
 const shop=await context.newPage();await shop.goto(root);await shop.locator('.product-card').first().waitFor();await shop.getByRole('button',{name:'הוספת סינבון',exact:true}).click();await shop.getByRole('button',{name:'לסל ולאיסוף'}).click();assert.match(await shop.locator('.cart-total').innerText(),/אין סכום סופי/);
 await shop.getByLabel('שם מלא',{exact:true}).fill('לקוח בדיקה מבודדת');await shop.getByLabel('טלפון נייד',{exact:true}).fill('0501234567');await shop.getByLabel('שעת איסוף מבוקשת').selectOption({index:1});await shop.locator('.check-label input').check();
 const popupPromise=shop.waitForEvent('popup');await shop.getByRole('button',{name:'שליחת בקשה ב־WhatsApp',exact:true}).click();const popup=await popupPromise;await popup.waitForURL('https://wa.me/**');
 assert.equal(new URL(popup.url()).pathname,'/972504453592');assert.match(new URL(popup.url()).searchParams.get('text'),/מחיר באישור המאפייה/);assert.equal(shop.url(),root+'/');assert.equal(await popup.evaluate(()=>window.opener===null),true);await popup.close();await shop.locator('.cart-dialog').waitFor({state:'hidden'});assert.equal(await shop.locator('.cart-dock').count(),0);
 // Persist a real CMS edit only in the isolated database; reload admin and public page.
 await page.goto(root+'/admin/menu');const card=page.locator('.cms-product').filter({hasText:'סינבון'});await card.getByRole('button',{name:'עריכת מוצר',exact:true}).click();await page.getByLabel('מחיר בש״ח').fill('23.50');await page.getByLabel('תיאור ומרכיבים').fill('תיאור שנערך בבדיקת בעלים מבודדת');await page.getByRole('button',{name:'שמירת המוצר',exact:true}).click();await page.locator('.cms-dialog').waitFor({state:'hidden'});await page.reload();await card.getByRole('button',{name:'עריכת מוצר',exact:true}).click();assert.equal(await page.getByLabel('מחיר בש״ח').inputValue(),'23.5');await page.getByRole('button',{name:'ביטול',exact:true}).click();await shop.reload();await shop.locator('.product-card').filter({hasText:'סינבון'}).getByText('₪23.5',{exact:true}).waitFor();
 await page.goto(root+'/admin/modules');await page.getByRole('button',{name:'משלוחים קבוצתיים',exact:true}).click();await page.getByText('מסלולי חלוקה',{exact:true}).waitFor();const readiness=await page.request.get(root+'/order/api/modules/delivery/routes').then(r=>r.json());assert.equal(readiness.readiness.canAcceptOrders,true);
 await page.getByRole('button',{name:'סקירה ומודולים',exact:true}).click();await page.getByRole('button',{name:'פתיחת הדגמה עם נתונים מדומים',exact:true}).click();await page.getByText('מצב הדגמה: נתונים מדומים נפרדים.',{exact:false}).waitFor();
 // Click the actual route link, place a priced simulated order and exercise manual delivery.
 await checkPilotDeliveryUi(page,context,root);
 assert.deepEqual(errors,[]);assert.equal(await service.db.count('Order',{}),1);const order=await service.db.one('Order',{});assert.equal(order.payload.items[0].price,null);
 console.log('PASS: Mongo owner without environment credentials; forced password change and revoked session; all licensed live admin screens; unpriced-product readiness warning; CMS edit persists; unknown-price request to approved test phone in separate intercepted WhatsApp tab; cart reset; public demo route popup and priced simulated order/delivery. No Atlas writes or messages. License dates tested, not activated in production.');
}finally{await browser?.close();if(server){const done=new Promise(r=>server.once('exit',r));server.kill();await done}await service?.close();await mongo.stop()}
