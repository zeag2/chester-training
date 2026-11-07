import { useStore } from '../db/store';
import { SKILLS } from '../engine/skills';
import { isUnlocked } from '../engine/rules';
import type { Branch, SkillDef } from '../engine/types';
import { Icon, ICON_FOR } from '../ui/icons';

const BG: Record<Branch, string> = { Foundation: 'sky', Care: 'peach', Manners: 'mint', Adventure: 'butter', Tricks: 'grey' };
export type State = 'm' | 'p' | 'u' | 'l';

export function skillState(d: SkillDef, progress: ReturnType<typeof useStore>['progress'], unlockedHidden: string[], started: boolean): State {
  if (progress[d.id]?.mastered) return 'm';
  if (!isUnlocked(d, progress, unlockedHidden)) return 'l';
  return started ? 'p' : 'u';
}
export const STATE_LABEL: Record<State, string> = { m: 'Mastered', p: 'Learning', u: 'Ready', l: 'Locked' };

export function Node({ d, st, sub, indent = 0 }: { d: SkillDef; st: State; sub: string; indent?: number }) {
  const look = { m: { bg: '#232320', fg: '#fff', border: '0' }, p: { bg: '#fff', fg: '#232320', border: '2px solid #232320' }, u: { bg: '#fff', fg: '#232320', border: '1.5px solid #e4e4df' }, l: { bg: '#f4f4f1', fg: '#8a8a84', border: '1.5px dashed #c9c9c3' } }[st];
  return <div style={{ position: 'relative', marginTop: 14, marginLeft: indent }}>
    {indent > 0 && <div aria-hidden="true" style={{ position: 'absolute', left: -12, top: -14, width: 2, height: 42, background: st === 'l' ? '#d6d6d0' : '#232320' }} />}
    <a href={'#/skill/' + d.id} className="card" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12, background: look.bg, color: look.fg, border: look.border, borderRadius: 20, padding: '10px 14px 10px 10px' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: st === 'm' ? '#3a3a36' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: look.fg }}>
        <Icon name={st === 'l' ? 'lock' : st === 'm' ? 'check' : ICON_FOR[d.branch]} size={20} /></div>
      <div className="sp"><b style={{ fontSize: 15 }}>{d.name}</b><p style={{ fontSize: 12, opacity: .75 }}>{sub}</p></div>
      <span className="chip" style={{ background: st === 'm' ? '#3a3a36' : '#fff', color: look.fg }}>{STATE_LABEL[st]}</span></a></div>;
}

export function Tree() {
  const { cat, progress, sets, unlockedHidden } = useStore();
  if (!cat) return null;
  const started = (id: string) => sets.some((s) => s.skillId === id);
  const visible = SKILLS.filter((d) => !d.hidden || unlockedHidden.includes(d.id));
  const branches: Branch[] = ['Foundation', 'Care', 'Manners', 'Adventure', 'Tricks'];
  const nextLocks = visible.filter((d) => skillState(d, progress, unlockedHidden, false) === 'l');
  return <div className="screen">
    <h1>{cat.name}'s skill tree</h1>
    <p className="m" style={{ marginTop: 6 }}>Master a skill to unlock the ones that build on it.</p>
    {nextLocks.length > 0 && <div className="card butter"><p className="s" style={{ color: '#5b4a1c' }}><b>{nextLocks.length} skills</b> are waiting on something {cat.name} hasn't mastered yet.</p></div>}
    <div className="stag">{branches.map((b) => {
      const ds = visible.filter((d) => d.branch === b);
      const hidden = SKILLS.filter((d) => d.branch === b && d.hidden && !unlockedHidden.includes(d.id)).length;
      if (!ds.length && !hidden) return null;
      return <div key={b} className={`card ${BG[b]}`} style={{ padding: '16px 14px 18px' }}>
        <div className="row"><h2 className="sp">{b}</h2>{hidden > 0 && <span className="chip">{hidden} hidden</span>}</div>
        {ds.map((d) => { const st = skillState(d, progress, unlockedHidden, started(d.id)); const p = progress[d.id];
          const sub = st === 'm' ? 'Mastered' : st === 'l' ? 'Needs ' + d.requires.map((r) => SKILLS.find((x) => x.id === r)!.name).join(', ') : st === 'p' ? `Step ${(p?.step ?? 0) + 1} of ${d.steps.length}` : `${d.steps.length} steps`;
          return <Node key={d.id} d={d} st={st} sub={sub} indent={d.requires.length && d.requires[0] !== 'clicker' ? 22 : 0} />; })}
        {!ds.length && <p className="s" style={{ marginTop: 10 }}>All hidden for now. Check-ins unlock them.</p>}
      </div>; })}</div>
  </div>;
}
