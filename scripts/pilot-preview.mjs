// Disk-backed LOCAL pilot only. Never connects to the Atlas URI from .env.
import nextEnv from '@next/env';
import {MongoMemoryServer} from 'mongodb-memory-server';
import mongoose from 'mongoose';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createService} from '../lib/server/service.mjs';
nextEnv.loadEnvConfig(process.cwd());
const dir=resolve('.local/hasi-pilot-mongo');await mkdir(dir,{recursive:true});
let credentials={username:process.env.BJORKEN_ADMIN_USERNAME,password:process.env.BJORKEN_ADMIN_PASSWORD};if(!credentials.username||!credentials.password)credentials=JSON.parse(await readFile('.local/credentials.json','utf8'));
const mongo=await MongoMemoryServer.create({binary:{downloadDir:resolve('.local/mongodb-binaries')},instance:{ip:'127.0.0.1',port:27029,dbPath:dir,replSet:'bjorken-pilot',storageEngine:'wiredTiger'}}),uri=mongo.getUri('bjorken_pilot');
const client=await mongoose.mongo.MongoClient.connect(uri,{directConnection:true,serverSelectionTimeoutMS:10000});let ready=false;
try{for(let i=0;i<100;i++){try{const hello=await client.db('admin').command({hello:1});if(hello.isWritablePrimary){ready=true;break}if(i>5){try{await client.db('admin').command({replSetInitiate:{_id:'bjorken-pilot',members:[{_id:0,host:'127.0.0.1:27029'}]}})}catch(e){if(![23].includes(e.code))throw e}}}catch(e){if(![94,10107,11602].includes(e.code))throw e}await new Promise(r=>setTimeout(r,200))}}finally{await client.close()}if(!ready)throw Error('Local pilot replica did not become ready.');
if(process.argv.includes('--seed-demo')){const service=await createService({mongoUri:uri,dbName:'bjorken_pilot',...credentials});try{const login=await service.handle(new Request('http://localhost/order/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(credentials)}));if(login.status!==200)throw Error('Pilot login failed');const cookie=login.headers.get('set-cookie').split(';')[0],seed=await service.handle(new Request('http://localhost/order/api/modules/demo',{method:'POST',headers:{cookie,'content-type':'application/json'},body:'{}'}));if(!seed.ok)throw Error('Demo seed failed');await service.handle(new Request('http://localhost/order/api/logout',{method:'POST',headers:{cookie},body:'{}'}))}finally{await service.close()}}
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3030'],{stdio:'inherit',env:{...process.env,MONGODB_URI:uri,MONGO_URI:uri,MONGO_DB_NAME:'bjorken_pilot',BJORKEN_ADMIN_USERNAME:credentials.username,BJORKEN_ADMIN_PASSWORD:credentials.password,BJORKEN_ENABLE_LIVE:'false'}});
console.log('LOCAL PILOT ONLY: http://localhost:3030/admin/modules | choose isolated demo. Atlas and production are untouched.');
let closing=false;async function stop(){if(closing)return;closing=true;server.kill();await mongo.stop({doCleanup:false});process.exit()}process.on('SIGINT',stop);process.on('SIGTERM',stop);server.on('exit',stop);
