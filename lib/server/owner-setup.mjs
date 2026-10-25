// Operator-only functions. Never import this module from a public Route Handler.
import {randomBytes} from 'node:crypto';
import {ownerAuth,passwordFields} from './auth.mjs';
import {scopedStore} from '../modules/core/store.mjs';
import {moduleError} from '../modules/core/registry.mjs';

const temporaryPassword=()=>randomBytes(24).toString('base64url')+'A7!';
const key=businessId=>'hasi:'+businessId+':ownerAuth';
const actor={username:'operator-setup',role:'operator'};

export async function provisionOwner(db,businessId,{username='bjorken-owner'}={}){
 if(!/^[a-zA-Z0-9_-]{3,60}$/.test(username))throw moduleError('Invalid owner username.');
 // Generate once outside the retried transaction; never store or audit plaintext.
 const password=temporaryPassword();
 return db.transaction(async()=>{
  const existing=await ownerAuth(db,businessId);
  if(existing)return {created:false,username:existing.username||null,mustChangePassword:!!existing.mustChangePassword};
  if(await db.one('StaffUser',{businessId,username}))throw moduleError('Username already belongs to a staff account.',409);
  const record={username,...passwordFields(password),authVersion:randomBytes(16).toString('hex'),mustChangePassword:true,createdAt:Date.now(),changedAt:Date.now(),source:'operator-setup-v1'};
  await db.setConfig(key(businessId),JSON.stringify(record));
  await db.removeMany('StaffSession',{businessId,role:'admin'});
  await scopedStore(db,businessId,'live').audit('security.owner.created',actor,username);
  return {created:true,username,temporaryPassword:password,mustChangePassword:true};
 });
}

export async function resetOwner(db,businessId){
 const password=temporaryPassword();
 return db.transaction(async()=>{
  const record=await ownerAuth(db,businessId);
  if(!record?.username)throw moduleError('Provision or migrate the named Mongo owner first.',409);
  await db.setConfig(key(businessId),JSON.stringify({...record,...passwordFields(password),authVersion:randomBytes(16).toString('hex'),mustChangePassword:true,changedAt:Date.now()}));
  await db.removeMany('StaffSession',{businessId,username:record.username});
  await scopedStore(db,businessId,'live').audit('security.owner.reset',actor,record.username);
  return {username:record.username,temporaryPassword:password,mustChangePassword:true};
 });
}
