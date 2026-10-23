import './globals.css';
import PwaRegistration from './PwaRegistration';
import type {Metadata} from 'next';
const siteUrl=process.env.NEXT_PUBLIC_SITE_URL||'https://bjorken-bakery.vercel.app';
const shareImage={url:'/images/bjorken-og-v2.jpg',width:1200,height:1200,alt:'Björken | ביורקן — מאפיית בוטיק בנאות מרדכי',type:'image/jpeg'};
export const metadata:Metadata={
 metadataBase:new URL(siteUrl),
 appleWebApp:{capable:true,title:'Björken',statusBarStyle:'default'},
 title:'Björken — ביורקן | רגע טוב מהתנור',
 description:'מאפיית בוטיק בנאות מרדכי. בקשות למאפים לשישי ולאיסוף במאפייה.',
 robots:{index:false,follow:false},
 openGraph:{title:'Björken | ביורקן',description:'מאפים. קפה. רגע גלילי.',siteName:'Björken | ביורקן',url:siteUrl,locale:'he_IL',type:'website',images:[shareImage]},
 twitter:{card:'summary_large_image',title:'Björken | ביורקן',description:'מאפים. קפה. רגע גלילי.',images:['/images/bjorken-og-v1.jpg']},
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="he" dir="rtl"><body><PwaRegistration/>{children}</body></html>}
