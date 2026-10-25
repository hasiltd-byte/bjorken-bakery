import test from 'node:test';
import assert from 'node:assert/strict';
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {createService} from '../lib/server/service.mjs';
import {ownerAuth,verifyPassword,passwordFields} from '../lib/server/auth.mjs';
import {provisionOwner,resetOwner} from '../lib/server/owner-setup.mjs';
import {activateBjorken,activationFeatures} from '../lib/server/bjorken-activation.mjs';
import {setupTarget} from '../lib/server/setup-target.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

test('operator target guard blocks unverified or mismatched production writes before connection',()=>{
 const uri='mongodb+srv://unused:unused@example.mongodb.net/bjorken_dev',now=Date.now();
 const approval={businessId:'bjorken',productionDeploymentApproved:true,vercelTargetVerified:true,mongoHost:'example.mongodb.net',mongoDatabase:'bjorken_dev',siteUrl:'https://bjorken-bakery.vercel.app',projectId:'prj_test',deploymentId:'dpl_test',reviewedCommit:'a'.repeat(40),approvedAt:new Date(now).toISOString()};
 assert.deepEqual(setupTarget(uri),{host:'example.mongodb.net',database:'bjorken_dev'});
 assert.throws(()=>setupTarget(uri,null,null,{apply:true}));
 for(const change of [{mongoDatabase:'bjorken_other'},{mongoHost:'other.mongodb.net'},{productionDeploymentApproved:false},{vercelTargetVerified:false},{approvedAt:'2020-01-01'}, {reviewedCommit:'main'}])assert.throws(()=>setupTarget(uri,null,{...approval,...change},{apply:true,now}));
 assert.equal(setupTarget(uri,null,approval,{apply:true,now}).database,'bjorken_dev');
 assert.throws(()=>setupTarget(uri,null,null,{apply:true,localTest:true}));
 assert.throws(()=>setupTarget('mongodb://localhost/bjorken_dev',null,null,{apply:true,localTest:true}));
 assert.equal(setupTarget('mongodb://127.0.0.1/bjorken_test',null,null,{apply:true,localTest:true}).database,'bjorken_test');
 assert.throws(()=>setupTarget('mongodb://localhost/cotta'));
});

test('legacy hash migration preserves the environment identity and never restores its old password',async()=>{
 const mongo=await MongoMemoryReplSet.create({binary:{downloadDir:'.local/mongodb-binaries'},replSet:{count:1}});let service;
 try{
  const options={mongoUri:mongo.getUri('bjorken_test'),dbName:'bjorken_test',username:'legacy-owner',password:'Environment-password-2026',totpSecret:''};service=await createService(options);
  const key='hasi:bjorken:ownerAuth',oldPassword='Legacy-stored-password-2026';await service.db.setConfig(key,JSON.stringify({...passwordFields(oldPassword),changedAt:123}));
  const existing=await provisionOwner(service.db,'bjorken');assert.equal(existing.created,false);assert.equal(existing.temporaryPassword,undefined);
  async function post(path,data,cookie=''){const response=await service.handle(new Request('http://localhost/order/api'+path,{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(data)}));return {status:response.status,data:await response.json(),response}}
  assert.equal((await post('/login',{username:'legacy-owner',password:options.password})).status,401);
  const login=await post('/login',{username:'legacy-owner',password:oldPassword});assert.equal(login.status,200);const cookie=login.response.headers.get('set-cookie').split(';')[0],newPassword='Migrated-owner-password-2026';
  assert.equal((await post('/security/password',{currentPassword:oldPassword,newPassword},cookie)).status,200);
  const record=await ownerAuth(service.db,'bjorken');assert.equal(record.username,'legacy-owner');assert.equal(record.mustChangePassword,false);
  await service.close();service=await createService({...options,username:'',password:''});assert.equal((await post('/login',{username:'legacy-owner',password:newPassword})).status,200);
  assert.equal((await post('/login',{username:'legacy-owner',password:oldPassword})).status,401);
 }finally{await service?.close();await mongo.stop()}
});

