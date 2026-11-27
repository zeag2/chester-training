import { useState } from 'react';
import { useStore } from '../db/store';
import { SKILLS } from '../engine/skills';
import type { Branch } from '../engine/types';
import { Icon, ICON_FOR } from '../ui/icons';
import { skillState, STATE_LABEL } from './Tree';
import { ScreenHeader } from '../ui/ScreenHeader';
import { back } from '../ui/router';

const CHIP: Record<string, [string, string]> = { m: ['var(--ink)', 'var(--on-ink)'], p: ['var(--sky)', 'var(--ink)'], u: ['var(--mint)', 'var(--teal-ink)'], l: ['var(--grey)', 'var(--ink)'] };
export function Library() {
  const { progress, sets, unlockedHidden, cat } = useStore();
  const [q, setQ] = useState('');
  const [f, setF] = useState<'All' | Branch>('All');
  const visible = SKILLS.filter((d) => !d.hidden || unlockedHidden.includes(d.id));
  const hiddenCount = SKILLS.length - visible.length;
  const list = visible.filter((d) => (f === 'All' || d.branch === f) && (d.name + ' ' + d.why).toLowerCase().includes(q.toLowerCase()));
  return <div className="screen">
    <ScreenHeader onBack={() => back('chester')} title="Library" />
    <div className="row" style={{ minHeight: 48, borderRadius: 'var(--r-pill)', background: 'var(--grey)', padding: '0 var(--sp-4)', marginTop: 'var(--sp-3)', gap: 'var(--sp-2)' }}>
      <Icon name="search" size={20} /><input aria-label="Search skills" placeholder={`Search ${visible.length} skills`} value={q} onChange={(e) => setQ(e.target.value)} style={{ border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--fs-body)', flex: 1, height: 46, outline: 'none' }} /></div>
    <div style={{ display: 'flex', gap: 'var(--sp-2)', marginTop: 'var(--sp-3)', overflowX: 'auto', paddingBottom: 'var(--sp-1)' }} role="group" aria-label="Filter by branch">
      {(['All', 'Foundation', 'Care', 'Manners', 'Adventure', 'Tricks'] as const).map((b) => <button key={b} className={`chipbtn ${f === b ? 'on' : ''}`} aria-pressed={f === b} onClick={() => setF(b)}>{b}</button>)}</div>
    <div className="stag" style={{ marginTop: 6 }}>{list.map((d) => { const st = skillState(d, progress, unlockedHidden, sets.some((s) => s.skillId === d.id)); const [bg, fg] = CHIP[st];
      return <a key={d.id} href={'#/skill/' + d.id} className="item"><div className="ico grey"><Icon name={st === 'l' ? 'lock' : ICON_FOR[d.branch]} /></div><div className="sp"><b style={{ fontSize: 'var(--fs-title)' }}>{d.name}</b><p className="s">{d.branch} · {d.steps.length} steps</p></div>{st === 'l' ? <span className="visually-hidden">{STATE_LABEL[st]}</span> : <span className="chip" style={{ background: bg, color: fg }}>{STATE_LABEL[st]}</span>}</a>; })}
      {list.length === 0 && <p className="m" style={{ marginTop: 'var(--sp-5)', textAlign: 'center' }}>No skills match "{q}".</p>}</div>
    {hiddenCount > 0 && f === 'All' && !q && <div className="card butter" style={{ marginTop: 'var(--sp-5)' }}><b>{hiddenCount} hidden skills</b><p className="s" style={{ marginTop: 2, color: 'var(--butter-ink)' }}>They open as {cat?.sex === 'f' ? 'she' : 'he'} grows: by mastering related skills, and from check-ins in a later update.</p></div>}
  </div>;
}
