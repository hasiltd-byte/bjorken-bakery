// Explicit, one-time import of this project's local catalog/settings into an empty Atlas DB.
import nextEnv from '@next/env';
import mongoose from 'mongoose';
import {databaseName} from '../lib/server/database-target.mjs';
nextEnv.loadEnvConfig(process.cwd());
let source,target;
try{
 const uri=process.env.MONGODB_URI||process.env.MONGO_URI,name=databaseName(uri,process.env.MONGO_DB_NAME);
 target=await mongoose.mongo.MongoClient.connect(uri,{serverSelectionTimeoutMS:12000});const remote=target.db(name);
 if((await remote.listCollections({}, {nameOnly:true}).toArray()).length)throw Error('TARGET_NOT_EMPTY');
 source=await mongoose.mongo.MongoClient.connect('mongodb://127.0.0.1:27028/bjorken?replicaSet=bjorken-local',{serverSelectionTimeoutMS:5000});
 const local=source.db('bjorken'),names=['menuitems','configs','dishVideos.files','dishVideos.chunks'],rows=[];
 for(const collection of names){const data=await local.collection(collection).find({}).toArray();if(data.length)rows.push({collection,data})}
 if(!rows.some(r=>r.collection==='menuitems'))throw Error('LOCAL_CATALOG_MISSING');
 const session=target.startSession();try{await session.withTransaction(async()=>{for(const {collection,data}of rows)await remote.collection(collection).insertMany(data,{session})})}finally{await session.endSession()}
 console.log(JSON.stringify({imported:true,database:name,collections:rows.map(r=>({name:r.collection,documents:r.data.length})),ordersCopied:false,sessionsCopied:false}));
}catch(e){console.error('Import failed:',e.name, ['TARGET_NOT_EMPTY','LOCAL_CATALOG_MISSING'].includes(e.message)?e.message:e.code||'');process.exitCode=1}finally{await source?.close();await target?.close()}
