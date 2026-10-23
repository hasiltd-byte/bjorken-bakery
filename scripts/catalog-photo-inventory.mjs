import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
await mkdir('.qa/photos',{recursive:true});
const files=(await readdir('..')).filter(f=>/\.(jpe?g|png)$/i.test(f)&&!f.includes('Copy')).sort();
const seen=new Set(),photos=[];
for(const file of files){const bytes=await readFile('../'+file),hash=createHash('sha256').update(bytes).digest('hex');if(seen.has(hash))continue;seen.add(hash);const m=await sharp(bytes).metadata();photos.push({file,width:m.width,height:m.height,hash})}
const tiles=await Promise.all(photos.map(async(p,i)=>({input:await sharp('../'+p.file).rotate().resize(240,260,{fit:'contain',background:'#f8f6ef'}).extend({bottom:35,background:'#f8f6ef'}).composite([{input:Buffer.from(`<svg width="240" height="35"><text x="8" y="24" font-size="17">${i+1} | ${p.width} x ${p.height}</text></svg>`),top:260,left:0}]).png().toBuffer(),left:(i%4)*240,top:Math.floor(i/4)*295})));
await sharp({create:{width:960,height:Math.ceil(photos.length/4)*295,channels:3,background:'#f8f6ef'}}).composite(tiles).jpeg().toFile('.qa/photos/contact-sheet.jpg');await writeFile('.qa/photos/inventory.json',JSON.stringify(photos,null,2));console.log(JSON.stringify(photos.map((p,i)=>({number:i+1,...p})),null,2));
