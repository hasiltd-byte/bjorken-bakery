export function cloudinaryImage(url,cloudName){
 if(typeof url!=='string'||!cloudName)return false;
 try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='res.cloudinary.com'&&!u.port&&!u.username&&!u.password&&u.pathname.startsWith('/'+cloudName+'/image/upload/')&&u.pathname.length>('/'+cloudName+'/image/upload/').length&&!u.search&&!u.hash}catch{return false}
}
export function productImage(url,cloudName){return typeof url==='string'&&url.length<=2048&&(/^(?:[a-z0-9_-]+\.(?:jpg|png|webp|svg)|\/images\/[a-z0-9_-]+\.(?:jpg|png|webp|svg)|\/order\/media\/[a-f0-9-]+\.jpg)$/.test(url)||cloudinaryImage(url,cloudName))}
export function displayImage(url,width=720){
 if(typeof url!=='string')return '';
 try{const u=new URL(url);if(u.protocol==='https:'&&u.hostname==='res.cloudinary.com'&&u.pathname.includes('/image/upload/'))return url.replace('/image/upload/','/image/upload/f_auto,q_auto,c_limit,w_'+width+'/')}catch{}
 return url;
}
