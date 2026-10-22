import {MongoMemoryServer} from 'mongodb-memory-server';
import mongoose from 'mongoose';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
await mkdir('.local/mongo',{recursive:true});await mkdir('.local/mongodb-binaries',{recursive:true});
let credentials;try{credentials=JSON.parse(await readFile('.local/credentials.json','utf8'))}catch{credentials={username:'bjorken-owner',password:randomBytes(24).toString('base64url')};await writeFile('.local/credentials.json',JSON.stringify(credentials),{mode:0o600});await writeFile('.local/ADMIN_ACCESS.txt',`Local preview only\nhttp://localhost:3030/admin\nUsername: ${credentials.username}\nPassword: ${credentials.password}\n`,{mode:0o600})}
console.log('Starting isolated, disk-backed local MongoDB. No Cotta data or secrets are read.');
// Keep the replica member address stable across restarts of the disk-backed DB.
const replica=await MongoMemoryServer.create({binary:{downloadDir:resolve('.local/mongodb-binaries')},instance:{ip:'127.0.0.1',port:27028,dbPath:resolve('.local/mongo'),replSet:'bjorken-local',storageEngine:'wiredTiger'}});
const uri=replica.getUri('bjorken');
const client=await mongoose.mongo.MongoClient.connect(uri,{directConnection:true,serverSelectionTimeoutMS:10000});
try{let ready=false;for(let n=0;n<100;n++){
 try{
  if((await client.db('admin').command({hello:1})).isWritablePrimary){ready=true;break}
  let config;try{config=(await client.db('admin').command({replSetGetConfig:1})).config}catch(e){if(e.code!==94)throw e}
  if(!config&&n>10)await client.db('admin').command({replSetInitiate:{_id:'bjorken-local',members:[{_id:0,host:'127.0.0.1:27028'}]}});
  else if(config&&config.members[0].host!=='127.0.0.1:27028'){config.members[0].host='127.0.0.1:27028';config.version++;await client.db('admin').command({replSetReconfig:config,force:true})}
 }catch(e){if(!['MongoNetworkError','MongoServerSelectionError'].includes(e.name)&&![23,94,10107,11602].includes(e.code))throw e}
 await new Promise(r=>setTimeout(r,200));
 }if(!ready)throw Error('Local MongoDB primary did not become ready.');
}finally{await client.close()}
const server=spawn(process.execPath,['node_modules/next/dist/bin/next',process.argv.includes('--dev')?'dev':'start','--hostname','127.0.0.1','--port','3030'],{stdio:'inherit',env:{...process.env,MONGODB_URI:uri,MONGO_URI:uri,MONGO_DB_NAME:'bjorken',BJORKEN_ADMIN_USERNAME:credentials.username,BJORKEN_ADMIN_PASSWORD:credentials.password,BJORKEN_ENABLE_LIVE:'false'}});
console.log('Preview: http://localhost:3030 | Admin: http://localhost:3030/admin | Login: .local/ADMIN_ACCESS.txt');
let stopping=false;async function stop(){if(stopping)return;stopping=true;server.kill();await replica.stop({doCleanup:false});process.exit()}
process.on('SIGINT',stop);process.on('SIGTERM',stop);server.on('exit',stop);
