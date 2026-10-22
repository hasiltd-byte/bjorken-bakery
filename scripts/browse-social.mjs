import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
for(const [name,url] of [['instagram','https://www.instagram.com/_bjorken_/'],['facebook','https://www.facebook.com/p/%D7%91%D7%99%D7%95%D7%A8%D7%A7%D7%9F-Bj%C3%B6rken-61593858941976/']]){
 const page=await browser.newPage({viewport:{width:1440,height:1000}});try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForTimeout(4000);await page.screenshot({path:'.local/'+name+'-page.png'});const images=await page.locator('img').evaluateAll(a=>a.map(i=>({url:i.src,alt:i.alt,width:i.naturalWidth,height:i.naturalHeight})));await writeFile('.local/'+name+'-rendered-images.json',JSON.stringify(images,null,2));console.log(name,(await page.locator('body').innerText()).slice(0,1200),JSON.stringify(images));}catch(e){console.log(name,e.message)}await page.close();
}await browser.close();
