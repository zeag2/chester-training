import { Icon } from './icons';
export function TabBar({ active, onPlus }: { active: string; onPlus: () => void }) {
  const t = (id: string, label: string, icon: string) => <a href={'#/' + id} className={`tab ${active === id ? 'on' : ''}`} aria-current={active === id ? 'page' : undefined}><Icon name={icon} size={24} />{label}</a>;
  return <nav className="tabs" aria-label="Main"><div className="tabs-in">
    {t('home', 'Home', 'home')}{t('tree', 'Tree', 'tree')}
    <button className="tab" aria-label="Start a session" onClick={onPlus}><span className="plus"><Icon name="plus" size={26} /></span></button>
    {t('library', 'Library', 'book')}
    {t('settings', 'Settings', 'gear')}
  </div></nav>;
}
