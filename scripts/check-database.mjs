import nextEnv from '@next/env';
import mongoose from 'mongoose';
import {databaseName} from '../lib/server/database-target.mjs';
nextEnv.loadEnvConfig(process.cwd());
let connection;
try{
 const uri=process.env.MONGODB_URI||process.env.MONGO_URI;if(!uri)throw Error('MongoDB is not configured.');
 const name=databaseName(uri,process.env.MONGO_DB_NAME);
 connection=mongoose.createConnection(uri,{dbName:name,serverSelectionTimeoutMS:12000});await connection.asPromise();
 await connection.db.command({ping:1});const hello=await connection.db.admin().command({hello:1});
 const collections=await connection.db.listCollections({}, {nameOnly:true}).toArray();
 console.log(JSON.stringify({connected:true,database:name,transactionsSupported:!!(hello.setName||hello.msg==='isdbgrid'),collections:collections.map(c=>c.name)}));
}catch(e){console.error('MongoDB connection check failed:',e.name, e.code||'');process.exitCode=1}finally{await connection?.close()}
