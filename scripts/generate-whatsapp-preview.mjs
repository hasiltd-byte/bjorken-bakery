// A square, thumbnail-safe social image using the bakery's real photograph.
import {chromium} from 'playwright';
import sharp from 'sharp';
import {readFile,mkdir} from 'node:fs/promises';
const photo='data:image/webp;base64,'+(await readFile('public/images/cheese_pastries.webp')).toString('base64');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:1200},deviceScaleFactor:1});
 await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
 *{box-sizing:border-box}body{margin:0;width:1200px;height:1200px;background:#f8f6ef;overflow:hidden}.photo{position:absolute;left:0;top:0;width:1200px;height:1015px;object-fit:cover;object-position:center 55%}.brand{position:absolute;bottom:0;left:0;width:1200px;height:250px;background:#f8f6ef;color:#354c3d;display:flex;align-items:center;justify-content:center;flex-direction:column;border-top:12px solid #f8f6ef}.name{font:156px/1 Georgia,serif;letter-spacing:-6px;margin-top:-14px}.caption{font:36px Arial,sans-serif;direction:rtl;letter-spacing:1px;margin-top:12px;color:#596b4e}
 </style></head><body><img class="photo" src="${photo}" alt=""><div class="brand"><div class="name">Björken</div><div class="caption">ביורקן · מאפיית בוטיק</div></div></body></html>`);
 await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
 await mkdir('public/images',{recursive:true});await mkdir('.qa/design',{recursive:true});
 await page.screenshot({path:'public/images/bjorken-og-v2.jpg',type:'jpeg',quality:92});
 for(const size of [96,160])await sharp('public/images/bjorken-og-v2.jpg').resize(size,size).png().toFile('.qa/design/whatsapp-thumbnail-'+size+'.png');
 console.log('Generated square OG image 1200×1200 and 96/160px thumbnail checks.');
}finally{await browser.close()}
