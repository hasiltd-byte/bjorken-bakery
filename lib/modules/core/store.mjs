import {randomUUID} from 'node:crypto';
import {moduleError} from './registry.mjs';
export function scopedStore(db,businessId,space){
 const filter=(kind,extra={})=>({...extra,businessId,space,kind});
 return {businessId,space,
  list(kind,extra={},limit=1000){return db.find('ModuleRecord',filter(kind,extra),{createdAt:-1},limit)},
  get(kind,key){return db.one('ModuleRecord',filter(kind,{key}))},
  async add(kind,data,key=randomUUID()){return db.create('ModuleRecord',{_id:randomUUID(),businessId,space,kind,key,data,revision:0,createdAt:Date.now(),updatedAt:Date.now()})},
  async set(kind,key,data,revision){const row=await db.update('ModuleRecord',filter(kind,{key,...(revision===undefined?{}:{revision})}),{$set:{data,updatedAt:Date.now()},$inc:{revision:1}});if(!row)throw moduleError('הפריט השתנה או אינו קיים. רעננו ונסו שוב.',409);return row},
  async audit(action,actor,target,details={}){return this.add('audit',{action,actor:actor?.username||'customer',role:actor?.role||'customer',target,details,at:Date.now()})},
 };
}
