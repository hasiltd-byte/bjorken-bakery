import mongoose from 'mongoose';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createModels} from './models.mjs';
import {databaseName} from './database-target.mjs';
// Next.js loads .env.local / deployment environment variables for Route Handlers.
export async function connectDatabase(options={}){
 const uri=options.mongoUri||process.env.MONGODB_URI||process.env.MONGO_URI;
 if(!uri)throw Error('MONGODB_URI is required. Set it in .env.local or the deployment environment. MONGO_URI is also supported.');
 const dbName=databaseName(uri,options.dbName||process.env.MONGO_DB_NAME);
 const connection=mongoose.createConnection(uri,{serverSelectionTimeoutMS:10000,dbName,maxPoolSize:10});
 try{
  await connection.asPromise();const hello=await connection.db.admin().command({hello:1});
  if(!hello.setName&&hello.msg!=='isdbgrid')throw Error('MongoDB must be a replica set (such as Atlas) to preserve atomic bookings and orders.');
  const models=createModels(connection);await Promise.all(Object.values(models).map(m=>m.init()));
  await models.MutationLock.updateOne({_id:'state'},{$setOnInsert:{version:0}},{upsert:true});
  const context=new AsyncLocalStorage(),bucket=new mongoose.mongo.GridFSBucket(connection.db,{bucketName:'dishVideos'});
  const opts=()=>context.getStore()?{session:context.getStore()}:{};
  const db={connection,models,
   find(name,filter={},sort,limit){let q=models[name].find(filter,null,opts()).lean();if(sort)q=q.sort(sort);if(limit)q=q.limit(limit);return q.exec()},
   one(name,filter={}){return models[name].findOne(filter,null,opts()).lean().exec()},
   count(name,filter={}){return models[name].countDocuments(filter,opts()).exec()},
   async create(name,row){const _id=row._id??row.id??row.key??row.number??row.token;const [d]=await models[name].create([{...row,...(_id!==undefined?{_id}:{})}],opts());return d.toObject()},
   update(name,filter,update,extra={}){return models[name].findOneAndUpdate(filter,update,{...opts(),returnDocument:'after',runValidators:true,...extra}).lean().exec()},
   remove(name,filter){return models[name].deleteOne(filter,opts()).exec()},
   async getConfig(key,fallback){return (await db.one('Config',{key}))?.value||fallback},
   async setConfig(key,value){return db.update('Config',{_id:key},{$set:{key,value:String(value)}},{upsert:true})},
   async nextNumber(name){return (await db.update('Counter',{_id:name},{$inc:{value:1}},{upsert:true})).value},
   async transaction(fn){if(context.getStore())return fn();return connection.transaction(async session=>{
    // All invariant-changing writes acquire the same transactional document.
    // This prevents MongoDB snapshot write skew for overlapping reservations.
    await models.MutationLock.updateOne({_id:'state'},{$inc:{version:1}},{session});
    return context.run(session,fn);
   },{readConcern:{level:'snapshot'},writeConcern:{w:'majority'},maxCommitTimeMS:10000})},
   async initialize(menu){await db.transaction(async()=>{for(const item of menu)await db.update('MenuItem',{_id:item.id},{$setOnInsert:item},{upsert:true})})},
   // Read-only compatibility for images uploaded before the Cloudinary migration.
   async video(name){return bucket.find({filename:name}).next()},
   videoStream(id,start=0,end){return bucket.openDownloadStream(id,{start,...(end===undefined?{}:{end})})},
   close(){return connection.close()},
  };
  return db;
 }catch(error){await connection.close().catch(()=>{});throw error}
}
