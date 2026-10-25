import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pilotFixture} from './helpers/pilot.mjs';
import {capabilityState} from '../lib/modules/core/entitlements.mjs';
import {forecastRoute,legacyCalculationDto} from '../lib/modules/analytics/calculators.mjs';
import {nextPickupDate,addDays,israelDate} from '../shared/schedule.mjs';
import {actualRoute} from '../lib/modules/analytics/actual.mjs';
import {routeCostComponents} from '../lib/modules/analytics/calculators.mjs';
import {scopedStore} from '../lib/modules/core/store.mjs';
import {analyticsCsv} from '../lib/modules/analytics/service.mjs';

const forecast={inputVersion:2,routeMode:'special_trip',distanceKm:40,minutes:90,fuelEfficiencyUnit:'liters_per_100km',fuelEfficiencyValue:10,fuelPriceNis:7.77,wearPerKmNis:.6,hourlyNis:50,packagingFixedNis:0,packagingPerOrderNis:0,processingFixedNis:0,processingPerOrderNis:0,expectedOrders:10,averageBasketNis:50,productCostMethod:'margin',marginPercent:50,shippingPerOrderNis:10,activationMinimumNis:200,freeShippingMinimumNis:1000};
test('Paid commercial policy is centralized: Food/Group/Analytics get costs, base and Orders Pro never get product costs',()=>{
 const grant={status:'active',expiresAt:new Date(Date.now()+86400000).toISOString()};for(const feature of ['foodPro','groupDelivery','analytics'])assert.equal(capabilityState({[feature]:grant},'productCosts').allowed,true);
 assert.equal(capabilityState({},'productCosts').allowed,false);assert.equal(capabilityState({ordersPro:grant},'productCosts').allowed,false);assert.equal(capabilityState({groupDelivery:grant},'businessAnalytics').allowed,false);assert.equal(capabilityState({foodPro:grant},'businessAnalytics').allowed,true);assert.equal(capabilityState({foodPro:grant},'productCosts','live','kitchen').allowed,false);
});
test('NIS calculator: fuel 31.08, wear 24, driver labor 75 = 130.08; forecast, free threshold and unknown costs stay distinct',()=>{
 const result=forecastRoute(forecast);assert.equal(result.routeCosts.fuelCents,3108);assert.equal(result.routeCosts.wearCents,2400);assert.equal(result.routeCosts.laborCents,7500);assert.equal(result.routeCosts.fixedCents,13008);assert.equal(result.expectedContributionCents,21992);assert.equal(result.breakEvenOrders,4);assert.equal(result.breakEvenWithoutShippingOrders,6);assert.equal(result.freeShippingAtOrders,20);assert.equal(result.netProfit,null);
 assert.equal(forecastRoute({...forecast,expectedOrders:20}).expectedShippingRevenueCents,0);assert.equal(forecastRoute({...forecast,productCostMethod:'unknown'}).expectedContributionCents,null);assert.equal(forecastRoute({...forecast,fuelPriceNis:null}).expectedTotalCostCents,null);
 assert.equal(forecastRoute({...forecast,routeMode:'additional_stop',distanceKm:2,minutes:5}).routeMode,'additional_stop');
 assert.throws(()=>forecastRoute({...forecast,basketCostIncludesPackaging:true,packagingPerOrderNis:2}),/אריזה/);
 assert.throws(()=>forecastRoute({...forecast,inputVersion:1}),/אגורות/);const old={inputs:{fuelPriceCents:7.77},costCents:1335};const copy=JSON.stringify(old),dto=legacyCalculationDto(old);assert.equal(dto.inputUnit,'AGOROT_LEGACY');assert.equal(dto.costCents,1335);assert.equal(JSON.stringify(old),copy);
});
test('Costs API is paid/role protected, snapshots freeze at reservation and every base/public order response hides them after expiry',async()=>{
 const f=await pilotFixture();try{
  const config=await f.enableShop();await f.staff('cashier');await f.staff('kitchen');await f.staff('driver');await f.db.update('MenuItem',{id:'cinnamon'},{$set:{price:20,stock:20}});
  assert.equal((await f.call('/modules/costs')).status,403);await f.license('ordersPro');assert.equal((await f.call('/modules/costs')).status,403);await f.license('foodPro');
  for(const role of ['cashier','kitchen','driver','public'])assert.ok([401,403].includes((await f.call('/modules/costs','GET',undefined,role)).status));
  assert.equal((await f.call('/modules/costs/cinnamon','PATCH',{status:'estimated',unitCostNis:7,revision:null,source:'אומדן דמו בלבד'})).status,200);
  const request=await f.call('/requests','POST',{nonce:randomUUID(),name:'לקוח בדיקה בלבד',phone:'0501234567',date:nextPickupDate(config,new Date(addDays(israelDate(),1)+'T04:00:00Z')),pickup:'09:00',notes:'',acknowledged:true,items:[{id:'cinnamon',quantity:3,costSnapshot:{unitCostCents:0}}]},'public');assert.equal(request.status,201);const order=await f.db.one('Order',{id:request.data.id});assert.equal(order.payload.items[0].costSnapshot.unitCostCents,700);assert.equal(20*100*3-700*3,3900);
  assert.equal((await f.call('/modules/costs/cinnamon','PATCH',{status:'verified',unitCostNis:9,revision:0,source:'עלות דמו מעודכנת'})).status,200);assert.equal((await f.db.one('Order',{id:order.id})).payload.items[0].costSnapshot.unitCostCents,700);
  assert.equal((await f.call('/modules/costs/bagel','PATCH',{status:'unknown',revision:null})).status,200);const unknown=(await f.call('/modules/costs')).data.products.find(p=>p.id==='bagel');assert.equal(unknown.unitCostNis,null);
  const product=(await f.call('/admin/products')).data.products.find(p=>p.id==='cinnamon');assert.equal((await f.call('/admin/products/cinnamon','PATCH',{...product,unitCostNis:1})).status,403);
  await f.license('foodPro','expired');assert.equal((await f.call('/modules/costs')).status,403);
  for(const path of ['/menu','/admin/orders',request.data.trackingUrl.replace('/track/','/tracking/')])assert.ok(!JSON.stringify((await f.call(path)).data).includes('costSnapshot'));
  const cancelled=await f.call('/admin/orders/'+order.id,'PATCH',{status:'cancelled',updated_at:order.updated_at,priceConfirmed:false,availabilityConfirmed:false});assert.equal(cancelled.status,200);assert.ok(!JSON.stringify(cancelled.data).includes('costSnapshot'));assert.equal((await f.db.one('Order',{id:order.id})).payload.items[0].costSnapshot.unitCostCents,700);
 }finally{await f.close()}
});
test('Actual results use verified receipts, frozen unit costs, net discounts/refunds and complete coverage; unknown is never a zero-cost profit',()=>{
 const now=Date.now(),row={key:'order-1',data:{status:'confirmed',subtotalCents:6000,shippingCents:0,items:[{id:'p',name:'מאפה',priceCents:2000,quantity:3,costSnapshot:{status:'estimated',unitCostCents:700}}],payment:{amountCents:6000,verifiedAt:now}}},costs={basis:'estimated',normalized:routeCostComponents({...forecast,distanceKm:0,minutes:0,fuelPriceNis:0,wearPerKmNis:0,hourlyNis:0},1).normalized};
 const full=actualRoute([row],[],costs);assert.equal(full.knownProductCostCents,2100);assert.equal(full.estimatedContributionCents,3900);assert.equal(full.costCoveragePercent,100);
 const discounted={...row,data:{...row.data,subtotalCents:5500,payment:{amountCents:5500,verifiedAt:now}}};const refund={data:{orderId:row.key,status:'verified_refund',amountCents:500,productCents:500,verifiedAt:now}};const net=actualRoute([discounted],[refund],costs);assert.equal(net.netProductReceiptsCents,5000);assert.equal(net.products[0].grossContributionCents,2900);assert.equal(net.estimatedContributionCents,2900);
 const unknown={...row,data:{...row.data,items:[{...row.data.items[0],costSnapshot:{status:'unknown',unitCostCents:null}}]}};assert.equal(actualRoute([unknown],[],costs).estimatedContributionCents,null);assert.equal(actualRoute([unknown],[],costs).costCoveragePercent,0);
 const noPayment={...row,data:{...row.data,payment:null}};assert.equal(actualRoute([noPayment],[],costs).profitabilityStatus,'no_verified_receipts');assert.equal(actualRoute([noPayment],[],costs).estimatedContributionCents,null);
 const unitemized={...row,data:{...row.data,items:[]}};assert.equal(actualRoute([unitemized],[],costs).estimatedContributionCents,null);assert.equal(actualRoute([unitemized],[],costs).unitemizedOrders,1);
 assert.equal(actualRoute([row],[{data:{orderId:row.key,status:'pending_manual_refund',amountCents:6000}}],costs).estimatedContributionCents,null);
 assert.ok(analyticsCsv([['=HYPERLINK("example")',-5]]).includes("'=HYPERLINK"));
});
test('Paid route APIs save NIS version 2 forecasts separately from actual results; old agorot endpoint is read-only',async()=>{
 const f=await pilotFixture();try{
  await f.call('/modules/demo','POST',{});await f.staff('driver');const store=scopedStore(f.db,'bjorken','demo');await store.add('route',{slug:'financial-route',title:'מסלול כספי לדמו בלבד',stops:[],closeAt:new Date(Date.now()+86400000).toISOString(),driverUsername:'review-driver',activationCents:0,freeShippingCents:0,minimumCents:0,shippingCents:0,redeliveryFeeCents:0,calculator:{costCents:1335,inputs:{fuelPriceCents:7.77}}},'financial-route');
  const base='/modules/delivery/routes/financial-route';assert.equal((await f.call(base+'/forecast?space=demo','POST',{...forecast,revision:0})).status,200);let data=(await f.call(base+'/profitability?space=demo')).data;assert.equal(data.forecast.routeCosts.fixedCents,13008);assert.equal(data.actual.profitabilityStatus,'no_verified_receipts');assert.equal(data.actual.estimatedContributionCents,null);assert.equal(data.legacyCalculation.costCents,1335);assert.equal(data.legacyCalculation.inputUnit,'AGOROT_LEGACY');
  assert.equal((await f.call(base+'/calculator?space=demo','POST',{fuelPriceCents:7.77})).status,400);assert.equal((await f.call(base+'/profitability?space=demo','GET',undefined,'driver')).status,403);
  assert.equal((await f.call(base+'/actual-costs?space=demo','PATCH',{...forecast,revision:data.revision,basis:'estimated'})).status,200);data=(await f.call(base+'/profitability?space=demo')).data;assert.equal(data.actual.routeCosts.fuelCents,3108);assert.equal(data.actual.estimatedContributionCents,null);
  const csv=await f.service.handle(new Request('http://localhost/order/api'+base+'/profitability.csv?space=demo',{headers:{cookie:f.cookies.admin}}));assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);
 }finally{await f.close()}
});
test('Repeated redelivery payments are retained and reported by verification date; duplicate evidence and refunds cannot exceed receipts',async()=>{
 const f=await pilotFixture();try{
  await f.call('/modules/demo','POST',{});const store=scopedStore(f.db,'bjorken','demo');await store.add('route',{slug:'repeat-route',title:'מסלול תשלומים חוזרים לדמו',stops:[],closeAt:new Date(Date.now()+86400000).toISOString(),activationCents:0,freeShippingCents:0,redeliveryFeeCents:1500},'repeat-route');const row=await store.add('groupOrder',{routeSlug:'repeat-route',status:'not_collected',reserved:true,subtotalCents:2000,shippingCents:1000,totalCents:3000,items:[{id:'cinnamon',name:'מאפה',quantity:1,priceCents:2000,costSnapshot:{status:'verified',unitCostCents:700}}],payment:{amountCents:3000,verifiedAt:Date.parse('2026-09-10T10:00:00Z'),reference:'initial'},timeline:[]});
  const path='/modules/delivery/reschedule/'+row.key+'?space=demo',base={method:'redelivery',note:'תיאום דמו בטוח בלבד',safeApproved:true,customerAgreed:true,paymentVerified:true,amount:15};assert.equal((await f.call(path,'POST',{...base,reference:'redelivery-one'})).status,200);assert.equal((await f.call(path,'POST',{...base,reference:'redelivery-one'})).status,409);
  await f.call('/modules/delivery/orders/'+row.key+'/status?space=demo','POST',{status:'not_collected'});assert.equal((await f.call(path,'POST',{...base,reference:'redelivery-one'})).status,409);assert.equal((await f.call(path,'POST',{...base,reference:'redelivery-two'})).status,200);const saved=await store.get('groupOrder',row.key);assert.equal(saved.data.additionalPayments.length,2);assert.equal(saved.data.items[0].costSnapshot.unitCostCents,700);
  const date=israelDate(),report=(await f.call('/modules/reports?space=demo&period=day&date='+date)).data;assert.equal(report.verifiedReceiptsCents,3000);assert.equal(report.shippingReceiptsCents,3000);
  assert.equal((await f.call('/modules/delivery/orders/'+row.key+'/status?space=demo','POST',{status:'cancelled'})).status,200);const refunds=await store.list('refund',{'data.orderId':row.key});assert.equal(refunds.reduce((n,r)=>n+r.data.amountCents,0),6000);assert.equal(refunds[0].data.productCents,2000);assert.equal(refunds[0].data.shippingCents,4000);assert.equal((await store.get('groupOrder',row.key)).data.items[0].costSnapshot.unitCostCents,700);
 }finally{await f.close()}
});
test('Actual packaging cannot be counted twice, documented route amounts and period counts remain frozen',async()=>{
 const f=await pilotFixture();try{
  await f.call('/modules/demo','POST',{});const store=scopedStore(f.db,'bjorken','demo'),slug='packing-route';await store.add('route',{slug,title:'מסלול אריזה לדמו',stops:[],closeAt:new Date(Date.now()+86400000).toISOString()},slug);const initial=await store.add('groupOrder',{routeSlug:slug,status:'confirmed',subtotalCents:2000,shippingCents:0,items:[{id:'p',name:'מוצר',quantity:1,priceCents:2000,costSnapshot:{status:'verified',unitCostCents:700,includesPackaging:true}}],payment:{amountCents:2000,verifiedAt:Date.now()},timeline:[]});const path='/modules/delivery/routes/'+slug;
  const costs={...forecast,expectedOrders:undefined,packagingPerOrderNis:2,revision:0,basis:'documented',incurredAt:new Date(Date.now()-10000).toISOString(),reference:'תיעוד הוצאה בדמו בלבד'};assert.equal((await f.call(path+'/actual-costs?space=demo','PATCH',costs)).status,400);assert.equal((await f.call(path+'/actual-costs?space=demo','PATCH',{...costs,additionalPackagingConfirmed:true})).status,200);const before=(await f.call(path+'/profitability?space=demo')).data.actual.routeCosts.totalCents;
  await store.add('groupOrder',{...initial.data,payment:{amountCents:2000,verifiedAt:Date.now()+1000}});const after=(await f.call(path+'/profitability?space=demo')).data.actual.routeCosts.totalCents;assert.equal(after,before);assert.equal((await store.get('route',slug)).data.actualCosts.paidOrderCountAtRecording,1);
 }finally{await f.close()}
});
