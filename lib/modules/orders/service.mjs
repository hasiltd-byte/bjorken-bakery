import {adjustProductStock} from './stock.mjs';
import {moduleError,requireFeature,requireRole} from '../core/registry.mjs';
import {text,integer,cents,publicRecord} from '../core/validation.mjs';
import {safeOrder,orderScope,validateTransition,transitionLiveOrder} from './core.mjs';
export async function ordersRoutes(ctx,path){
 const {db,store,space,actor,grants,body,json,businessId,method}=ctx;
 if(!path.startsWith('/orders')&&!path.startsWith('/food'))return null;
 requireRole(actor,['admin','manager','cashier','kitchen']);requireFeature(grants,path.startsWith('/food')?'foodPro':'ordersPro',space);
 const getOrders=async(unlimited=false)=>space==='demo'?(await store.list('order')).map(r=>({id:r.key,...r.data})):db.find('Order',orderScope(businessId),{created_at:-1},unlimited?undefined:500);
 if(path==='/orders'&&method==='GET')return json({orders:(await getOrders()).map(o=>safeOrder(o,actor.role)),space,refreshedAt:Date.now()});
 const match=path.match(/^\/orders\/([a-z0-9-]+)(\/payment)?$/);
 if(match&&method==='PATCH'){
  const b=await body();if(match[2]){requireRole(actor,['admin','manager','cashier']);const reference=text(b.reference,4,100),amount=cents(b.amount);if(b.verified!==true)throw moduleError('יש לאמת תשלום בפועל.');
   await db.transaction(async()=>{const row=space==='demo'?await store.get('order',match[1]):await db.one('Order',{id:match[1],...orderScope(businessId)}),order=space==='demo'?row?.data:row;if(!order)throw moduleError('הזמנה לא נמצאה.',404);if(order.paymentRecord)throw moduleError('כבר תועד תשלום. אין לשנותו ללא התאמה מתועדת.',409);if(order.status!=='confirmed'&&order.status!=='ready'&&order.status!=='collected'&&order.status!=='delivered')throw moduleError('יש לאשר מחיר לפני אימות תשלום.');
    const record={amountCents:amount,reference,verifiedAt:Date.now(),actor:actor.username,mode:space==='demo'?'simulated':'manual_verified'};
    if(space==='demo')await store.set('order',match[1],{...order,paymentRecord:record},row.revision);else await db.update('Order',{id:match[1]},{$set:{paymentRecord:record}});await store.audit('order.payment.verified',actor,match[1],record);
   });return json({ok:true});
  }
  let order;if(space==='live')order=await transitionLiveOrder(db,businessId,match[1],b,actor);else order=await db.transaction(async()=>{const row=await store.get('order',match[1]);if(!row)throw moduleError('הזמנה לא נמצאה.',404);validateTransition(row.data,b,actor);const next={...row.data,status:b.status,priceConfirmed:b.priceConfirmed??row.data.priceConfirmed,availabilityConfirmed:b.availabilityConfirmed??row.data.availabilityConfirmed,updated_at:Math.max(Date.now(),row.data.updated_at+1),timeline:[...(row.data.timeline||[]),{status:b.status,at:Date.now(),actor:actor.username}]};await store.set('order',row.key,next,row.revision);return {id:row.key,...next}});
  await store.audit('order.status',actor,match[1],{status:b.status});return json({order:safeOrder(order,actor.role)});
 }
 if(path==='/food'&&method==='GET'){
  const products=await ctx.catalog(),orders=await getOrders(true),groups=(await store.list('groupOrder',{},0)).filter(r=>r.data.reserved&&!['cancelled','collected'].includes(r.data.status)).map(r=>r.data),batches=await store.list('batch'),shortages=await store.list('shortage');
  return json({inventory:products.map(p=>({id:p.id,name:p.name,readyToSell:p.stock,reserved:orders.filter(o=>o.reserved&&!['cancelled','declined','collected','delivered'].includes(o.status)).reduce((n,o)=>n+(o.payload.items.find(i=>i.id===p.id)?.quantity||0),0)+groups.reduce((n,o)=>n+(o.items.find(i=>i.id===p.id)?.quantity||0),0),inProduction:batches.filter(r=>r.data.productId===p.id&&r.data.status==='preparing').reduce((n,r)=>n+r.data.quantity,0),inOven:batches.filter(r=>r.data.productId===p.id&&r.data.status==='in_oven').reduce((n,r)=>n+r.data.quantity,0),soldOut:p.stock===0,available:p.available})),batches:batches.map(publicRecord),shortages:shortages.map(publicRecord),manualInventory:true,refreshedAt:Date.now()});
 }
 if(path==='/food/batches'&&method==='POST'){
  requireRole(actor,['admin','manager','kitchen']);const b=await body();if(!(await ctx.catalog()).some(p=>p.id===b.productId))throw moduleError('מוצר לא נמצא.');const row=await store.add('batch',{productId:b.productId,quantity:integer(b.quantity,1,10000),status:'planned',note:text(b.note||'',0,300),actor:actor.username});await store.audit('batch.created',actor,row.key);return json({batch:publicRecord(row)},201);
 }
 const batch=path.match(/^\/food\/batches\/([a-f0-9-]+)$/);
 if(batch&&method==='PATCH'){requireRole(actor,['admin','manager','kitchen']);const b=await body();const row=await db.transaction(async()=>{const old=await store.get('batch',batch[1]);if(!old)throw moduleError('אצווה לא נמצאה.',404);if(old.revision!==b.revision)throw moduleError('האצווה השתנתה.',409);const steps={planned:['preparing','cancelled'],preparing:['in_oven','cancelled'],in_oven:['ready','cancelled'],ready:[],cancelled:[]};if(!steps[old.data.status]?.includes(b.status))throw moduleError('מעבר ייצור לא תקין.');
   if(b.status==='ready'){
    if(space==='live'){const p=await db.one('MenuItem',{id:old.data.productId});if(p?.stock!=null&&p.stock+old.data.quantity>100000)throw moduleError('המלאי חורג ממגבלת הספירה.');if(p?.stock==null)throw moduleError('יש לספור מלאי מוכן ראשוני לפני הוספת אצווה.');await adjustProductStock(db,p.id,old.data.quantity)}
    else{const p=await store.get('product',old.data.productId);await store.set('product',p.key,{...p.data,stock:(p.data.stock??0)+old.data.quantity},p.revision)}
   }return store.set('batch',old.key,{...old.data,status:b.status,updatedBy:actor.username},old.revision)});await store.audit('batch.status',actor,row.key,{status:b.status});return json({batch:publicRecord(row)});
 }
 if(path==='/food/count'&&method==='POST'){requireRole(actor,['admin','manager']);const b=await body(),stock=integer(b.stock,0,100000);await db.transaction(async()=>{if(space==='live'){const p=await db.one('MenuItem',{id:b.productId});if(!p)throw moduleError('מוצר לא נמצא.',404);await db.update('MenuItem',{id:p.id},{$set:{stock},$inc:{revision:1,stockRevision:1}})}else{const p=await store.get('product',b.productId);if(!p)throw moduleError('מוצר לא נמצא.',404);await store.set('product',p.key,{...p.data,stock},p.revision)}await store.audit('inventory.count',actor,b.productId,{readyToSell:stock})});return json({ok:true})}
 if(path==='/food/shortages'&&method==='POST'){requireRole(actor,['admin','manager','cashier','kitchen']);const b=await body(),row=await store.add('shortage',{message:text(b.message,3,400),status:'open',actor:actor.username});await store.audit('shortage.opened',actor,row.key);return json({shortage:publicRecord(row)},201)}
 const shortage=path.match(/^\/food\/shortages\/([a-f0-9-]+)$/);if(shortage&&method==='PATCH'){requireRole(actor,['admin','manager','kitchen']);const b=await body(),row=await store.get('shortage',shortage[1]);if(!row)throw moduleError('התראה לא נמצאה.',404);await store.set('shortage',row.key,{...row.data,status:'resolved',resolvedBy:actor.username},b.revision);return json({ok:true})}
 throw moduleError('פעולה לא נמצאה.',404);
}
