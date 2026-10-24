import test from 'node:test';
import assert from 'node:assert/strict';
import {totpCode,matchingTotpStep,consumeTotp} from '../lib/server/totp.mjs';
import {pilotFixture} from './helpers/pilot.mjs';
const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // Public RFC 6238 test vector, not a real credential.
test('TOTP matches RFC 6238 SHA-1 vectors, rejects invalid/old codes and atomically prevents replay',async()=>{
 for(const [seconds,expected]of [[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']])assert.equal(totpCode(secret,Math.floor(seconds/30),8),expected);
 const now=Date.parse('2026-10-24T10:00:00Z'),step=Math.floor(now/30000),code=totpCode(secret,step);assert.equal(matchingTotpStep(secret,code,now),step);assert.equal(matchingTotpStep(secret,'wrong',now),null);assert.equal(matchingTotpStep(secret,totpCode(secret,step-3),now),null);
 const f=await pilotFixture();try{const attempts=await Promise.allSettled([consumeTotp(f.db,'bjorken',secret,code,now),consumeTotp(f.db,'bjorken',secret,code,now)]);assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);assert.equal(attempts.filter(x=>x.status==='rejected').length,1)}finally{await f.close()}
});
test('Owner MFA when configured blocks old sessions and password-only login; no secret is exposed',async()=>{
 const f=await pilotFixture(),prior=process.env.BJORKEN_ADMIN_TOTP_SECRET;
 try{process.env.BJORKEN_ADMIN_TOTP_SECRET=secret;assert.equal((await f.call('/security')).status,401);assert.equal((await f.call('/login','POST',{username:'review-owner',password:'Isolated-owner-pass-2026'},'public')).status,401);const login=await f.call('/login','POST',{username:'review-owner',password:'Isolated-owner-pass-2026',otp:totpCode(secret,Math.floor(Date.now()/30000))},'public');assert.equal(login.status,200);f.cookies.admin=login.response.headers.get('set-cookie').split(';')[0];const security=await f.call('/security');assert.equal(security.data.mfaStatus,'enabled');assert.ok(!JSON.stringify(security.data).includes(secret));assert.equal((await f.call('/login','POST',{username:'review-owner',password:'Isolated-owner-pass-2026',otp:totpCode(secret,Math.floor(Date.now()/30000))},'public')).status,401)}finally{if(prior===undefined)delete process.env.BJORKEN_ADMIN_TOTP_SECRET;else process.env.BJORKEN_ADMIN_TOTP_SECRET=prior;await f.close()}
});
