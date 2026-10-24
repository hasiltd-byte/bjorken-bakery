import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {createService} from '../../lib/server/service.mjs';
import {settings} from '../../shared/catalog.mjs';
export async function pilotFixture(){
 const replica=await MongoMemoryReplSet.create({binary:{downloadDir:'.local/mongodb-binaries'},replSet:{count:1}});
 const service=await createService({mongoUri:replica.getUri('bjorken_test'),dbName:'bjorken_test',username:'review-owner',password:'Isolated-owner-pass-2026'});
 const previousFlag=process.env.BJORKEN_ENABLE_LIVE;
 const cookies={};
 async function call(path,method='GET',data,role='admin'){
  const cookie=cookies[role]||'';const response=await service.handle(new Request('http://localhost/order/api'+path,{method,headers:{...(cookie?{cookie}:{}),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}));
  return {status:response.status,data:await response.json(),response};
 }
 cookies.admin=(await call('/login','POST',{username:'review-owner',password:'Isolated-owner-pass-2026'})).response.headers.get('set-cookie').split(';')[0];
 async function staff(role){const username='review-'+role;await call('/modules/staff','POST',{username,password:'Isolated-staff-pass-2026',role});cookies[role]=(await call('/login','POST',{username,password:'Isolated-staff-pass-2026'})).response.headers.get('set-cookie').split(';')[0]}
 async function enableShop(overrides={}){process.env.BJORKEN_ENABLE_LIVE='true';const config={...settings,ordersOpen:true,whatsappVerified:true,ownerApproved:true,whatsapp:'0501234567',...overrides};await service.db.setConfig('business',JSON.stringify(config));return config}
 async function license(feature,status='active'){return call('/modules/licenses','PATCH',{feature,status,expiresAt:new Date(Date.now()+86400000).toISOString(),reference:'isolated-test-only',acknowledged:true})}
 async function close(){if(previousFlag===undefined)delete process.env.BJORKEN_ENABLE_LIVE;else process.env.BJORKEN_ENABLE_LIVE=previousFlag;await service.close();await replica.stop()}
 return {service,db:service.db,call,staff,enableShop,license,cookies,close};
}
