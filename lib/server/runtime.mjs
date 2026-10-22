import {createService} from './service.mjs';
let service;
export async function dispatch(req){try{service ||= createService().catch(e=>{service=null;throw e});const r=await (await service).handle(req);if(!new URL(req.url).pathname.includes('/media/'))r.headers.set('Cache-Control','no-store');return r}catch{return Response.json({error:'מסד הנתונים אינו מחובר. יש להגדיר מסד ביורקן נפרד.'},{status:503})}}
