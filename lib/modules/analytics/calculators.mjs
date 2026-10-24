import {cents} from '../core/validation.mjs';
import {moduleError} from '../core/registry.mjs';

const absent=value=>value==null||value==='';
const bad=(field,message)=>Object.assign(moduleError(message),{fields:{[field]:message}});
function quantity(b,key,max=1000000){if(absent(b[key]))return null;const value=b[key];if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max)throw bad(key,'הזינו ערך מספרי תקין ולא שלילי.');return value}
function money(b,key){if(absent(b[key]))return null;try{return cents(b[key])}catch{throw bad(key,'הזינו סכום בשקלים עם עד שתי ספרות אחרי הנקודה.')}}
const sumKnown=values=>values.reduce((n,x)=>n+(x??0),0);
const fullSum=values=>values.some(x=>x===null)?null:sumKnown(values);
function roundedAmount(value){const result=Math.round(value);if(!Number.isSafeInteger(result)||result<0)throw moduleError('החישוב חורג מטווח סכומים תקין. בדקו מרחק, צריכה ועלויות.');return result}
export function routeCostComponents(b,orderCount){
 if(b.inputVersion!==2)throw bad('inputVersion','המחשבון החדש מקבל שקלים בגרסה 2. רשומות ישנות באגורות אינן מומרות בשקט.');
 if(!['special_trip','additional_stop'].includes(b.routeMode))throw bad('routeMode','בחרו יציאה מיוחדת או עצירה נוספת במסלול קיים.');
 if(!['liters_per_100km','km_per_liter'].includes(b.fuelEfficiencyUnit))throw bad('fuelEfficiencyUnit','בחרו יחידת צריכת דלק מפורשת.');
 const distanceKm=quantity(b,'distanceKm'),minutes=quantity(b,'minutes'),efficiency=quantity(b,'fuelEfficiencyValue',1000);
 if(efficiency===0)throw bad('fuelEfficiencyValue','צריכת הדלק חייבת להיות גדולה מאפס, או השאירו ריק אם אינה ידועה.');
 const normalized={inputVersion:2,routeMode:b.routeMode,distanceKm,minutes,fuelEfficiencyUnit:b.fuelEfficiencyUnit,fuelEfficiencyValue:efficiency};
 for(const key of ['fuelPrice','wearPerKm','hourly','packagingFixed','packagingPerOrder','processingFixed','processingPerOrder'])normalized[key+'Cents']=money(b,key+'Nis');
 const n=normalized;
 const liters=distanceKm==null||efficiency==null?null:b.fuelEfficiencyUnit==='liters_per_100km'?distanceKm*efficiency/100:distanceKm/efficiency;
 const fuelCents=liters==null||n.fuelPriceCents==null?null:roundedAmount(liters*n.fuelPriceCents),wearCents=distanceKm==null||n.wearPerKmCents==null?null:roundedAmount(distanceKm*n.wearPerKmCents),laborCents=minutes==null||n.hourlyCents==null?null:roundedAmount(minutes*n.hourlyCents/60);
 const fixed=[fuelCents,wearCents,laborCents,n.packagingFixedCents,n.processingFixedCents],perOrder=[n.packagingPerOrderCents,n.processingPerOrderCents];
 const fixedCents=fullSum(fixed),variablePerOrderCents=fullSum(perOrder),variableCents=variablePerOrderCents==null||orderCount==null?null:variablePerOrderCents*orderCount;
 return {normalized,fuelCents,wearCents,laborCents,knownFixedCents:sumKnown(fixed),fixedCents,variablePerOrderCents,totalCents:fixedCents==null||variableCents==null?null:fixedCents+variableCents,knownTotalCents:sumKnown(fixed)+(orderCount==null?0:sumKnown(perOrder)*orderCount),missing:[...fixed,...perOrder].filter(v=>v===null).length,source:'manual_route_estimate'};
}
export function forecastRoute(b){
 const count=quantity(b,'expectedOrders',100000);if(count!==null&&!Number.isInteger(count))throw bad('expectedOrders','מספר הזמנות חייב להיות שלם.');
 const route=routeCostComponents(b,count),basket=money(b,'averageBasketNis'),shipping=money(b,'shippingPerOrderNis'),activation=money(b,'activationMinimumNis'),free=money(b,'freeShippingMinimumNis');
 if(!['unknown','basket_cost','margin'].includes(b.productCostMethod))throw bad('productCostMethod','בחרו עלות סל, שיעור מרווח או עלות לא ידועה.');
 let productCost=null,margin=null;if(b.productCostMethod==='basket_cost')productCost=money(b,'basketCostNis');if(b.productCostMethod==='margin'){margin=quantity(b,'marginPercent',100);productCost=basket==null||margin==null?null:Math.round(basket*(100-margin)/100)}
 if(b.basketCostIncludesPackaging===true&&(route.normalized.packagingPerOrderCents>0||route.normalized.packagingFixedCents>0)&&b.additionalPackagingConfirmed!==true)throw bad('additionalPackagingConfirmed','עלות המוצרים כבר כוללת אריזה. אשרו שהאריזה שנוספה כאן היא הוצאה נוספת נפרדת כדי למנוע כפל.');
 const productRevenue=count==null||basket==null?null:count*basket,freeApplied=free==null?null:free>0&&productRevenue!=null&&productRevenue>=free;
 const shippingRevenue=count==null||shipping==null||freeApplied==null?null:count*(freeApplied?0:shipping),revenue=productRevenue==null||shippingRevenue==null?null:productRevenue+shippingRevenue;
 const productsCost=count==null||productCost==null?null:count*productCost,totalCosts=productsCost==null||route.totalCents==null?null:productsCost+route.totalCents;
 let breakEvenOrders=null,breakEvenWithoutShippingOrders=null,freeShippingAtOrders=null;
 if(basket>0&&productCost!==null&&route.fixedCents!==null&&route.variablePerOrderCents!==null&&shipping!==null&&free!==null){
  const base=basket-productCost-route.variablePerOrderCents,withShipping=base+shipping;freeShippingAtOrders=free>0?Math.ceil(free/basket):null;
  const paid=withShipping>0?Math.ceil(route.fixedCents/withShipping):null;
  breakEvenWithoutShippingOrders=base>0?Math.ceil(route.fixedCents/base):null;
  const choices=[];if(paid!==null&&(freeShippingAtOrders===null||paid<freeShippingAtOrders))choices.push(paid);if(freeShippingAtOrders!==null&&breakEvenWithoutShippingOrders!==null)choices.push(Math.max(freeShippingAtOrders,breakEvenWithoutShippingOrders));breakEvenOrders=choices.length?Math.min(...choices):null;
 }
 return {version:2,inputUnit:'NIS',amountBasis:'forecast_only',routeMode:b.routeMode,inputs:{...route.normalized,expectedOrders:count,averageBasketCents:basket,shippingPerOrderCents:shipping,activationMinimumCents:activation,freeShippingMinimumCents:free,productCostMethod:b.productCostMethod,basketCostCents:productCost,marginPercent:margin,basketCostIncludesPackaging:!!b.basketCostIncludesPackaging,additionalPackagingConfirmed:!!b.additionalPackagingConfirmed},routeCosts:route,expectedProductRevenueCents:productRevenue,expectedShippingRevenueCents:shippingRevenue,expectedRevenueCents:revenue,expectedProductCostCents:productsCost,expectedTotalCostCents:totalCosts,expectedContributionCents:revenue==null||totalCosts==null?null:revenue-totalCosts,knownCostCents:route.knownTotalCents+(productsCost??0),complete:revenue!==null&&totalCosts!==null,breakEvenOrders,breakEvenWithoutShippingOrders,freeShippingAtOrders,minimumActivationOrders:basket>0&&activation!==null?Math.ceil(activation/basket):null,freeShippingApplied:freeApplied,formulas:{fuel:'distance / 100 × litersPer100km × fuelPrice; or distance / kmPerLiter × fuelPrice',wear:'distance × wearPerKm',labor:'minutes / 60 × hourlyRate',contribution:'expected product revenue + expected shipping − product cost − route fixed costs − variable order costs',breakEven:'ceil(fixed route costs / positive contribution per order), with a separate free-shipping segment'},netProfit:null};
}
export function legacyCalculationDto(calculator){return calculator?{...calculator,version:calculator.version||1,inputUnit:calculator.version===2?'NIS':'AGOROT_LEGACY',readOnly:true,notice:'נתון היסטורי נשמר ביחידות המקוריות. המחשבון החדש אינו מפרש אותו מחדש.'}:null}
