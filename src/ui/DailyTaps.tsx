import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { store, useStore } from '../db/store';
import { localDay } from '../engine/day';
import { dailyToday, likelySymptoms, MEALS_PER_DAY, type CareItem, type DailyWhat } from '../engine/care';
import { Icon, Paw } from './icons';
import { go } from './router';
import * as audio from '../lib/audio';
import { DailyLogSheet } from './DailyLogSheet';
import { hideToast } from './Toast';

const time = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
/** Tell Home a cat was just fed, so it shows him round and content for a moment. */
const fedEvent = (ids: string[]) => window.dispatchEvent(new CustomEvent('paldex:fed', { detail: ids }));
const DONE: Record<DailyWhat, string> = { fed: 'Fed', scoop: 'Scooped', play: 'Playtime logged', check: 'Check saved' };

/** Home: one tap each for the everyday things (Fed, Scooped, Played) and a two-tap daily health check, with Undo
    instead of forms. Shared with the household, so "Fed 1 of 2 · 7:40 by Megan" stops anyone double-feeding. */
export function DailyTaps() {
  const { cat, care, account, household, pets } = useStore();
  /** `ids`: everything the last tap logged (one per cat once "All cats" is tapped), so Undo takes all of it back. */
  /** `catId`: the cat it was logged for, so "<other cat> too" and the toast still mean that cat after a switch. */
  const [undo, setUndo] = useState<{ ids: string[]; what: DailyWhat; catId: string; all?: boolean } | null>(null);
  const [busy, setBusy] = useState<DailyWhat | null>(null);
  /** After "Something's off": the symptom chips, likely ones preselected, so saving is one more tap (not the full form). */
  /** `checkId`: the "something was off" check it belongs to, so Undo after Save takes back the check and the symptoms. */
  const [off, setOff] = useState<{ chips: string[]; picked: string[]; checkId: string } | null>(null);
  // the symptom picker belongs to one cat: close it when the shown cat changes, so Save never logs to the wrong one
  useEffect(() => setOff(null), [cat?.id]);
  /** Today's entries sheet (to fix a mistaken tap): one kind from a done tile, or 'all' from "Fix a mistake". */
  const [entries, setEntries] = useState<DailyWhat | 'all' | null>(null);
  // like the picker: the sheet belongs to one cat, so close it when the shown cat changes
  useEffect(() => setEntries(null), [cat?.id]);
  // the sheet takes over from the Undo toast (it would sit hidden behind it, then come back stale after a delete there)
  const openEntries = (w: DailyWhat | 'all') => { setUndo(null); setEntries(w); };
  useEffect(() => { if (!undo) return; const t = window.setTimeout(() => setUndo(null), 5000); return () => window.clearTimeout(t); }, [undo]);
  // one toast at a time: this Undo replaces a booking's "Booked … · Undo" note still showing from Health
  useEffect(() => { if (undo) hideToast(); }, [undo]);
  const today = useMemo(() => dailyToday(care), [care]);
  if (!cat) return null;
  const who = (i?: CareItem) => (!i ? '' : !i.by || i.by === account?.userId ? 'you' : household?.members.find((m) => m.userId === i.by)?.name || 'someone');
  const meals = cat.mealsPerDay ?? MEALS_PER_DAY;
  const log = async (what: DailyWhat, extra: { ok?: boolean } = {}) => {
    if (busy) return null; setBusy(what);
    try {
      const it = await store.saveCare('daily', { what, ...extra });
      if (it) { audio.chirp(); setUndo({ ids: [it.id], what, catId: it.catId }); if (what === 'fed') fedEvent([it.catId]); }
      return it;
    } finally { setBusy(null); }
  };
  // "Something's off": log the check, then ask what (the toast waits until Save, so it never covers the chips)
  const somethingOff = async () => {
    const likely = likelySymptoms(care);
    const it = await log('check', { ok: false });
    if (it) { setUndo(null); setOff({ ...likely, checkId: it.id }); }
  };
  // reopen the picker for today's "something was off" check when nothing was picked for it
  const reopen = (checkId: string) => { setUndo(null); setOff({ ...likelySymptoms(care), checkId }); };
  // with more than one cat: log the same thing for the others too, from the toast (one more tap, never a question first).
  // "Others" are the cats other than the one the toast is about, not the one shown now.
  const undoCat = undo ? pets.find((p) => p.id === undo.catId) : undefined;
  const others = pets.filter((p) => p.id !== (undo?.catId ?? cat.id));
  const alsoLabel = others.length === 1 ? `${others[0].name} too` : 'All cats';
  const logOthers = async () => {
    if (!undo || undo.all) return;
    const ids: string[] = [];
    for (const p of others) { const it = await store.saveCare('daily', { what: undo.what }, { catId: p.id }); if (it) ids.push(it.id); }
    audio.chirp(); setUndo({ ...undo, ids: [...undo.ids, ...ids], all: true });
    if (undo.what === 'fed') fedEvent(others.map((p) => p.id));
  };
  const symptomToday = care.some((c) => c.kind === 'symptom' && !c.deleted && localDay(c.at) === localDay(Date.now()));
  const fed = today.fed, scoop = today.scoop, play = today.play, check = today.check[0];
  const tiles: { what: DailyWhat; label: string; icon: string; sub: string; done: boolean }[] = [
    { what: 'fed', label: 'Fed', icon: 'leaf', done: fed.length >= meals, sub: fed.length ? `${fed.length} of ${meals} · ${time(fed[0].at)}${who(fed[0]) === 'you' ? '' : ` by ${who(fed[0])}`}` : `0 of ${meals} today` },
    { what: 'scoop', label: 'Scooped', icon: 'box', done: scoop.length > 0, sub: scoop.length ? `${time(scoop[0].at)}${who(scoop[0]) === 'you' ? '' : ` by ${who(scoop[0])}`}` : 'Not yet today' },
    { what: 'play', label: 'Played', icon: 'yarn', done: play.length > 0, sub: play.length ? `${play.length}× today` : 'Not yet today' },
  ];
  return <div className="card white">
    <div className="row"><b className="sp" style={{ fontSize: 16 }}>Quick log</b>
      <a href="#/week" className="s" style={{ color: 'var(--teal)', fontWeight: 700 }}>{[0, 1].includes(new Date().getDay()) ? `${cat.name}’s week is in` : 'This week'}</a></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 10 }}>
      {tiles.map((t) => <button key={t.what} className="chipbtn" disabled={busy === t.what} onClick={() => (t.done ? openEntries(t.what) : void log(t.what))}
        aria-label={`${t.label}. ${t.sub}${t.done ? '. Tap to see or fix today’s entries' : ''}`}
        style={{ height: 'auto', minHeight: 76, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '8px 4px', background: t.done ? 'var(--mint)' : 'var(--grey)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{t.done ? <Icon name="check" size={18} /> : <Icon name={t.icon} size={18} />}<b style={{ fontSize: 15 }}>{t.label}</b></span>
        <span className="s" style={{ fontSize: 12, lineHeight: 1.2, textAlign: 'center' }}>{t.sub}</span>
      </button>)}
    </div>
    {Object.values(today).some((l) => l.length > 0) && <button className="s" onClick={() => openEntries('all')}
      style={{ marginTop: 6, minHeight: 44, width: '100%', border: 0, background: 'none', padding: 0, fontFamily: 'inherit', color: 'var(--teal)', fontWeight: 700, textAlign: 'left' }}>Logged by mistake? Fix today’s entries</button>}
    {entries && createPortal(<DailyLogSheet what={entries === 'all' ? undefined : entries} onClose={() => setEntries(null)}
      onAgain={entries === 'all' ? undefined : () => void log(entries)} />, document.body)}
    {off ? <div style={{ marginTop: 12, padding: 12, borderRadius: 16, background: 'var(--sky)' }}>
        <b style={{ fontSize: 15 }}>What’s off?</b>
        <p className="s" style={{ marginTop: 2 }}>{off.picked.length ? 'Picked from the last few days. Change it if it’s something else.' : 'Tap what you noticed.'}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>{off.chips.map((c) => { const on = off.picked.includes(c);
          return <button key={c} className={`chipbtn ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setOff({ ...off, picked: on ? off.picked.filter((x) => x !== c) : [...off.picked, c] })}>{c}</button>; })}</div>
        <div className="row" style={{ gap: 8, marginTop: 10 }}>
          <button className="btn2" style={{ flex: 1, padding: '0 10px', whiteSpace: 'nowrap', background: 'var(--surface)' }} onClick={() => { setOff(null); go('health/log/symptom'); }}>Other or details…</button>
          <button className="btn" style={{ flex: 1, width: 'auto', minHeight: 48, fontSize: 15 }} disabled={!off.picked.length || !!busy} onClick={async () => {
            if (busy) return; setBusy('check');
            try {
              const ids: string[] = [];
              for (const what of off.picked) { const it = await store.saveCare('symptom', { what }); if (it) ids.push(it.id); }
              audio.chirp(); setOff(null);
              // Undo now takes back the check and what was picked, together
              setUndo({ ids: [off.checkId, ...ids], what: 'check', catId: cat.id });
            } finally { setBusy(null); } }}>Save{off.picked.length > 1 ? ` (${off.picked.length})` : ''}</button>
        </div>
      </div>
      : check ? (check.data.ok === false && !symptomToday
        ? <button className="s row" onClick={() => reopen(check.id)} style={{ marginTop: 10, gap: 6, width: '100%', minHeight: 44, border: 0, background: 'none', padding: 0, textAlign: 'left', color: 'inherit', font: 'inherit' }}>
          <Icon name="check" size={16} /><span className="sp">Today’s check: something was off ({time(check.at)}).</span><b style={{ color: 'var(--teal)' }}>What was it?</b></button>
        : <p className="s row" style={{ marginTop: 10, gap: 6 }}><Icon name="check" size={16} />{check.data.ok === false ? `Today’s check: something was off (${time(check.at)}).` : `Today’s check: all normal (${time(check.at)}${who(check) === 'you' ? '' : `, ${who(check)}`}).`}</p>)
      : <div style={{ marginTop: 12, padding: 12, borderRadius: 16, background: 'var(--sky)' }}>
        <b style={{ fontSize: 15 }}>Daily check</b>
        <p className="s" style={{ marginTop: 2 }}>Is {cat.name} eating, using the litter box and acting like {cat.sex === 'f' ? 'herself' : 'himself'}?</p>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn2" style={{ flex: 1, padding: '0 10px', background: 'var(--surface)' }} disabled={!!busy} onClick={() => void log('check', { ok: true })}>All normal</button>
          <button className="btn2" style={{ flex: 1, padding: '0 10px', whiteSpace: 'nowrap', background: 'var(--surface)' }} disabled={!!busy} onClick={() => void somethingOff()}>Something’s off</button>
        </div>
      </div>}
    {undo && !off && createPortal(<div className="toast pop undo" role="status">
      <Paw color="#d4a23a" size={18} /><span className="msg sp">{undo.all ? `${DONE[undo.what]} for all cats` : pets.length > 1 && undoCat ? `${undoCat.name}: ${DONE[undo.what]}` : DONE[undo.what]}</span>
      {others.length > 0 && undo.what !== 'check' && !undo.all && <button className="btn2" onClick={() => void logOthers()}>{alsoLabel}</button>}
      {undo.what === 'scoop' && !undo.all && <button className="btn2" onClick={async () => { await store.saveCare('symptom', { what: 'Litter box change' }, { catId: undo.catId }); setUndo(null); go('health'); }}>Looked off?</button>}
      <button className="btn2" onClick={() => { for (const id of undo.ids) void store.deleteCare(id); setUndo(null); if (undo.what === 'check') setOff(null); }}>Undo</button>
    </div>, document.body)}
  </div>;
}

/** `#/log/fed` (also scoop, play, check): logs it now, once, then shows Home. For the app icon's shortcuts and links
    from iPhone Shortcuts. */
export function LogLink({ what }: { what?: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return; done.current = true;
    const w = (['fed', 'scoop', 'play', 'check'] as DailyWhat[]).find((x) => x === what);
    void (async () => { if (w && store.get().cat) await store.saveCare('daily', { what: w, ...(w === 'check' ? { ok: true } : {}) }); location.replace('#/home'); })();
  }, [what]);
  return <div className="screen" aria-busy="true" />;
}
