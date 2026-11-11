import { useStore } from '../db/store';
import { suggestNext } from '../engine/plan';
import { SKILLS } from '../engine/skills';
import { today } from '../lib/stats';
import { Icon } from '../ui/icons';
import { go } from '../ui/router';
import * as audio from '../lib/audio';
import { Sheet } from '../ui/Sheet';

/** The + button: log anything in one or two taps. Health items open their form on the Health tab; a training set
    shows only for cats with training on. */
export function QuickLog({ onClose }: { onClose: () => void }) {
  const { cat, progress, sets, unlockedHidden } = useStore();
  if (!cat) return null;
  const pick = (path: string) => { audio.chirp(); onClose(); go(path); };
  const items: [string, string, string][] = [
    ['weight', 'Weight', 'target'], ['symptom', 'Symptom', 'ear'], ['food', 'Food or treat', 'leaf'],
    ['vet', 'Vet visit', 'box'], ['med', 'Medicine or vaccine', 'check'], ['groom', 'Grooming', 'hand'],
  ];
  const training = cat.training !== false;
  const next = training ? suggestNext(SKILLS, progress, sets, unlockedHidden, today())[0] : null;
  return <Sheet label="Log something" onClose={onClose}>
    <div className="row"><b className="sp" style={{ fontSize: 18 }}>Log something for {cat.name}</b><button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 12 }}>
      {items.map(([k, label, icon]) => <button key={k} className="chipbtn" style={{ height: 'auto', minHeight: 76, borderRadius: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => pick('health/log/' + k)}>
        <Icon name={icon} size={22} /><span style={{ fontSize: 13, textAlign: 'center', lineHeight: 1.2 }}>{label}</span></button>)}
    </div>
    {training && <button className="card mint row" style={{ width: '100%', border: 0, textAlign: 'left', color: 'inherit', marginTop: 12 }} onClick={() => pick('session/' + (next?.skill.id ?? 'clicker'))}>
      <div className="ico"><Icon name="target" /></div><div className="sp"><b>Training set</b><p className="s">{next ? `Up next: ${next.skill.name}` : 'About 2 minutes'}</p></div></button>}
    <button className="btn2" style={{ width: '100%', marginTop: 10, background: 'transparent' }} onClick={() => pick('health')}>Upload a vet document</button>
  </Sheet>;
}
