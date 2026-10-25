import type {Data} from './useWorkspace';
const money=(n:number|null|undefined)=>n==null?'לא ידוע':'₪'+(n/100).toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2});
const number=(n:unknown)=>n==null?'חסר':String(n);
const nis=(n:number|null|undefined)=>n==null?'חסר':money(n);
export default function CalculationBreakdown({forecast,actual}:{forecast?:Data|null;actual?:Data|null}){
 const costs=forecast?.routeCosts||actual?.routeCosts,n=costs?.normalized||{},count=forecast?.inputs.expectedOrders??(actual?.routeCostBasis==='documented'?costs?.orderCount:actual?.verifiedPaidOrders)??null;
 const multiply=(value:number|null|undefined)=>value==null||count==null?null:value*count;
 const input=forecast?.inputs||{},rows:Array<[string,string,number|null|undefined]>=[
 ['דלק',n.fuelEfficiencyUnit==='km_per_liter'?`${number(n.distanceKm)} ק״מ ÷ ${number(n.fuelEfficiencyValue)} ק״מ לליטר × ${nis(n.fuelPriceCents)}`:`${number(n.distanceKm)} ק״מ × ${number(n.fuelEfficiencyValue)} ליטר ל־100 ק״מ ÷ 100 × ${nis(n.fuelPriceCents)}`,costs?.fuelCents],
 ['בלאי',`${number(n.distanceKm)} ק״מ × ${nis(n.wearPerKmCents)} לק״מ`,costs?.wearCents],
 ['עבודת נהיגה וחלוקה',`${number(n.minutes)} דקות ÷ 60 × ${nis(n.hourlyCents)} לשעה`,costs?.laborCents],
 ['אריזה קבועה נוספת','הוצאה קבועה שנרשמה בנפרד',n.packagingFixedCents],
 ['אריזה נוספת להזמנות',`${number(count)} הזמנות × ${nis(n.packagingPerOrderCents)}`,multiply(n.packagingPerOrderCents)],
 ['סליקה קבועה','הוצאה קבועה שהוזנה; אין ספק מחובר',n.processingFixedCents],
 ['סליקה לפי הזמנה',`${number(count)} הזמנות × ${nis(n.processingPerOrderCents)}`,multiply(n.processingPerOrderCents)],
 ['סך דרך ועבודה קבועות','דלק + בלאי + עבודה + אריזה וסליקה קבועות',costs?.fixedCents],
 ['סך עלות המסלול','הוצאות קבועות + הוצאות להזמנות',costs?.totalCents]
 ];
 if(forecast)rows.push(['הכנסת מוצרים צפויה',`${number(count)} הזמנות × ${nis(input.averageBasketCents)} סל ממוצע נטו`,forecast.expectedProductRevenueCents],['הכנסת משלוח צפויה',forecast.freeShippingApplied?'סף חינם הושג — ללא הכנסת משלוח':`${number(count)} הזמנות × ${nis(input.shippingPerOrderCents)}`,forecast.expectedShippingRevenueCents],['עלות מוצרים צפויה',input.productCostMethod==='margin'?`${number(count)} × ${nis(input.averageBasketCents)} × (100 − ${number(input.marginPercent)}%)`:`${number(count)} × ${nis(input.basketCostCents)} עלות סל`,forecast.expectedProductCostCents],['סך הכנסה צפויה','מוצרים + משלוח',forecast.expectedRevenueCents],['סך עלויות צפוי','מוצרים + מסלול',forecast.expectedTotalCostCents],['תרומה משוערת אחרי העלויות','הכנסה צפויה פחות מוצרים ומסלול; אינה רווח נקי',forecast.expectedContributionCents]);
 if(actual)rows.push(['תקבולים מאומתים','תשלומים ידניים מההזמנות במסד',actual.verifiedReceiptsCents],['החזרים מאומתים','החזרים שתועדו ואומתו במסד',actual.verifiedRefundsCents],['תקבולים נטו','תקבולים פחות החזרים',actual.netVerifiedReceiptsCents],['עלות מוצרים ידועה בלבד','לפי snapshots בהזמנות; חסר אינו אפס',actual.costCoveragePercent==null?null:actual.knownProductCostCents],['תרומה משוערת בפועל','תקבולים נטו פחות עלויות ידועות ומסלול, רק בכיסוי מלא',actual.estimatedContributionCents]);
 return <div className="pilot-table-wrap"><table className="pilot-table" aria-label={forecast?'פירוט חישוב התחזית':'פירוט תוצאות המסלול'}><thead><tr><th scope="col">רכיב</th><th scope="col">נתונים ונוסחה</th><th scope="col">סכום בשקלים (₪)</th></tr></thead><tbody>{rows.map(([label,formula,value])=><tr key={label}><th scope="row">{label}</th><td>{formula}</td><td><bdi>{money(value)}</bdi></td></tr>)}</tbody></table></div>;
}
