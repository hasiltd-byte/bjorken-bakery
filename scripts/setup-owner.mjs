// No public registration endpoint. Default mode is READ ONLY.
import nextEnv from '@next/env';
import mongoose from 'mongoose';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {setupTarget} from '../lib/server/setup-target.mjs';
import {connectDatabase} from '../lib/server/database.mjs';
import {provisionOwner,resetOwner} from '../lib/server/owner-setup.mjs';
import {activateBjorken} from '../lib/server/bjorken-activation.mjs';

nextEnv.loadEnvConfig(process.cwd());
const args=process.argv.slice(2),value=name=>args[args.indexOf(name)+1],has=name=>args.includes(name);
const known=['--apply','--local-test','--phase','--approval-file','--help'];
for(let i=0;i<args.length;i++){if(!known.includes(args[i]))throw Error('Unknown setup option. Use --help.');if(['--phase','--approval-file'].includes(args[i])){if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing setup option value.');i++}}
if(has('--help')){console.log('Read-only: npm run owner:inspect\nWrite after approval: npm run owner:setup -- --apply --phase owner|reset-owner|activate --approval-file .local/production-approval.json\nIsolated testing only: --local-test (loopback MongoDB / bjorken_test).\nPasswords are generated once and printed only after a successful transaction.');process.exit(0)}
const phase=has('--phase')?value('--phase'):'owner',apply=has('--apply');
if(!['owner','reset-owner','activate'].includes(phase))throw Error('Unknown setup phase.');
const approval=has('--approval-file')?JSON.parse(await readFile(value('--approval-file'),'utf8')):null;
const uri=process.env.MONGODB_URI||process.env.MONGO_URI;
if(!uri)throw Error('MONGO_URI or MONGODB_URI is required.');
const target=setupTarget(uri,process.env.MONGO_DB_NAME,approval,{apply,localTest:has('--local-test')});
if(apply&&!has('--local-test')){
 const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const dirty=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();
 if(commit!==approval.reviewedCommit||dirty)throw Error('Run setup only from the clean reviewed commit approved for deployment.');
 if(phase==='activate'&&(process.env.BJORKEN_ENABLE_LIVE!=='true'||process.env.NEXT_PUBLIC_SITE_URL!==approval.siteUrl))throw Error('Verify the live flag and canonical site URL in the approved environment before activation.');
}
if(!apply){
 const client=new mongoose.mongo.MongoClient(uri,{serverSelectionTimeoutMS:10000,maxPoolSize:1});
 try{
  await client.connect();const db=client.db(target.database),config=key=>db.collection('configs').findOne({key},{projection:{value:1}});
  const owner=JSON.parse((await config('hasi:bjorken:ownerAuth'))?.value||'null'),business=JSON.parse((await config('business'))?.value||'{}'),activation=JSON.parse((await config('hasi:bjorken:activationV1'))?.value||'null');
  const pricedProducts=await db.collection('menuitems').countDocuments({deleted:{$ne:true},hidden:{$ne:true},available:true,price:{$type:'number',$gt:0}});
  console.log(JSON.stringify({readOnly:true,target,vercelTargetVerified:false,owner:owner?{username:owner.username||null,mustChangePassword:!!owner.mustChangePassword}:null,pricedProducts,ordersOpen:!!business.ordersOpen,activation:activation?{startsAt:activation.startsAt,expiresAt:activation.expiresAt}:null},null,2));
 }finally{await client.close()}
}else{
 const db=await connectDatabase({mongoUri:uri,dbName:target.database});
 try{
  const result=phase==='activate'?await activateBjorken(db,{whatsapp:approval?.whatsapp,imagesApproved:approval?.imagesApproved,reference:approval?.reference}):phase==='reset-owner'?await resetOwner(db,'bjorken'):await provisionOwner(db,'bjorken');
  // Do not redirect this one-time credential to tracked files or deployment logs.
  console.log(JSON.stringify({target,phase,...result},null,2));
 }finally{await db.close()}
}
