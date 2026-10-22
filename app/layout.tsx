import './globals.css';
import type {Metadata} from 'next';
const siteUrl=process.env.NEXT_PUBLIC_SITE_URL||'https://bjorken-bakery.vercel.app';
const shareImage={url:'/images/bjorken-og-v1.jpg',width:1200,height:630,alt:'Björken | ביורקן — מאפיית בוטיק בנאות מרדכי',type:'image/jpeg'};
export const metadata:Metadata={
 metadataBase:new URL(siteUrl),
 title:'Björken — ביורקן | רגע טוב מהתנור',
 description:'מאפיית בוטיק בנאות מרדכי. בקשות למאפים לשישי ולאיסוף במאפייה.',
 robots:{index:false,follow:false},
 openGraph:{title:'Björken | ביורקן',description:'מאפים. קפה. רגע גלילי.',siteName:'Björken | ביורקן',url:siteUrl,locale:'he_IL',type:'website',images:[shareImage]},
 twitter:{card:'summary_large_image',title:'Björken | ביורקן',description:'מאפים. קפה. רגע גלילי.',images:[shareImage.url]},
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="he" dir="rtl"><body>{children}</body></html>}
