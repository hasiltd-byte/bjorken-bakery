// Read-only application/Atlas persistence check. Uploads are tested separately.
import nextEnv from '@next/env';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {databaseName} from '../lib/server/database-target.mjs';
nextEnv.loadEnvConfig(process.cwd());
const root='http://localhost:3030/order/api',uri=process.env.MONGODB_URI||process.env.MONGO_URI;
const name=databaseName(uri,process.env.MONGO_DB_NAME);let client,cookie='';
try{
 const login=await fetch(root+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:process.env.BJORKEN_ADMIN_USERNAME,password:process.env.BJORKEN_ADMIN_PASSWORD})});assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
 const response=await fetch(root+'/menu'),data=await response.json();assert.equal(response.status,200);assert.equal(data.connected,true);
 client=await mongoose.mongo.MongoClient.connect(uri,{serverSelectionTimeoutMS:12000});const db=client.db(name);
 for(const p of data.products){const saved=await db.collection('menuitems').findOne({id:p.id});assert.equal(saved.image,p.image);assert.equal(saved.price,p.price)}
 console.log(JSON.stringify({database:name,adminLogin:true,products:data.products.length,atlasPersistence:true,preview:!data.live}));
}catch(e){console.error('Atlas application check failed:',e.name);process.exitCode=1}finally{if(cookie)await fetch(root+'/logout',{method:'POST',headers:{cookie}});await client?.close()}
