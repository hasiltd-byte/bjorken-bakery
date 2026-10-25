// Replace this small business adapter when extracting the module into HASI.
export const pwaProfile={name:'Björken | ביורקן',shortName:'Björken',description:'מאפים, קפה והזמנות מהמאפייה',theme:'#354c3d',background:'#f8f6ef'};
export function siteOrigin(request){const url=new URL(request.url);if(['localhost','127.0.0.1'].includes(url.hostname))return url.origin;try{const configured=new URL(process.env.NEXT_PUBLIC_SITE_URL);if(configured.protocol==='https:')return configured.origin}catch{}return url.origin}
