import type {BakeryDesign} from './BakeryHero';
export default function DesignSwitcher({design}:{design:BakeryDesign}){
 return <aside className="design-switcher" aria-label="בחירת חלופת עיצוב"><a className="design-back" href="/designs">כל העיצובים ↗</a><span>ביורקן · חלופות ללקוח</span><nav aria-label="חלופות העיצוב"><a href="/" aria-current={design==='classic'?'page':undefined}>מקורי</a><a href="/designs/sunlight" aria-current={design==='sunlight'?'page':undefined}>01 · שמש צפונית</a><a href="/designs/hearth" aria-current={design==='hearth'?'page':undefined}>02 · חומר וחום</a></nav></aside>;
}
