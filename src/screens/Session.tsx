import { useEffect, useRef, useState } from 'react';
import { Chester } from '../chester/Chester';
import type { ReactionId } from '../chester/reactions';
import { store, useStore } from '../db/store';
import { SKILL_BY_ID } from '../engine/skills';
import { Icon, Paw } from '../ui/icons';
import { go } from '../ui/router';
import * as audio from '../lib/audio';
import { YarnBall } from './YarnBall';
import { wrapSVG } from './yarn';

export const SESSION_SECONDS = 120;

export function Session({ skillId }: { skillId: string }) {
  const { cat, progress, draft, wallet } = useStore();
  const def = SKILL_BY_ID[skillId];
  const resume = draft && draft.skillId === skillId ? draft : null;
  const [reps, setReps] = useState(resume?.reps ?? 0);
  const [good, setGood] = useState(resume?.good ?? 0);
  const [elapsed, setElapsed] = useState(resume?.seconds ?? 0);
  const [running, setRunning] = useState(true);
  const [react, setReact] = useState<ReactionId | null>(null);
  const [line, setLine] = useState('');
  const [pressed, setPressed] = useState(0);
  const startedAt = useRef(resume?.startedAt ?? Date.now());
  const firstTime = !(wallet?.hintsSeen ?? []).includes('session');

  useEffect(() => {
    if (!running) return;
    const iv = window.setInterval(() => setElapsed((e) => Math.min(SESSION_SECONDS, e + 1)), 1000);
    return () => window.clearInterval(iv);
  }, [running]);
  useEffect(() => {
    if (elapsed >= SESSION_SECONDS && running) { setRunning(false); audio.sparkle(); audio.buzz([20, 60, 20]); setLine('All tangled up! Time to wrap up.'); }
  }, [elapsed, running]);
  // keep a draft so a closed app never loses a set
  useEffect(() => { if (reps > 0 || elapsed > 0) void store.saveDraft({ skillId, startedAt: startedAt.current, reps, good, seconds: elapsed }); }, [reps, good, skillId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = window.setInterval(() => { void store.saveDraft({ skillId, startedAt: startedAt.current, reps: repsRef.current, good: goodRef.current, seconds: elRef.current }); }, 10000); return () => window.clearInterval(t); }, [skillId]);
  const repsRef = useRef(reps); repsRef.current = reps; const goodRef = useRef(good); goodRef.current = good; const elRef = useRef(elapsed); elRef.current = elapsed;

  if (!cat || !def) return null;
  const p = progress[skillId];
  const step = p?.mastered ? def.steps.length - 1 : p?.step ?? 0;
  const left = SESSION_SECONDS - elapsed;
  const prog = elapsed / SESSION_SECONDS;
  const wraps = wrapSVG(prog, '#161a2b');

  const markSeen = () => { if (firstTime) void store.updateWallet((w) => ({ ...w, hintsSeen: [...w.hintsSeen, 'session'] })); };
  const yes = () => {
    audio.click(); audio.buzz(14); markSeen();
    setReps((r) => r + 1); setGood((g) => g + 1); setPressed((n) => n + 1);
    if (!running && elapsed < SESSION_SECONDS) setRunning(true);
    const n = good + 1;
    setReact(n % 3 === 0 ? 'r14' : 'r1'); setLine(['Click! Treat!', 'Nom!', 'Again!', 'Yes!'][n % 4]);
    window.setTimeout(() => setReact(null), 50);
  };
  const missed = () => { audio.buzz(6); markSeen(); setReps((r) => r + 1); setLine('No worries, try again'); };
  const finish = async () => { setRunning(false); await store.saveDraft({ skillId, startedAt: startedAt.current, reps, good, seconds: elapsed }); go('recap/' + skillId); };
  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');

  return <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface)', paddingTop: 'var(--safe-t)', paddingBottom: 'calc(12px + var(--safe-b))' }}>
    <div style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '0 16px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="top">
        <button className="iconbtn" aria-label="Close session" onClick={finish}><Icon name="close" /></button>
        <div className="sp"><b style={{ fontSize: 16 }}>{def.name}</b><p className="s" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Step {step + 1}: {def.steps[step]}</p></div>
        <b className="num" style={{ fontSize: 22, minWidth: 54, textAlign: 'right' }} aria-live="off">{mm}:{ss}</b>
      </div>
      <div className={running ? '' : 'paused'} style={{ position: 'relative', width: '100%', aspectRatio: '350 / 200', maxHeight: '30vh', margin: '2px auto 0' }}>
        <YarnBall p={prog} hop={pressed} hurry={running && left <= 10} />
        <div style={{ position: 'absolute', left: '-4%', bottom: '2%', width: '38%' }}><Chester coat={cat.coat} eyes={cat.eyes} raised anim="bat" width={130} extra={wraps} interactive label={cat.name} react={react} onPet={(l) => setLine(l)} /></div>
        {(line || firstTime) && <span key={line} className="bubble butter" style={{ position: 'absolute', left: '30%', top: 0, fontSize: 13 }}>{line || 'Tap anywhere when I get it!'}</span>}
      </div>
      <button onClick={yes} aria-label="Yes! Log a good rep" style={{ flex: 1, minHeight: 200, marginTop: 10, border: 0, borderRadius: 32, background: 'var(--mint)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--ink)', position: 'relative', overflow: 'hidden' }} className="yespaw">
        <span key={pressed} className="pawstamp"><Paw size={120} color="var(--ink)" /></span>
        <b style={{ fontSize: 34, fontWeight: 800 }}>Yes!</b>
        <span className="s num">{good} good · {reps - good} missed</span>
      </button>
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <button className="btn2" style={{ flex: 1, minHeight: 56 }} onClick={missed}>Missed</button>
        <button className="btn2" style={{ flex: 1, minHeight: 56 }} onClick={() => { audio.chirp(!running); setRunning(!running); }} aria-label={running ? 'Pause timer' : 'Resume timer'}><Icon name={running ? 'pause' : 'play'} />&nbsp;{running ? 'Pause' : 'Resume'}</button>
        <button className="btn2" style={{ flex: 1, minHeight: 56, background: 'var(--ink)', color: 'var(--on-ink)' }} onClick={finish}>End</button>
      </div>
    </div>
  </div>;
}
