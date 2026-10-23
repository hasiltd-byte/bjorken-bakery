import {ArrowLeft,Leaf,MapPin} from 'lucide-react';
import {displayImage} from '../shared/images.mjs';
export type BakeryDesign='classic'|'sunlight'|'hearth';
type Props={design:BakeryDesign;headline:string;description:string;image:string;imageTitle:string;address:string;onOrder:()=>void;onPhoto:()=>void};
export default function BakeryHero({design,headline,description,image,imageTitle,address,onOrder,onPhoto}:Props){
 const sunlight=design==='sunlight',hearth=design==='hearth';
 return <section className="hero">
  <div className="hero-copy">
   <p className="eyebrow"><span/>{sunlight?'A TASTE OF THE NORTH':hearth?'BJÖRKEN · BAKED WITH A LITTLE SOUL':'A LITTLE NORTH. A LITTLE NORDIC.'}</p>
   <h1>{sunlight?<><span>הדברים הטובים</span><br/><span>של הרגעים הקטנים.</span></>:hearth?<><span>נאפה לאט.</span><br/><span>נחלק בשמחה.</span></>:headline.split('. ').map((s,i)=><span key={i}>{s}{i===0?'.':''}<br/></span>)}</h1>
   <p className="hero-intro">{description}</p>
   <div className="hero-actions"><button className="primary" onClick={onOrder}>מזמינים לשישי <ArrowLeft size={19}/></button>{hearth?<a className="hero-story-link" href="#story">הסיפור שלנו ↙</a>:<span className="handnote">נאפה כאן, בגליל.</span>}</div>
   <div className="hero-meta"><MapPin size={16}/>{address}<span>·</span><span>איסוף מהמאפייה</span></div>
  </div>
  <div className="hero-visual">
   <button type="button" className="hero-photo-button" aria-label="הגדלת תמונת המאפים" onClick={onPhoto}><img src={displayImage(image,1600)} alt={imageTitle+' — מתוך צילומי המאפייה'} fetchPriority="high" width="1200" height="1600"/></button>
   <div className="round-stamp"><Leaf size={23}/><span>רגע קטן<br/>של טוב</span><small>BJÖRKEN BAKERY</small></div>
   <span className="image-caption">{hearth?'מהתנור. לשולחן. לאנשים שאוהבים.':'מהתנור שלנו, אל סוף השבוע שלכם.'}</span>
   {sunlight&&<><span className="hero-sun" aria-hidden="true">✳</span><span className="hero-side-note" aria-hidden="true">NEOT MORDECHAI · BJÖRKEN</span></>}
  </div>
  <span className="hero-number">{hearth?'GOOD FOOD. GOOD COMPANY.':'01 / THE GOOD THINGS'}</span>
 </section>;
}
