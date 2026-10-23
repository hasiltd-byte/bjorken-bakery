import type {Metadata} from 'next';
import {ArrowUpLeft,Sun,Wheat} from 'lucide-react';
import './presentation.css';
export const metadata:Metadata={title:'שתי דרכים לרגע טוב — חלופות עיצוב | Björken',robots:{index:false,follow:false}};
export default function Page(){return <main className="design-presentation" dir="rtl">
 <header><a className="presentation-brand" href="/">Björken<span>ביורקן · מאפיית בוטיק</span></a><a href="/">לעיצוב המקורי <ArrowUpLeft size={17}/></a></header>
 <section className="presentation-intro"><p>DESIGN COLLECTION · BJÖRKEN</p><h1>אותה מאפייה.<br/><span>שתי דרכים לרגע טוב.</span></h1><div>שני כיוונים עיצוביים לבחירה, בהשראת הרפרנסים שצורפו.<br/>בכל חלופה אפשר לעיין במוצרים, להגדיל תמונות ולנסות את תהליך ההזמנה.</div></section>
 <div className="presentation-options">
  <article className="presentation-card sunlight-card"><a className="presentation-preview" href="/designs/sunlight" aria-label="פתיחת חלופה 01 שמש צפונית"><img src="/design-previews/sunlight.webp" alt="תצוגת עיצוב שמש צפונית — גווני חמאה, ירוק ופתיח מעוגל" width="1200" height="900"/><span>01 / SUNLIGHT</span></a><div className="presentation-card-info"><div className="presentation-card-title"><Sun size={25}/><h2>שמש צפונית</h2></div><p>חמאה, ירוק זית וקווים מעוגלים. פתיח מרכזי, כותרות אלגנטיות ואווירה רגועה של קפה ומאפה.</p><div className="presentation-palette" aria-label="פלטת חמאה, ירוק זית ושמנת"><i/><i/><i/></div><a href="/designs/sunlight">פותחים את העיצוב <ArrowUpLeft size={20}/></a></div></article>
  <article className="presentation-card hearth-card"><a className="presentation-preview" href="/designs/hearth" aria-label="פתיחת חלופה 02 חומר וחום"><img src="/design-previews/hearth.webp" alt="תצוגת עיצוב חומר וחום — שמנת, טרקוטה, צילום גדול וטיפוגרפיה בולטת" width="1200" height="900"/><span>02 / HEARTH</span></a><div className="presentation-card-info"><div className="presentation-card-title"><Wheat size={25}/><h2>חומר וחום</h2></div><p>שמנת, חום עמוק וטרקוטה. כותרות עם נוכחות, צילום גדול וקטלוג שמעמיד את המאפים במרכז.</p><div className="presentation-palette" aria-label="פלטת שמנת, טרקוטה וחום"><i/><i/><i/></div><a href="/designs/hearth">פותחים את העיצוב <ArrowUpLeft size={20}/></a></div></article>
 </div><footer><span>נאפה כאן, בגליל.</span><a href="/">חזרה לאתר המקורי ↗</a></footer>
 </main>}
