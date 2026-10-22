import {readFile,writeFile,mkdir} from 'node:fs/promises';
import sharp from 'sharp';
await mkdir('visual-references/social-originals',{recursive:true});
const images=JSON.parse(await readFile('.local/instagram-rendered-images.json','utf8')).filter(i=>i.width>=300);
const manifest=[];
for(const [i,image]of images.entries()){
 const r=await fetch(image.url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Image HTTP '+r.status);const bytes=Buffer.from(await r.arrayBuffer());const filename='instagram-'+String(i+1).padStart(2,'0')+'.jpg';await writeFile('visual-references/social-originals/'+filename,bytes);manifest.push({file:filename,source:'https://www.instagram.com/_bjorken_/',caption:image.alt,...await sharp(bytes).metadata().then(m=>({width:m.width,height:m.height}))});
}await writeFile('visual-references/social-originals/sources.json',JSON.stringify(manifest,null,2));
const tiles=await Promise.all(manifest.map(async(m,i)=>({input:await sharp('visual-references/social-originals/'+m.file).resize(220,260,{fit:'contain',background:'#eeeadd'}).extend({bottom:30,background:'#eeeadd'}).composite([{input:Buffer.from(`<svg width="220" height="30"><text x="10" y="22" font-size="18">${i+1} / ${m.width} x ${m.height}</text></svg>`),top:260,left:0}]).png().toBuffer(),left:(i%4)*220,top:Math.floor(i/4)*290})));
await sharp({create:{width:880,height:Math.ceil(manifest.length/4)*290,channels:3,background:'#eeeadd'}}).composite(tiles).jpeg().toFile('.local/social-contact-sheet.jpg');console.log(JSON.stringify(manifest));
