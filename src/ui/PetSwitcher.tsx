import { Chester } from '../chester/Chester';
import { store, useStore } from '../db/store';
import * as audio from '../lib/audio';
import { useLayout } from './layout';

/** Your cats as little faces; the one being shown is ringed. Hidden with only one cat.
 *  On desktop (1100 px and up) it lives in the side nav (`inNav`), so the copies at the top of Home, Health and Train hide. */
export function PetSwitcher({ style, inNav }: { style?: React.CSSProperties; inNav?: boolean }) {
  const { cat, pets } = useStore();
  const desktop = useLayout() === 'desktop';
  if (!cat || pets.length < 2 || (desktop && !inNav)) return null;
  return <div className={inNav ? 'petswitch innav' : 'petswitch'} role="group" aria-label="Your cats" style={style}>
    {pets.map((p) => { const on = p.id === cat.id; return <button key={p.id} className={on ? 'on' : ''} aria-pressed={on} onClick={() => { if (!on) { audio.chirp(); void store.switchPet(p.id); } }}>
      <span className="face"><Chester coat={p.coat} eyes={p.eyes} mood={on ? 'happy' : 'curious'} width={40} label={p.name} /></span>
      <span className="nm">{p.name}</span></button>; })}
  </div>;
}
