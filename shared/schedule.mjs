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
