import { useLayoutEffect } from 'react';
import { ChesterIcon, Icon } from './icons';
import { useLayout } from './layout';
import { PetSwitcher } from './PetSwitcher';
import { iconPress, playIconMotion } from './iconMotion';

/**
 * The main navigation (docs/plans/2026-11-14-navigation.md, Option A). Phone (under 760 px): Home · Health · + ·
 * <the cat's name, or "Cats" with several> · Friends along the bottom; Settings is the gear on Home.
 * Tablet (760–1099 px): the same, as an 88 px rail on the left with the + at the top.
 * Desktop (1100 px and up): a 220 px side nav with a "Log" button at the top and the pet switcher under the tabs.
 * Tab icons are the Chester-style set (ChesterIcon): full colour on the current tab, quiet on the others.
 * The + / Log opens the quick-log sheet. `dot` marks a tab with something new (e.g. a new friend).
 * While a rail or side nav is showing, <html data-nav="rail|side"> lets the CSS move the page over.
 */
export function TabBar({ active, onPlus, dot, catLabel = 'Cats' }: { active: string; onPlus: () => void; dot?: string; catLabel?: string }) {
  const layout = useLayout();
  useLayoutEffect(() => {
    if (layout === 'phone') return;
    const el = document.documentElement; el.dataset.nav = layout === 'desktop' ? 'side' : 'rail';
    return () => { delete el.dataset.nav; };
  }, [layout]);
  // icon motion (design doc, Motion › Icon motion): picking a tab bounces its icon (the cat's tab nods); never on load
  const pickTab = (id: string) => (e: React.MouseEvent<HTMLElement>) => { if (active !== id) playIconMotion(e.currentTarget.querySelector('svg'), id === 'chester' ? 'nod' : 'bounce'); };
  const t = (id: string, label: string, icon: string) => <a href={'#/' + id} className={`tab ${active === id ? 'on' : ''}`} aria-current={active === id ? 'page' : undefined} onClick={pickTab(id)}>
    <span style={{ position: 'relative', display: 'inline-flex' }}><ChesterIcon name={icon} />{dot === id && <i className="tabdot" aria-label="new" />}</span>{label}</a>;
  if (layout === 'tablet') return <nav className="tabs rail" aria-label="Main"><div className="tabs-in">
    <button className="tab" aria-label="Log something" onClick={(e) => { iconPress('pop')(e); onPlus(); }}><span className="plus cplus"><ChesterIcon name="plus" /></span></button>
    {t('home', 'Home', 'home')}{t('health', 'Health', 'heart')}{t('chester', catLabel, 'paw')}{t('friends', 'Friends', 'user')}
  </div></nav>;
  if (layout === 'desktop') return <nav className="sidenav" aria-label="Main">
    <a className="brand" href="#/home" onClick={iconPress('nod')}><ChesterIcon name="paw" />PalDex</a>
    <button className="btn navlog" onClick={(e) => { iconPress('pop')(e); onPlus(); }}><Icon name="plus" size={20} />Log</button>
    <div className="navtabs">{t('home', 'Home', 'home')}{t('health', 'Health', 'heart')}{t('chester', catLabel, 'paw')}{t('friends', 'Friends', 'user')}</div>
    <PetSwitcher inNav />
    <a href="#/settings" className={`tab navsettings imo-hover-turn ${active === 'settings' ? 'on' : ''}`} aria-current={active === 'settings' ? 'page' : undefined} onClick={iconPress('turn')}><ChesterIcon name="settings" />Settings</a>
  </nav>;
  return <nav className="tabs" aria-label="Main"><div className="tabs-in">
    {t('home', 'Home', 'home')}{t('health', 'Health', 'heart')}
    <button className="tab" aria-label="Log something" onClick={(e) => { iconPress('pop')(e); onPlus(); }}><span className="plus cplus"><ChesterIcon name="plus" /></span></button>
    {t('chester', catLabel, 'paw')}
    {t('friends', 'Friends', 'user')}
  </div></nav>;
}