test('Mongo owner is authoritative without environment credentials, first change, expiry, reset and role restrictions',async()=>{
 const mongo=await MongoMemoryReplSet.create({binary:{downloadDir:'.local/mongodb-binaries'},replSet:{count:1}});let service;
 const options={mongoUri:mongo.getUri('bjorken_test'),dbName:'bjorken_test',username:'old-env-owner',password:'Old-bootstrap-pass-2026',totpSecret:''};
 const oldFlag=process.env.BJORKEN_ENABLE_LIVE;process.env.BJORKEN_ENABLE_LIVE='true';
 try{
  service=await createService(options);let cookie='';
  async function call(path,method='GET',data,session=cookie){const response=await service.handle(new Request('http://localhost/order/api'+path,{method,headers:{...(session?{cookie:session}:{}),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}));return {status:response.status,data:await response.json(),response}}
  const login=async(username,password)=>call('/login','POST',{username,password});
  const sessionOf=r=>r.response.headers.get('set-cookie').split(';')[0];
  const bootstrap=await login(options.username,options.password);assert.equal(bootstrap.status,200);const bootstrapCookie=sessionOf(bootstrap);
  const legacyToken='b'.repeat(64);await service.db.create('StaffSession',{token:legacyToken,username:'bjorken-owner',expiresAt:new Date(Date.now()+3600000)});
  const results=await Promise.all([provisionOwner(service.db,'bjorken'),provisionOwner(service.db,'bjorken')]);
  assert.equal(results.filter(r=>r.created).length,1);const created=results.find(r=>r.created),repeated=results.find(r=>!r.created);
  assert.equal(repeated.temporaryPassword,undefined);assert.equal((await call('/admin/products','GET',undefined,bootstrapCookie)).status,401);
  assert.equal((await call('/admin/products','GET',undefined,'bjorken_staff='+legacyToken)).status,401);
  const stored=await ownerAuth(service.db,'bjorken');assert.equal(stored.username,'bjorken-owner');assert.ok(verifyPassword(created.temporaryPassword,stored));assert.ok(!JSON.stringify(stored).includes(created.temporaryPassword));
  await service.close();service=await createService({...options,username:'',password:''});
  const temp=await login('bjorken-owner',created.temporaryPassword);assert.equal(temp.status,200);assert.equal(temp.data.mustChangePassword,true);cookie=sessionOf(temp);
  assert.equal((await call('/modules/me')).status,428);assert.equal((await call('/security')).data.username,'bjorken-owner');
  await assert.rejects(()=>activateBjorken(service.db,{whatsapp:'0504453592',imagesApproved:true,reference:'isolated-owner-approval'}),{status:409});
  const replacement='New-permanent-owner-pass-2026';
  assert.equal((await call('/security/password','POST',{currentPassword:created.temporaryPassword,newPassword:replacement})).status,200);
  assert.equal((await call('/security')).status,401);
  const changed=await ownerAuth(service.db,'bjorken');assert.equal(changed.username,stored.username);assert.equal(changed.createdAt,stored.createdAt);assert.equal(changed.mustChangePassword,false);
  await service.close();service=await createService({...options,username:'different-env-owner',password:'Different-env-pass-2026'});
  assert.equal((await login('different-env-owner','Different-env-pass-2026')).status,401);
  assert.equal((await login('bjorken-owner',created.temporaryPassword)).status,401);
  const permanent=await login('bjorken-owner',replacement);assert.equal(permanent.status,200);assert.equal(permanent.data.mustChangePassword,false);cookie=sessionOf(permanent);
  const secondCookie=sessionOf(await login('bjorken-owner',replacement));
  assert.equal((await call('/modules/costs')).status,403);
  await assert.rejects(()=>activateBjorken(service.db,{businessId:'other',whatsapp:'0504453592',imagesApproved:true,reference:'isolated-approval'}),{status:403});
  await assert.rejects(()=>activateBjorken(service.db,{whatsapp:'0501111111',imagesApproved:true,reference:'isolated-approval'}));
  const now=Date.now(),activation=await activateBjorken(service.db,{whatsapp:'0504453592',imagesApproved:true,reference:'isolated-approval',now});
  assert.equal(activation.activated,true);assert.equal(new Date(activation.expiresAt).getUTCFullYear(),new Date(now).getUTCFullYear()+1);
  const repeat=await activateBjorken(service.db,{whatsapp:'0504453592',imagesApproved:true,reference:'isolated-approval',now:now+86400000});assert.equal(repeat.activated,false);assert.equal(repeat.expiresAt,activation.expiresAt);
  const grants=JSON.parse(await service.db.getConfig('hasi:bjorken:licenses'));assert.deepEqual(Object.keys(grants).sort(),[...activationFeatures].sort());
  assert.ok(Object.values(grants).every(g=>g.expiresAt===activation.expiresAt&&g.chargeMode==='no_charge_owner_approval'));
  const me=await call('/modules/me');assert.ok(['ordersPro',...activationFeatures].every(k=>me.data.features[k].allowed));assert.equal(me.data.capabilities.productCosts.allowed,true);
  const menu=await call('/menu');assert.equal(menu.data.live,true);assert.equal(menu.data.settings.whatsapp,'0504453592');assert.equal(menu.data.settings.imagesApproved,true);assert.ok(menu.data.products.every(p=>p.price===null));
  const routes=await call('/modules/delivery/routes');assert.equal(routes.data.readiness.canAcceptOrders,false);assert.equal(routes.data.readiness.unpricedProducts,10);
  assert.equal((await call('/modules/staff','POST',{username:'bjorken-owner',password:'Staff-password-2026',role:'manager'})).status,400);
  for(const role of ['manager','cashier','kitchen','driver']){
   const username='role-'+role;assert.equal((await call('/modules/staff','POST',{username,password:'Staff-password-2026',role})).status,201);
   const staffCookie=sessionOf(await login(username,'Staff-password-2026'));
   assert.equal((await call('/modules/me','GET',undefined,staffCookie)).status,200);
   assert.equal((await call('/modules/licenses','PATCH',{feature:'club',status:'disabled'},staffCookie)).status,403);
   assert.equal((await call('/modules/staff','GET',undefined,staffCookie)).status,403);
   if(role!=='manager'){
    assert.equal((await call('/admin/products','GET',undefined,staffCookie)).status,403);
    assert.equal((await call('/modules/costs','GET',undefined,staffCookie)).status,403);
   }
  }
  const reset=await resetOwner(service.db,'bjorken');assert.equal(reset.username,'bjorken-owner');assert.equal((await call('/modules/me')).status,401);assert.equal((await call('/security','GET',undefined,secondCookie)).status,401);
  assert.equal((await ownerAuth(service.db,'bjorken')).mustChangePassword,true);assert.ok(verifyPassword(reset.temporaryPassword,await ownerAuth(service.db,'bjorken')));
  const audit=await service.db.find('ModuleRecord',{kind:'audit'});assert.ok(!JSON.stringify(audit).includes(created.temporaryPassword));assert.ok(!JSON.stringify(audit).includes(reset.temporaryPassword));
  const commandEnv={...process.env,MONGODB_URI:options.mongoUri,MONGO_URI:options.mongoUri,MONGO_DB_NAME:'bjorken_test'};
  const exec=promisify(execFile);
  const inspected=JSON.parse((await exec(process.execPath,['scripts/setup-owner.mjs'],{env:commandEnv})).stdout);assert.equal(inspected.readOnly,true);assert.equal(inspected.owner.username,'bjorken-owner');assert.ok(!JSON.stringify(inspected).includes(reset.temporaryPassword));
  const cliRepeat=JSON.parse((await exec(process.execPath,['scripts/setup-owner.mjs','--apply','--local-test'],{env:commandEnv})).stdout);assert.equal(cliRepeat.created,false);assert.equal(cliRepeat.temporaryPassword,undefined);
  await assert.rejects(()=>exec(process.execPath,['scripts/setup-owner.mjs','--apply'],{env:commandEnv}));
 }finally{if(oldFlag===undefined)delete process.env.BJORKEN_ENABLE_LIVE;else process.env.BJORKEN_ENABLE_LIVE=oldFlag;await service?.close();await mongo.stop()}
});
