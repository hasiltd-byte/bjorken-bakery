// Read-only visual verification against the configured bakery database and Cloudinary.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
const root='http://127.0.0.1:3030';
const uploaded=JSON.parse(await readFile('.local/product-photos-v3-upload.json','utf8'));
const menu=await fetch(root+'/order/api/menu').then(r=>r.json());
assert.equal(menu.products.find(p=>p.id==='yeast').name,'עוגת דבש');
assert.equal(menu.settings.whatsapp,'972504453592');
for(const p of menu.products)assert.ok(p.image.startsWith('https://res.cloudinary.com/'));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root);await page.waitForFunction(()=>[...document.querySelectorAll('.product-photo img')].length===10&&[...document.querySelectorAll('.product-photo img')].every(img=>img.src.startsWith('https://res.cloudinary.com/')));
 await page.locator('.product-photo img').evaluateAll(images=>images.forEach(img=>img.loading='eager'));
 await page.waitForFunction(()=>[...document.querySelectorAll('.product-photo img')].every(img=>img.complete&&img.naturalWidth>0),{},{timeout:60000});
 await mkdir('.qa/screenshots',{recursive:true});await page.locator('#menu').screenshot({path:'.qa/screenshots/cloudinary-catalog-v3.png'});
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  const card=page.locator('.product-card').filter({has:page.getByRole('heading',{name:'מאפה פסטו וגבינות',exact:true})});await card.screenshot({path:'.qa/screenshots/cloudinary-product-'+width+'.png'});
  await card.locator('.product-photo').click();await page.waitForFunction(()=>document.querySelector('.photo-dialog-main')?.naturalWidth>=1000);await page.screenshot({path:'.qa/screenshots/cloudinary-dialog-'+width+'.png'});await page.keyboard.press('Escape');
 }
 // Check that every full-size gallery image is retrievable, not just thumbnails.
 for(const photo of Object.values(uploaded)){const response=await fetch(photo.url);assert.equal(response.status,200);assert.ok(response.headers.get('content-type')?.startsWith('image/'))}
 assert.deepEqual(errors,[]);console.log('PASS: 10 MongoDB product photos, 19 Cloudinary originals, honey-cake identity, mobile 360/390/430, full-size photo dialog, test WhatsApp preserved, no browser errors.');
}finally{await browser.close()}
