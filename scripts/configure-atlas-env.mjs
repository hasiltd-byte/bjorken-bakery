import nextEnv from '@next/env';
import {readFile,appendFile} from 'node:fs/promises';
import {databaseName} from '../lib/server/database-target.mjs';
nextEnv.loadEnvConfig(process.cwd());
const uri=process.env.MONGODB_URI||process.env.MONGO_URI;
const name=databaseName(uri,process.env.MONGO_DB_NAME),lines=[];
if(!process.env.MONGO_DB_NAME)lines.push('MONGO_DB_NAME='+name);
if(!process.env.BJORKEN_ADMIN_USERNAME||!process.env.BJORKEN_ADMIN_PASSWORD){const credentials=JSON.parse(await readFile('.local/credentials.json','utf8'));if(!process.env.BJORKEN_ADMIN_USERNAME)lines.push('BJORKEN_ADMIN_USERNAME='+credentials.username);if(!process.env.BJORKEN_ADMIN_PASSWORD)lines.push('BJORKEN_ADMIN_PASSWORD='+credentials.password)}
if(process.env.BJORKEN_ENABLE_LIVE===undefined)lines.push('BJORKEN_ENABLE_LIVE=false');
if(lines.length)await appendFile('.env','\n# Bjorken application settings\n'+lines.join('\n')+'\n');
console.log(JSON.stringify({database:name,adminConfigured:true,connectionStringPrinted:false}));
