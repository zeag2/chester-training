import { Icon } from './icons';
/** Home · Health · + · Train · Me. The + opens the quick-log sheet. `dot` marks a tab with something new (e.g. a new friend). */
export function TabBar({ active, onPlus, dot }: { active: string; onPlus: () => void; dot?: string }) {
  const t = (id: string, label: string, icon: string) => <a href={'#/' + id} className={`tab ${active === id ? 'on' : ''}`} aria-current={active === id ? 'page' : undefined}>
    <span style={{ position: 'relative', display: 'inline-flex' }}><Icon name={icon} size={24} />{dot === id && <i className="tabdot" aria-label="new" />}</span>{label}</a>;
  return <nav className="tabs" aria-label="Main"><div className="tabs-in">
    {t('home', 'Home', 'home')}{t('health', 'Health', 'heart')}
    <button className="tab" aria-label="Log something" onClick={onPlus}><span className="plus"><Icon name="plus" size={26} /></span></button>
    {t('train', 'Train', 'target')}
    {t('me', 'Me', 'user')}
  </div></nav>;
}
