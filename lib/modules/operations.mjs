import {requireRole,moduleError,featureState} from './core/registry.mjs';
import {orderScope} from './orders/core.mjs';
import {israelDate} from '../../shared/schedule.mjs';
export async function operationRoutes(ctx,path){
 if(path==='/dashboard'&&ctx.method==='GET'){
  const {actor,store,db,businessId,space}=ctx,manager=['admin','manager'].includes(actor.role),today=israelDate(),orders=actor.role==='driver'?[]:space==='demo'?(await store.list('order',{},1000)).map(r=>r.data):await db.find('Order',orderScope(businessId),{created_at:-1},1000),active=orders.filter(o=>!['cancelled','declined','expired','collected','delivered'].includes(o.status)),products=actor.role==='driver'?[]:await ctx.catalog({all:true});
  const result={today,requests:orders.length,pendingConfirmation:active.filter(o=>o.status==='pending_confirmation').length,activeOrders:active.filter(o=>o.status!=='pending_confirmation').length,todayTasks:active.filter(o=>o.payload.date===today).length,missingProducts:products.filter(p=>!p.hidden&&(!p.available||p.stock===0)).length,boundedToLatest:1000};
  if(manager)result.manuallyVerifiedPayments=orders.filter(o=>Number.isFinite(o.paymentRecord?.verifiedAt)).length;
  if(actor.role==='driver'&&featureState(ctx.grants,'groupDelivery',space).allowed){result.assignedRoutes=(await store.list('route',{'data.driverUsername':actor.username})).filter(r=>!['draft','completed','cancelled'].includes(r.data.state)).length;delete result.requests;delete result.pendingConfirmation;delete result.activeOrders;delete result.missingProducts;delete result.todayTasks}
  return ctx.json(result);
 }
 if(path==='/audit'&&ctx.method==='GET'){
  requireRole(ctx.actor,['admin','manager']);const url=new URL(ctx.request.url),search=(url.searchParams.get('q')||'').trim(),page=Number(url.searchParams.get('page')||0);if(search.length>80||!Number.isInteger(page)||page<0||page>100)throw moduleError('חיפוש או עמוד אינם תקינים.');const filter=search?{$or:['action','actor','target'].map(key=>({['data.'+key]:{$regex:search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'}}))}:{};const rows=await ctx.store.list('audit',filter,Math.min((page+1)*50+1,5051));return ctx.json({rows:rows.slice(page*50,page*50+50).map(r=>({id:r.key,action:r.data.action,actor:r.data.actor,role:r.data.role,target:r.data.target,at:r.data.at})),hasMore:rows.length>(page+1)*50,page,pageSize:50});
 }
 return null;
}
