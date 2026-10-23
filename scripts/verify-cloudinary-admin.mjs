// Explicitly uploads the existing cinnamon product photograph and saves its Cloudinary URL.
import nextEnv from '@next/env';
import {chromium} from 'playwright';
import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {databaseName} from '../lib/server/database-target.mjs';
import {cloudinaryImage,displayImage} from '../shared/images.mjs';
nextEnv.loadEnvConfig(process.cwd());
if(!process.argv.includes('--upload-cinnamon'))throw Error('Use --upload-cinnamon to explicitly upload and update the existing cinnamon photograph.');
let browser,client;
try{
 client=await mongoose.mongo.MongoClient.connect(process.env.MONGODB_URI||process.env.MONGO_URI,{serverSelectionTimeoutMS:12000});const db=client.db(databaseName(process.env.MONGODB_URI||process.env.MONGO_URI,process.env.MONGO_DB_NAME));const before=await db.collection('dishVideos.files').countDocuments();
 browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto('http://localhost:3030/admin/menu');await page.locator('[name=username]').fill(process.env.BJORKEN_ADMIN_USERNAME);await page.locator('[name=password]').fill(process.env.BJORKEN_ADMIN_PASSWORD);await page.getByRole('button',{name:'כניסה לניהול האתר'}).click();
 const card=page.locator('.cms-product').filter({hasText:'סינבון'});await card.getByRole('button',{name:'עריכת מוצר'}).click();await page.locator('.cms-photo-editor>label input[type=file]').setInputFiles('public/images/cinnamon_roll.webp');await page.getByRole('button',{name:'שמירת המוצר'}).click();
 await page.waitForFunction(()=>!document.querySelector('.cms-dialog')?.open||!!document.querySelector('.cms-dialog .cms-error'),{},{timeout:45000});
 const error=page.locator('.cms-dialog .cms-error');if(await error.count())throw Error(await error.innerText());
 const saved=await db.collection('menuitems').findOne({id:'cinnamon'});assert.ok(cloudinaryImage(saved.image,process.env.CLOUDINARY_CLOUD_NAME));assert.equal(await db.collection('dishVideos.files').countDocuments(),before);
 await card.getByRole('button',{name:'עריכת מוצר'}).click();assert.equal(await page.locator('.cms-photo-editor>img').getAttribute('src'),saved.image);assert.equal(await page.locator('.cms-photo-editor option[value=uploaded]').count(),1);await page.getByRole('button',{name:'ביטול',exact:true}).click();
 await page.goto('http://localhost:3030');await page.waitForFunction(url=>[...document.querySelectorAll('.product-card img')].some(i=>i.src===url&&i.naturalWidth>0),displayImage(saved.image,1000));
 await mkdir('.qa/screenshots',{recursive:true});await page.locator('.product-card').filter({hasText:'סינבון'}).screenshot({path:'.qa/screenshots/cloudinary-product.png'});
 console.log(JSON.stringify({adminUpload:true,cloudinaryDelivery:true,mongooseImageUrlSaved:true,reopenEditor:true,publicImageLoaded:true,newGridFSFiles:0,product:'cinnamon'}));
}catch(e){console.error('Cloudinary admin verification failed:',e.message);process.exitCode=1}finally{await browser?.close();await client?.close()}
