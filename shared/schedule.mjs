export const weeklyPickup=[...Array(7)].map((_,day)=>({day,enabled:day!==6,open:day===5?'08:00':'07:30',close:day===5?'13:00':'16:00'}));
export function israelDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function validDate(date){return typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date}
export function addDays(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
/** @returns {string[]} */
export function pickupTimes(settings,date,now=new Date()){
 const today=israelDate(now);if(!validDate(date)||date<today||date>addDays(today,365)||(settings.blockedDates||[]).includes(date))return [];
 const day=new Date(date+'T12:00:00Z').getUTCDay(),hours=(settings.weeklyPickup||weeklyPickup).find(h=>h.day===day);if(!hours?.enabled)return [];
 const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));let times=[];
 if(date===settings.pickupDate)times=settings.pickupSlots||[];
 else for(let m=minutes(hours.open);m<minutes(hours.close);m+=30)times.push(String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'));
 const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
 return times.filter(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t)&&t>=hours.open&&t<hours.close&&(date!==today||t>clock));
}
export function nextPickupDate(settings,now=new Date()){const today=israelDate(now);for(let i=0;i<=365;i++){const date=addDays(today,i);if(pickupTimes(settings,date,now).length)return date}return ''}
export function fridayDate(settings,now=new Date()){const today=israelDate(now);if(validDate(settings.pickupDate)&&settings.pickupDate>=today&&new Date(settings.pickupDate+'T12:00:00Z').getUTCDay()===5&&pickupTimes(settings,settings.pickupDate,now).length)return settings.pickupDate;for(let i=0;i<365;i++){const date=addDays(today,i);if(new Date(date+'T12:00:00Z').getUTCDay()===5&&pickupTimes(settings,date,now).length)return date}return ''}
const israelClock=now=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
export function requestDateAvailable(settings,date,kind='takeaway',now=new Date()){
 if(kind!=='event')return pickupTimes(settings,date,now).length>0;
 const today=israelDate(now);return validDate(date)&&date>=today&&date<=addDays(today,365)&&!(settings.blockedDates||[]).includes(date)&&(date!==today||israelClock(now)<'23:59');
}
export function requestTimeAllowed(settings,date,time,kind='takeaway',now=new Date()){
 if(kind!=='event')return pickupTimes(settings,date,now).includes(time);
 return requestDateAvailable(settings,date,kind,now)&&typeof time==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(time)&&(date!==israelDate(now)||time>israelClock(now));
}
export function nextRequestDate(settings,kind='takeaway',now=new Date()){
 if(kind!=='event')return nextPickupDate(settings,now);
 const today=israelDate(now);for(let n=0;n<=365;n++){const date=addDays(today,n);if(requestDateAvailable(settings,date,kind,now))return date}return '';
}
export function eventTimeMinimum(date,now=new Date()){
 if(date!==israelDate(now))return undefined;
 const clock=israelClock(now),minutes=Math.min(1439,Number(clock.slice(0,2))*60+Number(clock.slice(3))+1);
 return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
}
