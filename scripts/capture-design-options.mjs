// Capture the implemented designs for the client comparison page; no orders are sent.
import {chromium} from 'playwright';
import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('public/design-previews',{recursive:true});await mkdir('.qa/design-options',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 for(const design of ['sunlight','hearth']){
  const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));const menu=page.waitForResponse(r=>r.url().endsWith('/order/api/menu'));await page.goto('http://127.0.0.1:3030/designs/'+design);assert.equal((await menu).status(),200);
  await page.waitForFunction(()=>document.querySelector('.hero-photo-button img')?.complete&&document.querySelector('.hero-photo-button img')?.naturalWidth>0);
  await page.locator('img').evaluateAll(images=>images.forEach(img=>img.loading='eager'));
  await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode().catch(()=>{}))));await page.evaluate(()=>document.fonts.ready);
  const screenshot=await page.screenshot({type:'png'});await sharp(screenshot).resize(1200,900,{fit:'cover',position:'top'}).webp({quality:86}).toFile('public/design-previews/'+design+'.webp');
  await page.screenshot({path:'.qa/design-options/'+design+'-desktop.png',fullPage:true});
  for(const width of [768,430,390,360,320]){
   await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,design+' overflow at '+width);
   await page.screenshot({path:'.qa/design-options/'+design+'-'+width+'.png',fullPage:true});
   await page.screenshot({path:'.qa/design-options/'+design+'-first-'+width+'.png'});
  }
  assert.deepEqual(errors,[]);await page.close();console.log('Captured',design,'desktop and 768/430/390/360/320; no overflow or browser errors.');
 }
}finally{await browser.close()}
