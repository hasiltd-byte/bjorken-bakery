import {ownerAuth} from './auth.mjs';
import {scopedStore} from '../modules/core/store.mjs';
import {moduleError} from '../modules/core/registry.mjs';
import {settings as defaults} from '../../shared/catalog.mjs';
import {normalizedPhone} from '../../shared/order.mjs';

export const activationFeatures=['foodPro','groupDelivery','club','reviews','analytics'];
export async function activateBjorken(db,{businessId='bjorken',whatsapp,imagesApproved,reference,now=Date.now()}={}){
 if(businessId!=='bjorken')throw moduleError('This approval is for Bjorken only.',403);
 if(normalizedPhone(whatsapp)!=='972504453592'||imagesApproved!==true||typeof reference!=='string'||reference.length<8)throw moduleError('Explicit approved phone, images and activation reference are required.');
 const activationKey='hasi:bjorken:activationV1';
 return db.transaction(async()=>{
  const existing=JSON.parse(await db.getConfig(activationKey,'null'));
  if(existing)return {activated:false,...existing}; // Repeat calls never extend the year.
  const owner=await ownerAuth(db,businessId);
  if(!owner?.username||owner.mustChangePassword!==false)throw moduleError('Owner must complete the first password change before activation.',409);
  const start=new Date(now),end=new Date(now);end.setUTCFullYear(end.getUTCFullYear()+1);
  const startsAt=start.toISOString(),expiresAt=end.toISOString(),previousSettings=JSON.parse(await db.getConfig('business','{}')),previousLicenses=JSON.parse(await db.getConfig('hasi:bjorken:licenses','{}'));
  const grants={...previousLicenses};
  for(const feature of activationFeatures)grants[feature]={status:'active',startsAt,expiresAt,reference,grantedBy:owner.username,updatedAt:now,chargeMode:'no_charge_owner_approval'};
  // Orders Pro is included in Food Pro, without a duplicate grant or charge.
  delete grants.ordersPro;
  const config={...defaults,...previousSettings,ordersOpen:true,ownerApproved:true,whatsapp:'0504453592',whatsappVerified:true,imagesApproved:true,revision:(previousSettings.revision||0)+1};
  if(config.closeAt&&Date.parse(config.closeAt)<=now)throw moduleError('Review the expired order closing date before activation.',409);
  const record={startsAt,expiresAt,reference,features:activationFeatures,whatsapp:'0504453592',imagesApproved:true,manualPayment:true,previousSettings,previousLicenses};
  await db.setConfig('hasi:bjorken:licenses',JSON.stringify(grants));
  await db.setConfig('business',JSON.stringify(config));
  await db.setConfig(activationKey,JSON.stringify(record));
  await scopedStore(db,businessId,'live').audit('business.activation.approved',{username:owner.username,role:'admin'},businessId,{startsAt,expiresAt,reference,whatsapp:config.whatsapp,imagesApproved:true,chargeMode:'none'});
  return {activated:true,startsAt,expiresAt,features:activationFeatures,whatsapp:config.whatsapp};
 });
}
