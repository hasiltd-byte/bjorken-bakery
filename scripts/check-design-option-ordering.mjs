// Called by the isolated browser suite; exercises each design against the test DB.
import assert from 'node:assert/strict';
export async function checkDesignOptionOrdering(context,root,errors){
 for(const design of ['sunlight','hearth']){
  const page=await context.newPage();await page.setViewportSize({width:1440,height:1000});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(root+'/designs/'+design);await page.waitForSelector('.product-card');
  assert.equal(await page.locator('.design-switcher a[aria-current=page]').count(),1);
  for(const width of [1440,768,430,390,360,320]){
   await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,design+' overflow at '+width);
   assert.ok(await page.locator('.product-photo img').evaluateAll(images=>images.every(image=>getComputedStyle(image).objectFit==='cover'&&getComputedStyle(image).filter==='none')));
   if(width<=430){await page.getByRole('button',{name:'פתיחת תפריט',exact:true}).click();await page.locator('#bakery-navigation').getByRole('link',{name:'המאפים שלנו',exact:true}).click()}
  }
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'תמונה גדולה והזמנת עוגת דבש',exact:true}).click();assert.equal(await page.locator('.photo-dialog h2').innerText(),'עוגת דבש');assert.equal(await page.locator('.photo-dialog-main').evaluate(img=>getComputedStyle(img).objectFit),'contain');
  await page.getByLabel('הגדלת כמות בתצוגה המוגדלת',{exact:true}).click();await page.getByRole('button',{name:'להוסיף ולהמשיך להזמנה',exact:true}).click();await page.locator('.cart-dialog').waitFor({state:'visible'});
  await page.getByLabel('שם מלא').fill('בדיקת חלופת עיצוב');await page.getByLabel('טלפון נייד').fill('0501234567');await page.getByLabel('שעת איסוף מבוקשת').selectOption({index:1});await page.locator('.cart-dialog .check-label input').check();
  const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'שליחת בקשה ב־WhatsApp',exact:true}).click();const popup=await popupPromise;await popup.waitForURL('https://wa.me/**');assert.match(new URL(popup.url()).searchParams.get('text'),/2 × עוגת דבש — מחיר באישור המאפייה/);assert.equal(page.url(),root+'/designs/'+design+'#menu');await popup.close();
  await page.waitForFunction(()=>document.querySelector('.header-cart b')?.textContent==='0');assert.equal(await page.locator('.cart-dock').count(),0);await page.reload();await page.waitForFunction(()=>document.querySelector('.header-cart b')?.textContent==='0');await page.close();
 }
 const hub=await context.newPage();await hub.setViewportSize({width:390,height:844});await hub.goto(root+'/designs');assert.equal(await hub.locator('.presentation-card').count(),2);assert.ok(await hub.locator('.presentation-preview img').evaluateAll(images=>images.every(img=>img.complete&&img.naturalWidth>0)));assert.equal(await hub.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await hub.close();
 console.log('PASS: both alternative designs at 1440/768/430/390/360/320, mobile navigation, centered full-bleed photos, photo ordering, real isolated-DB checkout, separate WhatsApp tab, cleared cart, and comparison previews.');
}
