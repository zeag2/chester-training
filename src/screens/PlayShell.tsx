import { useRef, useState } from 'react';
import { store, useStore } from '../db/store';
import { playedToday } from '../engine/corner';
import { localDay } from '../engine/day';
import { MOVE_REWARD, movesFound, PLAY_MOVES, type AnyToy } from '../engine/play';
import { usePetText } from '../lib/pet';
import * as audio from '../lib/audio';
import { Icon } from '../ui/icons';
import { go } from '../ui/router';

/** What every toy game shares: the toast and speech line, the first-play-of-the-day reward and the "new move" moments. */
export function usePlayTalk(toy: AnyToy) {
  const pt = usePetText();
  const [line, setLine] = useState('');
  const [toast, setToast] = useState('');
  const say = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? '' : x)), 2600); };
  const found = useRef(new Set<string>());
  /** A catch (or any real bit of play): the first one today pays the daily play reward. */
  const played = async () => {
    const c = store.get().cat;
    if (c && !playedToday(c.corner, localDay(Date.now())) && await store.play(toy)) say(pt('+2 treats and +1 bond: first play today. He loves this.'));
  };
  /** A move found: the first time ever for this pet pays a few treats. */
  const foundMove = async (move: string) => {
    if (found.current.has(move)) return;
    found.current.add(move);
    if (await store.foundMove(toy, move)) { const m = PLAY_MOVES[toy].find((x) => x.id === move); say(`New move: ${m?.name ?? move}! +${MOVE_REWARD.treats} treats`); audio.sparkle(); }
  };
  return { line, setLine, toast, played, foundMove };
}

/** The frame round every toy game: title, moves count, the speech bubble, the stage (children) and the moves found. */
export function PlayShell({ toy, title, toast, line, children }: { toy: AnyToy; title: string; toast: string; line: string; children: React.ReactNode }) {
  const { cat } = useStore();
  const pt = usePetText();
  if (!cat) return null;
  const have = movesFound(cat.corner?.log, toy);
  const next = PLAY_MOVES[toy].find((m) => !have.includes(m.id));
  return <div className="screen" style={{ paddingBottom: 'calc(28px + var(--safe-b))' }}>
    <div className="top"><button className="iconbtn" aria-label="Back to the corner" onClick={() => go('corner')}><Icon name="back" /></button>
      <b className="sp" style={{ fontSize: 17 }}>{title} with {cat.name}</b>
      <span className="chip num" style={{ background: 'var(--mint)', minHeight: 32 }} aria-label={`${have.length} of ${PLAY_MOVES[toy].length} moves found`}>{have.length}/{PLAY_MOVES[toy].length}</span></div>
    <div style={{ minHeight: 46, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
      {(toast || line) && <span key={toast + line} className={`bubble ${toast ? 'butter' : 'mint'}`} role="status" style={toast ? { background: 'var(--butter)', color: 'var(--butter-ink)' } : undefined}>{toast || line}</span>}</div>
    {children}
    <div className="card grey" style={{ marginTop: 14 }}>
      <div className="row"><b className="sp">Moves found</b><span className="s num">{have.length} of {PLAY_MOVES[toy].length} · +{MOVE_REWARD.treats} treats each</span></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {PLAY_MOVES[toy].map((m) => { const on = have.includes(m.id); return <span key={m.id} className="chip" style={{ background: on ? 'var(--mint)' : 'var(--surface)', opacity: on ? 1 : 0.7 }}>{on ? <Icon name="check" size={14} /> : null}{on ? m.name : '???'}</span>; })}
      </div>
      <p className="s" style={{ marginTop: 10 }}>{next ? `Next one: ${next.hint}` : pt('Every move found. He’s a pro.')}</p>
    </div>
  </div>;
}
