export const statuses=['pending_confirmation','confirmed','preparing','ready','collected','declined','cancelled'];
export {israelDate} from './schedule.mjs';
export function normalizedPhone(value){const n=String(value).replace(/[\s()+-]/g,'');return /^05\d{8}$/.test(n)?'972'+n.slice(1):/^9725\d{8}$/.test(n)?n:null}
// Operational order controls. Editorial image/catalog approvals remain separate publishing records.
export function liveReady(s,enabled=process.env.BJORKEN_ENABLE_LIVE==='true',now=new Date()){return !!(enabled&&s.ordersOpen&&s.whatsappVerified&&normalizedPhone(s.whatsapp)&&s.ownerApproved&&(!s.closeAt||new Date(s.closeAt)>now))}
export function formatPrice(price){return price==null?'מחיר באישור המאפייה':'₪'+price.toLocaleString('he-IL')}
export function orderMessage(payload){return ['בקשת הזמנה — בכפוף לאישור המאפייה','סוג בקשה: '+(payload.kind==='event'?'מאפים לאירוע — בקשת הצעה':'טייק אווי — איסוף מהמאפייה'),'שם: '+payload.name,'טלפון: '+payload.phone,'איסוף מבוקש: '+payload.date+' · '+payload.pickup,...(payload.kind==='event'?['מספר משתתפים: '+payload.guests]:[]),...(payload.items||[]).map(i=>`${i.quantity} × ${i.name} — ${formatPrice(i.price)}`),'הערה: '+(payload.notes||'ללא'),'המאפים, המחיר ושעת האיסוף יאושרו על ידי המאפייה ב-WhatsApp. התשלום בעת האיסוף.'].join('\n')}
