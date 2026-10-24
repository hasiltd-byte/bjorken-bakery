'use client';
import {useState} from 'react';
import {useWorkspaceData,type Data} from './useWorkspace';
import {israelDate} from '../../shared/schedule.mjs';
const money=(n:number)=>'₪'+((n||0)/100).toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2});
export default function ReportsPanel({space}:{space:string}){
 const [date,setDate]=useState(israelDate()),[period,setPeriod]=useState('day'),{data,error}=useWorkspaceData('/reports?period='+period+'&date='+date,space);
 const cards=data?{'בקשות הזמנה':data.orders,'הזמנות מאושרות מבקשות התקופה':data.confirmedOrders,'בקשות משלוח קבוצתי':data.groupOrders,'ביטולים / דחיות':data.cancellations,'כסף שהתקבל ואומת בתקופה':money(data.verifiedReceiptsCents),'החזרים שאומתו בתקופה':money(data.verifiedRefundsCents),'תקבולים ידניים מאומתים בניכוי זיכויים':money(data.verifiedRevenueCents),'דמי משלוח שהתקבלו':money(data.shippingReceiptsCents),'יתרות ידועות של בקשות התקופה':money(data.knownBalancesCents),'שווי מוצרים ידוע בבקשות — אינו תקבול':money(data.knownRequestValueCents),'בקשות עם מחיר לא מאושר':data.unknownPriceOrders}:null;
 return <section><h2>תמונת מצב עסקית</h2><div className="form-row"><label>תקופה<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="day">יומי</option><option value="month">חודשי</option></select></label><label>תאריך בישראל<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div>
 {error&&<p className="pilot-error" role="alert">{error}</p>}{data&&<><div className="pilot-grid">{Object.entries(cards!).map(([label,value])=><article className="pilot-card" key={label}><h3>{label}</h3><p className="pilot-stat">{value}</p></article>)}</div>
 <p className="pilot-muted">התקבולים וההחזרים משויכים לתאריך אימותם לפי שעון ישראל; הבקשות לתאריך יצירתן. התיעוד ידני ולא אומת מול ספק סליקה. יתרות הן מצב נוכחי של בקשות התקופה. שווי בקשות אינו תקבול או רווח נקי.</p>
 {data.paymentsWithoutVerifiedDate>0&&<p className="pilot-banner">{data.paymentsWithoutVerifiedDate} תשלומים היסטוריים ללא מועד אימות אינם משויכים לתקופה. לא הומצאו עבורם תאריכים.</p>}
 <p>זיכויים שטרם אומתו: {money(data.pendingRefundsCents)}. הדוח מוגבל ל־{data.boundedToLatest} הרשומות האחרונות מכל סוג; אינו דוח חשבונאי מלא.</p>
 <h3>מוצרים מובילים בבקשות פעילות</h3>{data.topProducts.map((p:Data)=><p key={p.name}>{p.name}: {p.quantity} יחידות</p>)}
 <h3>אומדני עלויות מסלולים שהוזנו</h3>{data.routeCostEstimates.map((r:Data)=><p key={r.slug}>{r.slug}: עלות {money(r.estimate)} · תרומה משוערת {money(r.contribution)}</p>)}{!data.routeCostEstimates.length&&<p>לא הוזנו אומדני עלות לתקופה זו. לא מחושב רווח.</p>}</>}
 </section>;
}
