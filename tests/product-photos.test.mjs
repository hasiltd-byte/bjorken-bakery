import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {seedProducts} from '../shared/catalog.mjs';
import {displayImage} from '../shared/images.mjs';

test('delivery limits dimensions without cropping or rewriting local pictures',()=>{
 const image='https://res.cloudinary.com/bakery/image/upload/v123/pastry.jpg';
 assert.equal(displayImage(image,1600),'https://res.cloudinary.com/bakery/image/upload/f_auto,q_auto,c_limit,w_1600/v123/pastry.jpg');
 assert.equal(displayImage('/images/product-yeast-v3.webp'),'/images/product-yeast-v3.webp');
 assert.equal(displayImage(null),'');
});
test('all catalog products have full-frame source photographs, with the confirmed honey cake',async()=>{
 const manifest=JSON.parse(await readFile('visual-references/product-photos-v3.json','utf8'));
 assert.equal(seedProducts.length,10);
 for(const product of seedProducts){
  assert.ok(product.image&&!product.image.includes('placeholder'));
  for(const asset of [product.image,...product.gallery]){
   const entry=manifest.find(p=>p.asset===asset);assert.ok(entry);assert.equal(entry.crop,false);
   const meta=await sharp('public'+asset).metadata();assert.ok(Math.max(meta.width,meta.height)>=1500);
  }
 }
 const honey=seedProducts.find(p=>p.id==='yeast');assert.equal(honey.name,'עוגת דבש');
 assert.match(manifest.find(p=>p.asset===honey.image).source,/^798516250/);
});
