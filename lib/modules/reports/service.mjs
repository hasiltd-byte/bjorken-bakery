import {requireFeature,requireRole,moduleError} from '../core/registry.mjs';
import {orderScope} from '../orders/core.mjs';
import {israelDate,validDate} from '../../../shared/schedule.mjs';
export async function reportsRoutes(ctx,path){
 if(path!=='/reports')return null;requireRole(ctx.actor,['admin','manager']);requireFeature(ctx.grants,'ordersPro',ctx.space);
 const url=new URL(ctx.request.url),period=url.searchParams.get('period')||'day',date=url.searchParams.get('date')||israelDate();if(!['day','month'].includes(period)||!validDate(date))throw moduleError('טווח דוח לא תקין.');const prefix=period==='month'?date.slice(0,7):date;
 const orders=ctx.space==='demo'?(await ctx.store.list('order',{},5000)).map(r=>r.data):await ctx.db.find('Order',orderScope(ctx.businessId),{created_at:-1},5000),selected=orders.filter(o=>israelDate(new Date(o.created_at)).startsWith(prefix));
 const groups=(await ctx.store.list('groupOrder',{},5000)).filter(r=>israelDate(new Date(r.createdAt)).startsWith(prefix)),refunds=(await ctx.store.list('refund',{},5000)).filter(r=>r.data.status==='verified_refund'&&israelDate(new Date(r.data.verifiedAt)).startsWith(prefix));
 const verifiedRevenueCents=selected.reduce((n,o)=>n+(o.paymentRecord?.amountCents||0),0)+groups.reduce((n,r)=>n+(r.data.payment?.amountCents||0),0)-refunds.reduce((n,r)=>n+r.data.amountCents,0),knownRequestValueCents=selected.reduce((n,o)=>n+o.payload.items.reduce((sum,i)=>sum+(i.price===null?0:Math.round(i.price*100)*i.quantity),0),0),top={};
 for(const o of selected.filter(o=>!['cancelled','declined'].includes(o.status)))for(const item of o.payload.items)top[item.name]=(top[item.name]||0)+item.quantity;
 for(const row of groups.filter(row=>!['cancelled','returned'].includes(row.data.status)))for(const item of row.data.items)top[item.name]=(top[item.name]||0)+item.quantity;
 const costs=(await ctx.store.list('route')).filter(r=>r.data.calculator&&r.data.stops.some(s=>s.date.startsWith(prefix))).map(r=>({slug:r.key,estimate:r.data.calculator.costCents,contribution:r.data.calculator.contributionCents}));
 return ctx.json({period,date,timezone:'Asia/Jerusalem',orders:selected.length,groupOrders:groups.length,cancellations:selected.filter(o=>['cancelled','declined'].includes(o.status)).length+groups.filter(row=>row.data.status==='cancelled').length,verifiedRevenueCents,knownRequestValueCents,unknownPriceOrders:selected.filter(o=>o.payload.items.some(i=>i.price===null)).length,topProducts:Object.entries(top).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([name,quantity])=>({name,quantity})),routeCostEstimates:costs,netProfit:null,revenueBasis:'verified_manual_payments_only',boundedToLatest:5000,space:ctx.space});
}
