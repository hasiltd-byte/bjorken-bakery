import {createHmac,createHash,timingSafeEqual} from 'node:crypto';
import {moduleError} from '../modules/core/registry.mjs';
// RFC 6238, SHA-1, 30-second periods, six digits (Authenticator-compatible).
// Provisioning is explicit via the server secret; no secret is ever sent to a browser.
function decodeBase32(value){
 const s=String(value).toUpperCase().replace(/[\s=]/g,'');if(!/^[A-Z2-7]{32,256}$/.test(s))throw moduleError('הגדרת האימות הדו־שלבי אינה תקינה בשרת.',503);
 let acc=0,bits=0;const out=[];for(const c of s){acc=(acc<<5)|'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c);bits+=5;if(bits>=8){bits-=8;out.push((acc>>>bits)&255)}}return Buffer.from(out);
}
export function totpCode(secret,step,digits=6){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));const digest=createHmac('sha1',decodeBase32(secret)).update(counter).digest(),offset=digest[digest.length-1]&15;return String((digest.readUInt32BE(offset)&0x7fffffff)%10**digits).padStart(digits,'0')}
export function matchingTotpStep(secret,code,now=Date.now()){
 if(typeof code!=='string'||!/^\d{6}$/.test(code))return null;const current=Math.floor(now/30000);let match=null;
 for(const step of [current-1,current,current+1])if(step>=0&&timingSafeEqual(Buffer.from(totpCode(secret,step)),Buffer.from(code)))match=step;
 return match;
}
export async function consumeTotp(db,businessId,secret,code,now=Date.now()){
 const step=matchingTotpStep(secret,code,now);if(step===null)throw moduleError('פרטי הכניסה או קוד האימות אינם נכונים.',401);
 const key='hasi:'+businessId+':totp:'+createHash('sha256').update(secret).digest('hex');
 await db.transaction(async()=>{const prior=Number(await db.getConfig(key,'-1'));if(prior>=step)throw moduleError('קוד האימות כבר נוצל. המתינו לקוד הבא.',401);await db.setConfig(key,String(step))});
}
