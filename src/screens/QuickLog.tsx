import { useStore } from '../db/store';
import { recommendNext } from '../engine/plan';
import { SKILLS } from '../engine/skills';
import { LOG_NAMES } from '../engine/care';
import { today } from '../lib/stats';
import { Icon } from '../ui/icons';
import { go } from '../ui/router';
import * as audio from '../lib/audio';
import { Sheet } from '../ui/Sheet';

type Row = { key: string; label: string; icon: string; sub?: string; path: string };

/** The + button: the one full list of everything you can log (UX review 2026-11-25, item 3), as grouped rows. Home
    keeps only the everyday one-taps (Quick log: Fed, Scooped, Played) and the daily check. Health items open their
    form on the Health tab; a training set shows only for cats with training on. One name per kind (LOG_NAMES). */
export function QuickLog({ onClose }: { onClose: () => void }) {
  const { cat, progress, sets, unlockedHidden } = useStore();
  if (!cat) return null;
  const pick = (path: string) => { audio.chirp(); onClose(); go(path); };
  const training = cat.training !== false;
  const next = training ? recommendNext(SKILLS, progress, sets, unlockedHidden, today()) : null;
  const groups: [string, Row[]][] = [
    ['Health', [
      { key: 'weight', label: LOG_NAMES.weight, icon: 'target', path: 'health/log/weight' },
      { key: 'symptom', label: LOG_NAMES.symptom, icon: 'ear', path: 'health/log/symptom' },
      { key: 'med', label: LOG_NAMES.med, icon: 'check', path: 'health/log/med' },
      { key: 'vet', label: LOG_NAMES.vet, icon: 'box', path: 'health/log/vet' },
      { key: 'groom', label: LOG_NAMES.groom, icon: 'hand', path: 'health/log/groom' },
    ]],
    ['Food', [{ key: 'food', label: LOG_NAMES.food, icon: 'leaf', path: 'health/log/food' }]],
    ...(training ? [['Training', [{ key: 'train', label: LOG_NAMES.train, icon: 'target', sub: next ? `${next.kind === 'last' ? 'Again' : 'Up next'}: ${next.skill.name}` : 'About 2 minutes', path: 'session/' + (next?.skill.id ?? 'clicker') }]] as [string, Row[]]] : []),
    ['Documents', [{ key: 'doc', label: LOG_NAMES.doc, icon: 'book', sub: 'Snap the papers or pick a PDF', path: 'health' }]],
  ];
  return <Sheet label="Log something" onClose={onClose}>
    <div className="row"><b className="sp" style={{ fontSize: 18 }}>Log something for {cat.name}</b><button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
    {groups.map(([g, rows]) => <div key={g} role="group" aria-label={g} data-loggroup={g}>
      <p className="label" style={{ marginTop: 'var(--sp-4)', marginBottom: 'var(--sp-2)' }}>{g}</p>
      <div className="lgroup">{rows.map((r) => <button key={r.key} className="lrow" onClick={() => pick(r.path)}>
        <Icon name={r.icon} size={22} /><span className="sp">{r.label}{r.sub && <span className="s" style={{ display: 'block' }}>{r.sub}</span>}</span>
        <span className="chev"><Icon name="chevron" size={18} /></span></button>)}</div>
    </div>)}
  </Sheet>;
}
