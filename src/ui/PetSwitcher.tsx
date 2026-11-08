import { Chester } from '../chester/Chester';
import { store, useStore } from '../db/store';
import * as audio from '../lib/audio';

/** Your cats as little faces; the one being shown is ringed. Hidden with only one cat. */
export function PetSwitcher({ style }: { style?: React.CSSProperties }) {
  const { cat, pets } = useStore();
  if (!cat || pets.length < 2) return null;
  return <div className="petswitch" role="group" aria-label="Your cats" style={style}>
    {pets.map((p) => { const on = p.id === cat.id; return <button key={p.id} className={on ? 'on' : ''} aria-pressed={on} onClick={() => { if (!on) { audio.chirp(); void store.switchPet(p.id); } }}>
      <span className="face"><Chester coat={p.coat} eyes={p.eyes} mood={on ? 'happy' : 'curious'} width={40} label={p.name} /></span>
      <span className="nm">{p.name}</span></button>; })}
  </div>;
}
