import {databaseName} from './database-target.mjs';

// Validate before opening the application's connection (which creates indexes/locks).
export function setupTarget(uri,dbOverride,approval,{apply=false,localTest=false,now=Date.now()}={}){
 const parsed=new URL(uri),database=databaseName(uri,dbOverride),host=parsed.hostname.toLowerCase();
 const target={host,database};
 if(!apply)return target;
 if(localTest){if(!['127.0.0.1','localhost','[::1]'].includes(host)||database!=='bjorken_test')throw Error('Local setup writes require loopback MongoDB and bjorken_test.');return target}
 if(!approval||approval.businessId!=='bjorken'||approval.productionDeploymentApproved!==true||approval.vercelTargetVerified!==true||approval.mongoHost!==host||approval.mongoDatabase!==database||approval.siteUrl!=='https://bjorken-bakery.vercel.app'||!/^prj_[a-zA-Z0-9]+$/.test(approval.projectId||'')||!/^dpl_[a-zA-Z0-9]+$/.test(approval.deploymentId||'')||!/^[a-f0-9]{40}$/.test(approval.reviewedCommit||'')||!Number.isFinite(Date.parse(approval.approvedAt))||Date.parse(approval.approvedAt)>now||now-Date.parse(approval.approvedAt)>86400000)throw Error('Writes blocked: provide a fresh explicit production approval matching the verified Vercel project, deployment, reviewed commit and Mongo target.');
 return target;
}
