// Raster variants of the code-native Bjorken monogram for browser tabs and iOS.
import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
const svg=await readFile('app/icon.svg');
await sharp(svg).resize(180,180).png().toFile('app/apple-icon.png');
const pngs=await Promise.all([16,32,48].map(size=>sharp(svg).resize(size,size).png().toBuffer()));
const header=Buffer.alloc(6+16*pngs.length);header.writeUInt16LE(1,2);header.writeUInt16LE(pngs.length,4);
let offset=header.length;
for(const [i,png] of pngs.entries()){const at=6+i*16,size=[16,32,48][i];header[at]=size;header[at+1]=size;header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(png.length,at+8);header.writeUInt32LE(offset,at+12);offset+=png.length}
await writeFile('app/favicon.ico',Buffer.concat([header,...pngs]));
console.log('Generated 16/32/48px favicon.ico and 180px Apple touch icon from app/icon.svg.');
