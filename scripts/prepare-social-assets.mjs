// Deterministic web derivatives of the business's public photographs. No generated content.
import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const mappings=[
 ['cheese_pastries.webp','facebook-2.jpg','facebook',null],
 ['cinnamon_roll.webp','instagram-01.jpg','instagram',null],
 ['glazed_rolls.webp','instagram-02.jpg','instagram',null],
 ['savory_pastry.webp','instagram-12.jpg','instagram',null],
 ['braided_pastry.webp','instagram-11.jpg','instagram',null],
 ['cake_pan.webp','instagram-10.jpg','instagram',null],
 ['cookie.webp','instagram-04.jpg','instagram',{left:0,top:230,width:480,height:390}],
 ['sweet_rolls.webp','instagram-08.jpg','instagram',null],
 ['bakery_shop.webp','instagram-06.jpg','instagram',null],
 ['social-coffee.webp','instagram-04.jpg','instagram',null],
 ['social-braids.webp','facebook-1.jpg','facebook',null],
 ['social-cookies.webp','instagram-09.jpg','instagram',null]
];
const sources={instagram:'https://www.instagram.com/_bjorken_/',facebook:'https://www.facebook.com/p/%D7%91%D7%99%D7%95%D7%A8%D7%A7%D7%9F-Bj%C3%B6rken-61593858941976/'};
const manifest=[];
for(const [file,original,site,crop]of mappings){let processor=sharp('visual-references/social-originals/'+original).rotate();if(crop)processor=processor.extract(crop);const info=await processor.resize({width:960,height:1200,fit:'inside',withoutEnlargement:true}).webp({quality:88,effort:6}).toFile('public/images/'+file);manifest.push({asset:'/images/'+file,original,source:sources[site],crop,width:info.width,height:info.height,bytes:info.size,usage:'Preview only; commercial usage requires owner approval'});}
await writeFile('visual-references/social-originals/asset-manifest.json',JSON.stringify(manifest,null,2));console.log('Prepared',manifest.length,'assets,',Math.round(manifest.reduce((n,a)=>n+a.bytes,0)/1024),'KB total.');
