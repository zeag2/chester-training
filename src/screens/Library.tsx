import { useState } from 'react';
import { useStore } from '../db/store';
import { SKILLS } from '../engine/skills';
import type { Branch } from '../engine/types';
import { Icon, ICON_FOR } from '../ui/icons';
import { skillState, STATE_LABEL } from './Tree';

const CHIP: Record<string, [string, string]> = { m: ['#232320', '#fff'], p: ['#e7effa', '#232320'], u: ['#e6f3ee', '#1d5a52'], l: ['#f4f4f1', '#8a8a84'] };
export function Library() {
  const { progress, sets, unlockedHidden } = useStore();
  const [q, setQ] = useState('');
  const [f, setF] = useState<'All' | Branch>('All');
  const visible = SKILLS.filter((d) => !d.hidden || unlockedHidden.includes(d.id));
  const hiddenCount = SKILLS.length - visible.length;
  const list = visible.filter((d) => (f === 'All' || d.branch === f) && (d.name + ' ' + d.why).toLowerCase().includes(q.toLowerCase()));
  return <div className="screen">
    <h1>Library</h1>
    <div className="row" style={{ minHeight: 48, borderRadius: 999, background: 'var(--grey)', padding: '0 16px', marginTop: 14, gap: 8 }}>
      <Icon name="search" size={20} /><input aria-label="Search skills" placeholder={`Search ${visible.length} skills`} value={q} onChange={(e) => setQ(e.target.value)} style={{ border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 16, flex: 1, height: 46, outline: 'none' }} /></div>
    <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }} role="group" aria-label="Filter by branch">
      {(['All', 'Foundation', 'Care', 'Manners', 'Adventure', 'Tricks'] as const).map((b) => <button key={b} className={`chipbtn ${f === b ? 'on' : ''}`} aria-pressed={f === b} onClick={() => setF(b)}>{b}</button>)}</div>
    <div className="stag" style={{ marginTop: 6 }}>{list.map((d, i) => { const st = skillState(d, progress, unlockedHidden, sets.some((s) => s.skillId === d.id)); const [bg, fg] = CHIP[st];
      return <a key={d.id} href={'#/skill/' + d.id} className="item"><div className={`ico ${['sky', 'mint', 'peach', 'butter'][i % 4]}`}><Icon name={ICON_FOR[d.branch]} /></div><div className="sp"><b style={{ fontSize: 15 }}>{d.name}</b><p className="s">{d.branch} · {d.steps.length} steps</p></div><span className="chip" style={{ background: bg, color: fg }}>{STATE_LABEL[st]}</span></a>; })}
      {list.length === 0 && <p className="m" style={{ marginTop: 20, textAlign: 'center' }}>No skills match "{q}".</p>}</div>
    {hiddenCount > 0 && f === 'All' && !q && <div className="card butter" style={{ marginTop: 20 }}><b>{hiddenCount} hidden skills</b><p className="s" style={{ marginTop: 2, color: '#5b4a1c' }}>They open as {'he'} grows: by mastering related skills, and from check-ins in a later update.</p></div>}
  </div>;
}
