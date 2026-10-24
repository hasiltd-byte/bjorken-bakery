import {moduleError} from '../core/registry.mjs';
// Data integrity is part of the base shop and never depends on a paid license.
export async function adjustProductStock(db,id,delta){
 if(!Number.isSafeInteger(delta))throw moduleError('שינוי מלאי אינו תקין.');
 return db.transaction(async()=>{
  const product=await db.one('MenuItem',{id});if(!product)throw moduleError('מוצר לא נמצא.',404);
  if(product.stock==null)return product;
  const next=product.stock+delta;if(!Number.isSafeInteger(next)||next<0||next>100000)throw moduleError('המלאי השתנה או חורג ממגבלת הספירה.',409);
  const updated=await db.update('MenuItem',{id,stock:product.stock},{$inc:{stock:delta,revision:1,stockRevision:1}});
  if(!updated)throw moduleError('המלאי השתנה. רעננו ונסו שוב.',409);return updated;
 });
}
