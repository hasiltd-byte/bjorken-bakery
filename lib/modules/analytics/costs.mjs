import {requireCapability,capabilityState} from '../core/entitlements.mjs';
import {moduleError} from '../core/registry.mjs';
import {cents,text} from '../core/validation.mjs';

export async function costSnapshot(store,productId,enabled){
 if(!enabled)return undefined;
 const row=await store.get('productCost',productId),d=row?.data;
 return {version:2,status:d?.status||'unknown',unitCostCents:d?.status&&d.status!=='unknown'?d.unitCostCents:null,includesPackaging:!!d?.includesPackaging,includesProductionLabor:d?.includesProductionLabor??true,source:d?.source||'',costUpdatedAt:d?.updatedAt||null,capturedAt:Date.now(),costRevision:row?.revision??null,currency:'ILS'};
}
export const canSnapshotCost=(grants,space)=>capabilityState(grants,'productCosts',space).allowed;
export async function costRoutes(ctx,path){
 if(path!=='/costs'&&!path.startsWith('/costs/'))return null;requireCapability(ctx,'productCosts');const {db,store,body,method,json,actor}=ctx;
 if(path==='/costs'&&method==='GET'){
  const costs=await store.list('productCost',{},0),products=await ctx.catalog({all:true});return json({products:products.map(p=>{const row=costs.find(r=>r.key===p.id),d=row?.data;return {id:p.id,name:p.name,category:p.category,salePriceNis:p.salePrice??p.price,costRevision:row?.revision??null,unitCostNis:d?.status&&d.status!=='unknown'?d.unitCostCents/100:null,status:d?.status||'unknown',includesPackaging:!!d?.includesPackaging,includesProductionLabor:d?.includesProductionLabor??true,updatedAt:d?.updatedAt||null,source:d?.source||''}}),paidFeature:true,scope:'unit_cost_excludes_delivery_fuel_driver_labor_and_payment_fees'});
 }
 const match=path.match(/^\/costs\/([a-z0-9-]+)$/);
 if(match&&method==='PATCH'){
  if(!ctx.ready)throw moduleError('האתר במצב Preview. שינוי עלויות עסק אמיתיות חסום.',403);const b=await body();if(!['unknown','estimated','verified'].includes(b.status))throw moduleError('בחרו מצב עלות: לא ידוע, אומדן או מאומת.');
  const data={version:2,currency:'ILS',status:b.status,unitCostCents:b.status==='unknown'?null:cents(b.unitCostNis),includesPackaging:b.includesPackaging===true,includesProductionLabor:b.includesProductionLabor!==false,source:text(b.source||'',0,240),updatedAt:Date.now(),updatedBy:actor.username};
  if(b.status!=='unknown'&&b.unitCostNis==null)throw moduleError('עלות חסרה אינה אפס. הזינו עלות או בחרו לא ידוע.');
  await db.transaction(async()=>{if(!(await ctx.catalog({all:true})).some(p=>p.id===match[1]))throw moduleError('מוצר לא נמצא.',404);const old=await store.get('productCost',match[1]);if((old?.revision??null)!==(b.revision??null))throw moduleError('העלות השתנתה. רעננו.',409);if(old)await store.set('productCost',old.key,data,old.revision);else await store.add('productCost',data,match[1]);await store.audit('product.cost.updated',actor,match[1],{status:data.status,version:2})});return json({ok:true});
 }throw moduleError('פעולת עלות לא נמצאה.',404);
}
