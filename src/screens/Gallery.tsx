import { Chester } from '../chester/Chester';

/** Dev-only: every pose side by side, for checking motion. Open #/gallery in `npm run dev`. */
export function Gallery() {
  const poses = [['sit', ''], ['sit', 'wave'], ['knead', ''], ['loaf', ''], ['sleep', 'nap'], ['walk', ''], ['ball', 'play']] as const;
  return <div className="screen"><h1>Poses</h1>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
      {poses.map(([pose, anim], i) => <div key={i} className="card mint" style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Chester pose={pose} anim={anim} raised={anim === 'wave'} coat={i % 2 ? 'orange' : 'black'} width={130} interactive />
        <span className="s">{pose} {anim}</span></div>)}
    </div></div>;
}
