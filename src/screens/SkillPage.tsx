import { Chester } from '../chester/Chester';
import { useStore } from '../db/store';
import { SKILL_BY_ID } from '../engine/skills';
import { isUnlocked } from '../engine/rules';
import { Icon, ICON_FOR } from '../ui/icons';
import { go } from '../ui/router';
import { usePetText } from '../lib/pet';

const SOURCES: Record<string, string> = {
  R1: 'Kogan, Kolus & Schoenfeld-Tacher (2017), Animals', R2: 'Pratsch et al. (2018), Applied Animal Behaviour Science', R3: 'Rodan et al. (2022), Journal of Feline Medicine and Surgery',
  R4: 'Ellis et al. (2013), Journal of Feline Medicine and Surgery', R5: 'Vitale Shreve et al. (2017), Behavioural Processes', R6: 'Vitale, Behnke & Udell (2019), Current Biology',
  R7: 'Saito et al. (2019), Scientific Reports', R8: 'Delgado, Han & Bain (2021), Animal Cognition', R11: 'Casey & Bradshaw (2008), Applied Animal Behaviour Science',
};
const ANIM: Record<string, string> = { target: 'boop', spin: 'spin', highfive: 'wave', fetch: 'play', gentle: 'play', carrier: '' };

export function SkillPage({ id }: { id: string }) {
  const pt = usePetText();
  const { cat, progress, sets, unlockedHidden } = useStore();
  const d = SKILL_BY_ID[id];
  if (!cat || !d) return null;
  const p = progress[id]; const step = p?.step ?? 0; const open = isUnlocked(d, progress, unlockedHidden);
  const atStep = sets.filter((s) => s.skillId === id && s.step === step && !s.review).slice(-2);
  return <div className="screen">
    <div className="top"><button className="iconbtn" aria-label="Back" onClick={() => history.length > 1 ? history.back() : go('library')}><Icon name="back" /></button><b style={{ fontSize: 17 }}>{d.branch}</b></div>
    <div className="card sky" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 16, padding: 18 }}>
      <div className="ico" style={{ width: 64, height: 64, borderRadius: 20 }}><Icon name={ICON_FOR[d.branch]} size={32} /></div>
      <div><h1 style={{ fontSize: 24 }}>{d.name}</h1><p className="s">{p?.mastered ? 'Mastered' : open ? `Step ${step + 1} of ${d.steps.length}` : 'Locked'}</p></div></div>
    <div className="card mint" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 16px 12px' }}>
      <Chester coat={cat.coat} eyes={cat.eyes} anim={ANIM[id] ?? ''} raised={ANIM[id] === 'wave' || ANIM[id] === 'play'} pose={id === 'carrier' ? 'loaf' : 'sit'} width={140} interactive label={cat.name} />
      <p className="s" style={{ marginTop: 6, textAlign: 'center' }}>{pt(d.why)}</p></div>
    <h2 style={{ marginTop: 22 }}>Steps</h2>
    {d.steps.map((t, i) => { const done = p?.mastered || i < step; const now = !p?.mastered && i === step && open;
      return <div key={i} className="row" style={{ alignItems: 'flex-start', marginTop: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: done || now ? 'var(--ink)' : 'var(--grey)', color: done || now ? 'var(--on-ink)' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flex: 'none' }}>{done ? <Icon name="check" size={18} /> : i + 1}</div>
        <div style={{ flex: 1, paddingTop: 4 }}><p style={{ fontSize: 15, fontWeight: now ? 700 : 400, color: done || now ? 'var(--ink)' : 'var(--muted)' }}>{pt(t)}</p>
          {now && <p className="s" style={{ marginTop: 2 }}>{atStep.length && atStep[atStep.length - 1].good / atStep[atStep.length - 1].reps >= 0.8 && atStep[atStep.length - 1].reps >= 5 ? '1 of 2 passes done' : 'Pass twice in a row to move up'}</p>}</div></div>; })}
    <div className="card butter" style={{ marginTop: 20 }}><b>Tips</b><p className="s" style={{ marginTop: 4, color: 'var(--butter-ink)' }}>{pt(d.tips)}</p></div>
    <div className="card grey"><b>What passing means</b><p className="s" style={{ marginTop: 4 }}>{pt('5 or more tries, at least 80% good, and he stays relaxed. Pass twice in a row to move up a step.')}</p></div>
    <p className="s" style={{ marginTop: 14 }}>Based on: {d.sources.map((s) => SOURCES[s] ?? s).join('; ')}</p>
    {open ? <button className="btn" style={{ marginTop: 18 }} onClick={() => go('session/' + id)}>{p?.mastered ? 'Review session' : 'Start a session'}</button>
      : <div className="card grey"><b>Locked</b><p className="s" style={{ marginTop: 2 }}>Master {d.requires.map((r) => SKILL_BY_ID[r].name).join(' and ')} first.</p></div>}
  </div>;
}
