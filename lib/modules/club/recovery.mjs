import {randomInt} from 'node:crypto';
import {moduleError,requireRole} from '../core/registry.mjs';
import {secret,hash,text} from '../core/validation.mjs';
import {normalizedPhone} from '../../../shared/order.mjs';
const ip=ctx=>ctx.request.headers.get('x-forwarded-for')||'local';
export async function recoveryRoutes(ctx,path){
 const {store,db,method,json}=ctx;
 if(path==='/public/club/recovery'&&method==='POST'){
  ctx.rate('club-recovery:'+ip(ctx),6);const b=await ctx.body(),phone=normalizedPhone(b.phone);if(!phone)throw moduleError('מספר טלפון אינו תקין.');const token=secret(),challenge=String(randomInt(100000,1000000)),key=hash(token);
  await store.add('clubRecovery',{memberKey:hash(phone),challengeHash:hash(challenge),expiresAt:Date.now()+15*60000,status:'pending',attempts:0},key);
  return json({requestToken:token,challenge,expiresInMinutes:15,message:'אם יש חברות במספר זה, בעל העסק יוכל להתקשר למספר הרשום ולאמת איתכם את מספר הבקשה המוצג. זה אינו קוד SMS. אין למסור קישור ללא בדיקה.'},202);
 }
 const match=path.match(/^\/public\/club\/recovery\/([a-f0-9]{48})$/);
 if(match){ctx.rate('club-recovery-poll:'+ip(ctx),120);const key=hash(match[1]),row=await store.get('clubRecovery',key);if(!row||row.data.expiresAt<=Date.now()||row.data.status==='consumed')throw moduleError('בקשת השחזור פגה. פתחו בקשה חדשה.',410);
  if(method==='GET')return json({status:row.data.status});
  if(method==='POST'){if(!ctx.ready)throw moduleError('שחזור אינו זמין במצב Preview.',403);const result=await db.transaction(async()=>{const current=await store.get('clubRecovery',key);if(current.data.status!=='approved'||current.data.expiresAt<=Date.now())throw moduleError('טרם בוצע אימות מול בעל העסק.',409);const member=await store.get('member',current.data.memberKey);if(!member||member.data.status==='deleted')throw moduleError('אין חברות לשחזור.',409);const token=secret();await store.set('member',member.key,{...member.data,tokenHash:hash(token)},member.revision);await store.set('clubRecovery',key,{...current.data,status:'consumed',consumedAt:Date.now()},current.revision);await store.audit('club.recovery.consumed',null,key);return token});return json({manageUrl:'/club/manage/'+result+'?space='+ctx.space,message:'הקישור האישי הוחלף. הקישור הישן אינו תקף.'})}
 }
 if(path==='/club/recoveries'&&method==='GET'){requireRole(ctx.actor,['admin']);const pending=await store.list('clubRecovery',{'data.status':'pending','data.expiresAt':{$gt:Date.now()}},100),rows=[];for(const r of pending){const member=await store.get('member',r.data.memberKey);if(member&&member.data.status!=='deleted')rows.push({id:r.key,revision:r.revision,name:member.data.name,phone:member.data.phone,expiresAt:r.data.expiresAt})}return json({requests:rows,verification:'outbound_call_to_registered_phone'})}
 const approval=path.match(/^\/club\/recoveries\/([a-f0-9]{64})$/);
 if(approval&&method==='POST'){requireRole(ctx.actor,['admin']);ctx.rate('club-recovery-approval:'+ctx.actor.username,12);const b=await ctx.body();if(b.outboundCallVerified!==true||!await ctx.verifyOwner(b.ownerPassword))throw moduleError('נדרשים סיסמת מנהל ואישור שהתקשרתם למספר הרשום.',403);const reference=text(b.reference,5,200);
  const approved=await db.transaction(async()=>{const row=await store.get('clubRecovery',approval[1]);if(!row||row.data.expiresAt<=Date.now()||row.data.status!=='pending'||row.data.attempts>=5||!await store.get('member',row.data.memberKey))throw moduleError('בקשת שחזור אינה זמינה.',409);if(hash(String(b.challenge))!==row.data.challengeHash){await store.set('clubRecovery',row.key,{...row.data,attempts:row.data.attempts+1},row.revision);return false}await store.set('clubRecovery',row.key,{...row.data,status:'approved',verifiedAt:Date.now(),verifiedBy:ctx.actor.username,verificationMethod:'outbound_call_to_registered_phone',reference},row.revision);await store.audit('club.recovery.approved',ctx.actor,row.key,{method:'outbound_call_to_registered_phone'});return true});if(!approved)throw moduleError('מספר הבקשה לא תואם.',403);return json({ok:true,message:'החבר יכול לקבל קישור חדש בדפדפן שפתח את הבקשה. לא נשלחה הודעה.'});
 }
 return null;
}
