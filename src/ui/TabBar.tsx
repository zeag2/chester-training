import { useLayoutEffect } from 'react';
import { Icon } from './icons';
import { useLayout } from './layout';
import { PetSwitcher } from './PetSwitcher';

/**
 * The main navigation. Phone (under 760 px): Home · Health · + · Train · Me along the bottom (unchanged).
 * Tablet (760–1099 px): the same, as an 88 px rail on the left with the + at the top.
 * Desktop (1100 px and up): a 220 px side nav with a "Log" button at the top and the pet switcher under the tabs.
 * The + / Log opens the quick-log sheet. `dot` marks a tab with something new (e.g. a new friend).
 * While a rail or side nav is showing, <html data-nav="rail|side"> lets the CSS move the page over.
 */
export function TabBar({ active, onPlus, dot }: { active: string; onPlus: () => void; dot?: string }) {
  const layout = useLayout();
  useLayoutEffect(() => {
    if (layout === 'phone') return;
    const el = document.documentElement; el.dataset.nav = layout === 'desktop' ? 'side' : 'rail';
    return () => { delete el.dataset.nav; };
  }, [layout]);
  const t = (id: string, label: string, icon: string) => <a href={'#/' + id} className={`tab ${active === id ? 'on' : ''}`} aria-current={active === id ? 'page' : undefined}>
    <span style={{ position: 'relative', display: 'inline-flex' }}><Icon name={icon} size={24} />{dot === id && <i className="tabdot" aria-label="new" />}</span>{label}</a>;
  if (layout === 'tablet') return <nav className="tabs rail" aria-label="Main"><div className="tabs-in">
    <button className="tab" aria-label="Log something" onClick={onPlus}><span className="plus"><Icon name="plus" size={26} /></span></button>
    {t('home', 'Home', 'home')}{t('health', 'Health', 'heart')}{t('train', 'Train', 'target')}{t('me', 'Me', 'user')}
  </div></nav>;
  if (layout === 'desktop') return <nav className="sidenav" aria-label="Main">
    <a className="brand" href="#/home"><Icon name="paw" size={22} />PalDex</a>
    <button className="btn navlog" onClick={onPlus}><Icon name="plus" size={20} />Log</button>
    <div className="navtabs">{t('home', 'Home', 'home')}{t('health', 'Health', 'heart')}{t('train', 'Train', 'target')}{t('me', 'Me', 'user')}</div>
    <PetSwitcher inNav />
  </nav>;
  return <nav className="tabs" aria-label="Main"><div className="tabs-in">
    {t('home', 'Home', 'home')}{t('health', 'Health', 'heart')}
    <button className="tab" aria-label="Log something" onClick={onPlus}><span className="plus"><Icon name="plus" size={26} /></span></button>
    {t('train', 'Train', 'target')}
    {t('me', 'Me', 'user')}
  </div></nav>;
}
