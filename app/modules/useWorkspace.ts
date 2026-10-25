'use client';
import {useEffect,useRef,useState} from 'react';
export type Data=Record<string,any>;
export async function request(path:string,method='GET',data?:unknown){const res=await fetch('/order/api'+path,{method,cache:'no-store',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});const result=await res.json();if(typeof window!=='undefined'&&(res.status===428||result.mustChangePassword))location.assign('/admin/security');if(!res.ok)throw Object.assign(Error(result.error||'הפעולה לא הצליחה.'),{status:res.status,fields:result.fields||{}});return result}
export function useWorkspaceData(path:string,space:string,enabled=true){
 const resource=space+':'+path,active=useRef(resource),generation=useRef(0),[snapshot,setSnapshot]=useState<{resource:string;data:Data|null;error:string;updated:number}|null>(null);active.current=resource;
 const publish=(data:Data|null,error='')=>{if(active.current===resource)setSnapshot({resource,data,error,updated:Date.now()})};
 async function refresh(){const current=++generation.current;try{const result=await request('/modules'+path+(path.includes('?')?'&':'?')+'space='+space);if(current===generation.current)publish(result);return result}catch(e){if(current===generation.current)publish(null,(e as Error).message);return null}}
 useEffect(()=>{let stopped=false,controller:AbortController|undefined;publish(null);if(!enabled)return;
  async function load(){controller?.abort();controller=new AbortController();const current=++generation.current;try{const res=await fetch('/order/api/modules'+path+(path.includes('?')?'&':'?')+'space='+space,{cache:'no-store',signal:controller.signal}),result=await res.json();if(!res.ok)throw Error(result.error);if(!stopped&&current===generation.current)publish(result)}catch(e){if(!stopped&&current===generation.current&&(e as Error).name!=='AbortError')publish(null,(e as Error).message)}}
  load();const timer=setInterval(()=>{if(document.visibilityState==='visible')load()},5000);return()=>{stopped=true;controller?.abort();clearInterval(timer)}
 },[path,space,enabled]);const current=enabled&&snapshot?.resource===resource?snapshot:null;return {data:current?.data||null,error:current?.error||'',updated:current?.updated||0,refresh};
}
