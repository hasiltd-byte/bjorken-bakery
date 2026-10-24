import {categories} from '../../shared/catalog.mjs';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
export async function readCategories(db){
 const saved=JSON.parse(await db.getConfig('categories','null'));
 const rows=saved?.rows||Object.entries(categories).map(([id,name],sortOrder)=>({id,name,sortOrder,hidden:false}));
 // Preserve categories on older/imported products instead of losing their products.
 const known=new Set(rows.map(r=>r.id));for(const product of await db.find('MenuItem',{deleted:{$ne:true}}))if(product.category&&!known.has(product.category)){known.add(product.category);rows.push({id:product.category,name:product.category,sortOrder:rows.length,hidden:false})}
 return {revision:saved?.revision||0,rows:rows.sort((a,b)=>a.sortOrder-b.sortOrder||a.id.localeCompare(b.id))};
}
export async function saveCategory(db,b){return db.transaction(async()=>{
 const current=await readCategories(db);if(b.revision!==current.revision)throw fail('הקטגוריות השתנו. רעננו ונסו שוב.',409);
 if(!/^[a-z0-9][a-z0-9-]{1,59}$/.test(b.id)||typeof b.name!=='string'||b.name.trim().length<2||b.name.length>80||typeof b.hidden!=='boolean'||!Number.isInteger(b.sortOrder)||b.sortOrder<0||b.sortOrder>9999)throw fail('בדקו שם, קוד, סדר ומצב הקטגוריה.');
 const rows=current.rows.filter(row=>row.id!==b.id);rows.push({id:b.id,name:b.name.trim(),hidden:b.hidden,sortOrder:b.sortOrder});const next={revision:current.revision+1,rows};await db.setConfig('categories',JSON.stringify(next));return next;
})}
export async function publicCatalog(db,products){const state=await readCategories(db),hidden=new Set(state.rows.filter(r=>r.hidden).map(r=>r.id));return {categories:state.rows.filter(r=>!r.hidden),products:products.filter(p=>!p.hidden&&!hidden.has(p.category))}}
