import {cloudinaryImage} from '../../shared/images.mjs';
const failure=(message,status=502)=>Object.assign(Error(message),{status});
export async function uploadImage(bytes,{cloudName=process.env.CLOUDINARY_CLOUD_NAME,preset=process.env.CLOUDINARY_UPLOAD_PRESET,fetcher=fetch}={}){
 if(!cloudName||!preset||!/^[a-z0-9_-]+$/i.test(cloudName))throw failure('יש להגדיר CLOUDINARY_CLOUD_NAME ו־CLOUDINARY_UPLOAD_PRESET בשרת.',503);
 const form=new FormData();form.set('file',new Blob([bytes],{type:'image/jpeg'}),'bjorken-image.jpg');form.set('upload_preset',preset);
 let response,data;
 try{response=await fetcher('https://api.cloudinary.com/v1_1/'+encodeURIComponent(cloudName)+'/image/upload',{method:'POST',body:form,signal:AbortSignal.timeout(30000)});data=await response.json()}catch{throw failure('לא ניתן להתחבר לשירות התמונות כרגע. נסו שוב.');}
 if(!response.ok){if(/unsigned|preset/i.test(data?.error?.message||''))throw failure('בדקו שה־Upload Preset קיים ומוגדר Unsigned ב־Cloudinary. עם שתי הגדרות הסביבה האלו נדרש preset ללא חתימה.',503);throw failure('העלאת התמונה ל־Cloudinary נכשלה. נסו שוב או בדקו את הגדרות השירות.');}
 if(!cloudinaryImage(data.secure_url,cloudName)||data.resource_type!=='image'||typeof data.public_id!=='string')throw failure('שירות התמונות החזיר תשובה לא תקינה. התמונה לא נשמרה.');
 return {url:data.secure_url,publicId:data.public_id};
}
