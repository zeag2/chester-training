import { useState } from 'react';
import { Chester } from '../chester/Chester';
import type { ReactionId } from '../chester/reactions';

/** Dev-only: every pose side by side, for checking motion. Open #/gallery in `npm run dev`. */
export function Gallery() {
  const [r, setR] = useState<{ id: ReactionId; n: number } | null>(null);
  const poses = [['sit', ''], ['sit', 'wave'], ['knead', ''], ['loaf', ''], ['doze', 'nap'], ['sleep', 'nap'], ['drape', ''], ['walk', ''], ['ball', 'play'], ['fly', '']] as const;
  return <div className="screen"><h1>Poses</h1>
    <div className="row" style={{ gap: 8, marginTop: 10 }}>{([['r1', 'Hop'], ['r14', 'Pounce']] as const).map(([id, l]) => <button key={id} className="btn2" onClick={() => setR({ id, n: (r?.n ?? 0) + 1 })}>{l}</button>)}</div>
    <div className="card mint" id="mover" style={{ display: 'flex', justifyContent: 'space-around' }}>
      <Chester width={130} react={r?.id ?? null} reactKey={r?.n} />
      <Chester width={130} anim="dance" mood="happy" coat="orange" /></div>
    <div className="card mint" id="nuzzle" style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="gagwrap nuzzling"><Chester width={104} anim="nuzzle" mood="happy" /></div>
      <div className="homecats nuzzling"><div className="other"><Chester width={84} anim="nuzzleL" mood="happy" coat="orange" /></div></div></div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
      {poses.map(([pose, anim], i) => <div key={i} className="card mint" style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Chester pose={pose} anim={anim} raised={anim === 'wave'} coat={i % 2 ? 'orange' : 'black'} width={130} interactive />
        <span className="s">{pose} {anim}</span></div>)}
    </div></div>;
}
