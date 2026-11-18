import { Chester } from '../chester/Chester';
import { useStore } from '../db/store';
import { giftClaimed } from '../engine/corner';
import { today } from '../lib/stats';
import { Paw } from '../ui/icons';
import { PetSwitcher } from '../ui/PetSwitcher';
import { Train } from './Train';

/** #/chester: the cat's own tab (navigation Option A). The big pettable cat, his corner, and training as a section
    (or the switch to turn it on). The tab is labelled with his name, or "Cats" when there are several. */
export function CatPage() {
  const { cat, wallet } = useStore();
  if (!cat) return null;
  const t = today();
  return <div className="screen">
    <h1 style={{ marginTop: 18 }}>{cat.name}</h1>
    <PetSwitcher />
    <div className="card mint" style={{ display: 'flex', justifyContent: 'center', padding: '22px 12px 12px' }}>
      <Chester coat={cat.coat} eyes={cat.eyes} wear={cat.corner?.wearing} mood="happy" raised anim="wave" width={170} interactive label={cat.name} />
    </div>
    <a href="#/corner" className="card butter row" style={{ color: 'inherit', textDecoration: 'none' }}><Paw color="#d4a23a" size={24} />
      <div className="sp"><b style={{ color: 'var(--butter-ink)' }}>{cat.name}’s corner</b>
        <p className="s" style={{ color: 'var(--butter-ink)' }}>{wallet ? `${Math.max(0, wallet.treats)} treats to spend on outfits, toys and cushions` : 'Outfits, toys and cushions'}</p></div>
      {!giftClaimed(cat.corner, t) && <span className="chip" style={{ background: 'var(--surface)' }}>Gift</span>}</a>
    <Train embedded />
  </div>;
}
