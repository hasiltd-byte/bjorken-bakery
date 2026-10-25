export const deliveryStates={draft:'טיוטה — טרם פורסם',published:'פתוח לבקשות',closed:'ההרשמה נסגרה',ready:'מוכן ליציאה',dispatched:'יצא לחלוקה',completed:'המסלול הסתיים',cancelled:'המסלול בוטל'};
export function publicDeliveryPath(slug,space='live'){return typeof slug==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&['demo','live'].includes(space)?'/delivery/'+encodeURIComponent(slug)+'?'+new URLSearchParams({space}):null}
export function suggestedDeliverySlug(title){const map={'א':'a','ב':'b','ג':'g','ד':'d','ה':'h','ו':'u','ז':'z','ח':'h','ט':'t','י':'i','כ':'k','ך':'k','ל':'l','מ':'m','ם':'m','נ':'n','ן':'n','ס':'s','ע':'a','פ':'p','ף':'p','צ':'ts','ץ':'ts','ק':'k','ר':'r','ש':'sh','ת':'t'};return [...String(title).normalize('NFD').toLowerCase()].map(c=>map[c]||c).join('').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70).replace(/-$/,'')}
export function israelLocalValue(iso){if(!iso)return '';const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`}
export function israelLocalToIso(local){
 if(typeof local!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))return null;
 const target=Date.parse(local+':00Z');if(!Number.isFinite(target))return null;let stamp=target;
 for(let i=0;i<3;i++){const rendered=Date.parse(israelLocalValue(new Date(stamp).toISOString())+':00Z');stamp+=target-rendered}
 return israelLocalValue(new Date(stamp).toISOString())===local?new Date(stamp).toISOString():null;
}
