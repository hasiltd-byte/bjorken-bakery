import {readFile,writeFile,mkdir} from 'node:fs/promises';
import sharp from 'sharp';
import {productPhotoMap,preparedPhotoPath} from '../shared/product-photo-map.mjs';
const inventory=JSON.parse(await readFile('.qa/photos/inventory.json','utf8')),manifest=[];
await mkdir('public/images',{recursive:true});
for(const [id,row]of Object.entries(productPhotoMap))for(const [i,number]of row.photos.entries()){
 const source=inventory[number-1];if(!source)throw Error('Photo not found');const output=preparedPhotoPath(id,i);
 const info=await sharp('../'+source.file).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:90,effort:6}).toFile('public'+output);
 manifest.push({id,index:i,source:source.file,sourceHash:source.hash,asset:output,width:info.width,height:info.height,bytes:info.size,crop:false});
}await writeFile('visual-references/product-photos-v3.json',JSON.stringify(manifest,null,2));console.log('Prepared',manifest.length,'full-frame high-resolution product images.');
