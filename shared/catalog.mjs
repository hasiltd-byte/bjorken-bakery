import {productPhotoMap,preparedPhotoPath} from './product-photo-map.mjs';
import {weeklyPickup} from './schedule.mjs';
import {publicContact} from './contact.mjs';
export const categories={sweet:'מאפים מתוקים',savory:'מאפים מלוחים',bread:'לחמים ולחמניות',cakes:'עוגות',cookies:'עוגיות',friday:'מיוחדים לשישי'};
export const settings={requestHoldMinutes:30,deliveryEnabled:false,deliveryFee:null,deliveryNote:'משלוח בתיאום ובאישור המאפייה בלבד.',...publicContact,weeklyPickup,blockedDates:[],name:'Björken | ביורקן',headline:'קצת שקט. משהו טוב מהתנור.',description:'מאפיית בוטיק בנאות מרדכי. מאפים, קפה ורגע קטן לעצמכם בלב הגליל.',address:'קיבוץ נאות מרדכי',weekdayHours:'07:30–16:00',fridayHours:'08:00–13:00',saturdayHours:'יש לברר מול המאפייה',pickupDate:'2026-10-23',pickupSlots:['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30'],closeAt:'',capacity:100,whatsappVerified:false,ownerApproved:false,imagesApproved:false,catalogApproved:false,ordersOpen:false,banner:'בקשות לשישי · 23.10.2026 · איסוף במאפייה',instagram:'https://www.instagram.com/_bjorken_/',heroImage:'/images/cheese_pastries.webp',revision:0};
export const seedProducts=[
 ['cinnamon','סינבון','CINNAMON MOMENTS','sweet','cinnamon_roll.webp'],
 ['sticky','סטיקי באן','SLOW FRIDAY','sweet','glazed_rolls.webp'],
 ['pesto','מאפה פסטו וגבינות','SAVOURY & GOLDEN','savory','savory_pastry.webp'],
 ['bagel','בייגלה','A LITTLE EVERYDAY','bread',null],
 ['cardamom','מאפי הל','A NORDIC MOMENT','sweet',null],
 ['carrot','לחמניות גזר','ON YOUR TABLE','bread','seeded_rolls.webp'],
 ['yeast','עוגת דבש','SOMETHING GOLDEN','cakes','braided_pastry.webp'],
 ['cake','עוגות בחושות','SOMETHING SWEET','cakes','cake_pan.webp'],
 ['cookie','עוגיות','ONE MORE BITE','cookies','cookie.webp'],
 ['friday','מאפי שישי','WEEKEND RITUAL','friday','sweet_rolls.webp']
].map(([id,name,en,category,image],i)=>({id,name,en,category,image:preparedPhotoPath(id),gallery:productPhotoMap[id]?.photos.slice(1).map((_,i)=>preparedPhotoPath(id,i+1))||[],description:'פרטי המאפה והזמינות יאושרו על ידי המאפייה.',price:null,salePrice:null,tags:[],illustrative:true,available:true,hidden:false,deleted:false,stock:null,maxPerOrder:20,sku:'',sortOrder:i,revision:0}));
