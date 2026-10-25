'use client';
import {useState} from 'react';
import {request,type Data} from './useWorkspace';
export default function OrderQuote({order,space='live',base=false,onSaved}:{order:Data;space?:string;base?:boolean;onSaved:()=>void}){
 const [problem,setProblem]=useState(''),[busy,setBusy]=useState(false),[agreed,setAgreed]=useState(false);
 if(!['pending_confirmation','confirmed'].includes(order.status))return null;
 return <details className="pilot-card"><summary>מחיר סופי והסכמת לקוח</summary><p>מחיר חסר דורש מחיר מספרי והסכמת הלקוח לפני אישור. אפשר לתעד הסכמה בשיחה או להפנות את הלקוח לקישור המעקב. אין חיוב אוטומטי.</p>{order.finalQuote&&<p>הצעה #{order.finalQuote.version}: ₪{(order.finalQuote.totalCents/100).toFixed(2)} · {order.finalQuote.customerAgreedAt?'הסכמת לקוח תועדה':'ממתינה להסכמת הלקוח'}</p>}
 <form onSubmit={async e=>{e.preventDefault();setBusy(true);setProblem('');try{const f=new FormData(e.currentTarget),unitPrices:Data={};for(const item of order.payload.items)unitPrices[item.id]=Number(f.get('price-'+item.id));const path=base?'/admin/orders/'+order.id+'/quote':'/modules/orders/'+order.id+'/quote?space='+space;await request(path,'PATCH',{updated_at:order.updated_at,unitPrices,eventPrice:order.payload.items.length?undefined:Number(f.get('eventPrice')),deliveryFee:order.payload.kind==='delivery'?Number(f.get('shipping')):undefined,customerAgreed:agreed,customerAgreementReference:f.get('reference')});onSaved()}catch(e){setProblem((e as Error).message)}finally{setBusy(false)}}}>
 {order.payload.items.map((item:Data)=><label key={item.id}>מחיר יחידה — {item.name} (₪)<input name={'price-'+item.id} type="number" min="0.01" max="10000" step="0.01" required defaultValue={order.finalQuote?.lines.find((line:Data)=>line.id===item.id)?.unitPriceCents/100||item.price||''}/></label>)}
 {!order.payload.items.length&&<label>מחיר מאפים כולל לאירוע (₪)<input name="eventPrice" type="number" min="0.01" max="1000000" step="0.01" required/></label>}
 {order.payload.kind==='delivery'&&<label>דמי משלוח מאושרים (₪)<input name="shipping" type="number" min="0" max="10000" step="0.01" required defaultValue={order.finalQuote?.shippingCents/100||order.payload.deliveryFee||''}/></label>}
 <label><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/> תיעדתי הסכמת לקוח מפורשת למחיר ולפריטים בשיחה</label>{agreed&&<label>אסמכתת הסכמה — למשל תאריך ושעת שיחה<input name="reference" minLength={5} maxLength={200} required/></label>}
 <button className="secondary" disabled={busy}>שמירת הצעת המחיר</button>{problem&&<p role="alert" className="pilot-error">{problem}</p>}</form></details>;
}
