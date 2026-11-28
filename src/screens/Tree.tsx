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
  const look = { m: { bg: 'var(--ink)', fg: 'var(--on-ink)', border: '0' }, p: { bg: 'var(--surface)', fg: 'var(--ink)', border: '2px solid var(--ink)' }, u: { bg: 'var(--surface)', fg: 'var(--ink)', border: '1.5px solid var(--line)' }, l: { bg: 'var(--surface)', fg: 'var(--ink)', border: '1.5px solid var(--line)' } }[st];
  return <div style={{ position: 'relative', marginTop: 14, marginLeft: indent }}>
    {indent > 0 && <div aria-hidden="true" style={{ position: 'absolute', left: -12, top: -14, width: 2, height: 42, background: st === 'l' ? 'var(--faint)' : 'var(--ink)' }} />}
    <a href={'#/skill/' + d.id} className="card" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', background: look.bg, color: look.fg, border: look.border, borderRadius: 'var(--r-row)', padding: '10px 14px 10px 10px' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: st === 'm' ? 'var(--ink-2)' : 'var(--grey)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: look.fg }}>
        <Icon name={st === 'l' ? 'lock' : st === 'm' ? 'check' : ICON_FOR[d.branch]} size={20} /></div>
      <div className="sp"><b style={{ fontSize: 'var(--fs-title)' }}>{d.name}</b><p style={{ fontSize: 'var(--fs-label)', opacity: .75 }}>{sub}</p></div>
      {/* locked: the lock icon says it (with its name for VoiceOver), no pill (UX review 2026-11-25, item 7) */}
      {st === 'l' ? <span className="visually-hidden">{STATE_LABEL[st]}</span>
        : <span className="chip" style={{ background: st === 'm' ? 'var(--ink-2)' : 'var(--grey)', color: look.fg }}>{STATE_LABEL[st]}</span>}</a></div>;
}

/** The tree view of Skills (`#/skills/tree`): every skill by branch, and what unlocks next. */
export function TreeView() {
  const { cat, progress, sets, unlockedHidden } = useStore();
  if (!cat) return null;
  const started = (id: string) => sets.some((s) => s.skillId === id);
  const visible = SKILLS.filter((d) => !d.hidden || unlockedHidden.includes(d.id));
  const branches: Branch[] = ['Foundation', 'Care', 'Manners', 'Adventure', 'Tricks'];
  const nextLocks = visible.filter((d) => skillState(d, progress, unlockedHidden, false) === 'l');
  return <>
    <p className="m" style={{ marginTop: 'var(--sp-3)' }}>Master a skill to unlock the ones that build on it.</p>
    {nextLocks.length > 0 && <div className="card butter"><p className="s" style={{ color: 'var(--butter-ink)' }}><b>{nextLocks.length} skills</b> are waiting on something {cat.name} hasn't mastered yet.</p></div>}
    <div className="stag">{branches.map((b) => {
      const ds = visible.filter((d) => d.branch === b);
      const hidden = SKILLS.filter((d) => d.branch === b && d.hidden && !unlockedHidden.includes(d.id)).length;
      if (!ds.length && !hidden) return null;
      return <div key={b} className={`card ${BG[b]}`} style={{ padding: 'var(--sp-4) 14px 18px' }}>
        <div className="row"><h2 className="sp">{b}</h2>{hidden > 0 && <span className="chip">{hidden} hidden</span>}</div>
        {ds.map((d) => { const st = skillState(d, progress, unlockedHidden, started(d.id)); const p = progress[d.id];
          const sub = st === 'm' ? 'Mastered' : st === 'l' ? 'Needs ' + d.requires.map((r) => SKILLS.find((x) => x.id === r)!.name).join(', ') : st === 'p' ? `Step ${(p?.step ?? 0) + 1} of ${d.steps.length}` : `${d.steps.length} steps`;
          return <Node key={d.id} d={d} st={st} sub={sub} indent={d.requires.length && d.requires[0] !== 'clicker' ? 22 : 0} />; })}
        {!ds.length && <p className="s" style={{ marginTop: 10 }}>All hidden for now. Check-ins unlock them.</p>}
      </div>; })}</div>
  </>;
}
