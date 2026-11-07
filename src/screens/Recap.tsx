import { useState } from 'react';
import { Chester } from '../chester/Chester';
import { store, useStore, type LogResult } from '../db/store';
import { SKILL_BY_ID } from '../engine/skills';
import type { Mood } from '../engine/types';
import { Icon, Paw } from '../ui/icons';
import { go } from '../ui/router';
import * as audio from '../lib/audio';

function Stepper({ label, value, set, min = 0, max = 99 }: { label: string; value: number; set: (n: number) => void; min?: number; max?: number }) {
  return <div className="card grey" style={{ padding: '12px 14px' }}>
    <p className="s" style={{ fontWeight: 700 }}>{label}</p>
    <div className="row" style={{ marginTop: 6 }}>
      <button className="btn2" style={{ width: 64, minHeight: 56, fontSize: 26, background: 'var(--surface)' }} aria-label={`Fewer ${label.toLowerCase()}`} onClick={() => { audio.buzz(6); set(Math.max(min, value - 1)); }}>−</button>
      <b className="num sp" style={{ fontSize: 34, textAlign: 'center' }} aria-live="polite">{value}</b>
      <button className="btn2" style={{ width: 64, minHeight: 56, fontSize: 26, background: 'var(--surface)' }} aria-label={`More ${label.toLowerCase()}`} onClick={() => { audio.buzz(6); set(Math.min(max, value + 1)); }}>+</button>
    </div></div>;
}

export function Recap({ skillId }: { skillId: string }) {
  const { cat, draft } = useStore();
  const def = SKILL_BY_ID[skillId];
  const d = draft && draft.skillId === skillId ? draft : null;
  const [reps, setReps] = useState(d?.reps ?? 0);
  const [good, setGood] = useState(d?.good ?? 0);
  const [mood, setMood] = useState<Mood>('Happy');
  const [result, setResult] = useState<LogResult | null>(null);
  const [saving, setSaving] = useState(false);
  if (!cat || !def) return null;
  if (result) return <RewardMoment result={result} catName={cat.name} coat={cat.coat} eyes={cat.eyes} />;

  const save = async () => {
    if (saving) return; setSaving(true);
    const r = await store.logSet({ skillId, reps, good: Math.min(good, reps), mood, seconds: d?.seconds ?? 0 });
    if (r) { audio.sparkle(); audio.buzz([10, 40, 20]); setResult(r); } else { await store.clearDraft(); go('home'); }
  };
  return <div className="screen" style={{ paddingBottom: 'calc(28px + var(--safe-b))' }}>
    <div className="top"><button className="iconbtn" aria-label="Back to the session" onClick={() => go('session/' + skillId)}><Icon name="back" /></button><b style={{ fontSize: 17 }}>How did it go?</b></div>
    <div className="row" style={{ alignItems: 'flex-end' }}><Chester coat={cat.coat} eyes={cat.eyes} pose="loaf" width={96} interactive label={cat.name} /><div style={{ marginBottom: 20 }}><span className="bubble mint">{reps === 0 ? 'No reps yet. That’s okay!' : `${good} of ${reps}, nice!`}</span></div></div>
    <h1 style={{ marginTop: 6 }}>{def.name}</h1>
    <Stepper label="Tries" value={reps} set={(n) => { setReps(n); if (good > n) setGood(n); }} />
    <Stepper label="Good ones" value={Math.min(good, reps)} set={(n) => setGood(Math.min(n, reps))} max={reps} />
    <span className="field">How was {cat.name}?</span>
    <div className="seg" role="group" aria-label="Mood">{(['Happy', 'Distracted', 'Stressed'] as Mood[]).map((m) => <button key={m} className={m === mood ? 'on' : ''} aria-pressed={m === mood} onClick={() => { audio.buzz(6); setMood(m); }}>{m}</button>)}</div>
    {mood === 'Stressed' && <div className="card peach row"><Paw color="#c2563f" size={22} /><p className="s" style={{ color: 'var(--peach-ink)' }}>Good call stopping. Next time, make the step easier or shorter.</p></div>}
    <button className="btn" style={{ marginTop: 22 }} onClick={save} disabled={saving}>{reps === 0 ? 'Skip this set' : 'Save set'}</button>
  </div>;
}

const COLORS = ['#d4a23a', '#2a7a6f', '#c2563f', '#3f6fb0', '#e38b3d'];
export function RewardMoment({ result, catName, coat, eyes }: { result: LogResult; catName: string; coat: string; eyes: string }) {
  const def = SKILL_BY_ID[result.set.skillId];
  const { event, reward, set, progress } = result;
  const big = event === 'mastered' || event === 'stepUp';
  const title = event === 'mastered' ? `${catName} mastered ${def.name}!` : event === 'stepUp' ? 'Step up!' : event === 'pass' ? 'That’s a pass!' : event === 'review' ? 'Review done' : set.mood === 'Stressed' ? 'Kind call to stop' : 'Nice practice';
  const sub = event === 'mastered' ? 'A new trick for his collection. Badges and his new move arrive in the next update.'
    : event === 'stepUp' ? `Next: ${def.steps[progress.step]}`
    : event === 'pass' ? 'One more pass in a row moves him up a step.'
    : event === 'review' ? 'Keeping old skills sharp.'
    : set.reps < 5 ? 'Aim for 5 or more tries next time to count toward a pass.' : 'Short and happy beats long. Try again later.';
  return <div className="overlay" style={{ background: big ? 'var(--butter)' : 'var(--mint)' }}>
    <div className="conf" aria-hidden="true">{Array.from({ length: big ? 22 : 12 }, (_, k) => <i key={k} style={{ left: `${(k * 37) % 100}%`, background: COLORS[k % 5], animationDelay: `${((k * 0.29) % 3).toFixed(2)}s` }} />)}</div>
    <div style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: 'calc(40px + var(--safe-t)) 20px calc(28px + var(--safe-b))', display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}><Chester coat={coat} eyes={eyes} mood="happy" anim="dance" width={180} interactive label={catName} /></div>
      <div className="stag" style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 30, marginTop: 8 }}>{title}</h1>
        <p className="m" style={{ marginTop: 8 }}>{sub}</p>
        {reward.rewarded ? <>
          <div className="card white row" style={{ textAlign: 'left' }}><Paw size={26} color="#d4a23a" /><div className="sp"><b>+{reward.treats} treats</b><p className="s">{set.good} good reps{reward.gift?.treats ? ` + ${reward.gift.treats} from the gift` : ''}</p></div></div>
          {reward.gift && <div className="card white row" style={{ textAlign: 'left' }}><Icon name="star" /><div className="sp"><b>{reward.gift.title}</b><p className="s">{reward.gift.detail}</p></div></div>}
        </> : <div className="card white" style={{ textAlign: 'left' }}><b>{catName} is done for today</b><p className="s">The set is saved. Rewards reset tomorrow, so he never gets overtrained.</p></div>}
      </div>
      <button className="btn" style={{ marginTop: 'auto' }} onClick={() => go('home')}>Back home</button>
    </div>
  </div>;
}
