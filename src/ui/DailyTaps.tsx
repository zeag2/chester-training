import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { store, useStore } from '../db/store';
import { localDay } from '../engine/day';
import { APPETITE, dailyDetail, dailyToday, lastPlay, likelySymptoms, MEALS_PER_DAY, PLAY_MINUTES, PLAY_TOYS, playText, WATER, type Appetite, type CareData, type CareItem, type DailyWhat, type Water } from '../engine/care';
import { Icon, Paw } from './icons';
import { go } from './router';
import * as audio from '../lib/audio';
import { DailyLogSheet } from './DailyLogSheet';
import { hideToast } from './Toast';

const time = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
/** Tell Home a cat was just fed, so it shows him round and content for a moment. */
const fedEvent = (ids: string[]) => window.dispatchEvent(new CustomEvent('paldex:fed', { detail: ids }));
const DONE: Record<DailyWhat, string> = { fed: 'Fed', scoop: 'Scooped', play: 'Playtime logged', check: 'Check saved' };
/** The inline question panels (What's off?, Playtime, Daily check): one look for all three. */
const PANEL: React.CSSProperties = { marginTop: 'var(--sp-3)', padding: 'var(--sp-3)', borderRadius: 16, background: 'var(--sky)' };
const PANEL_TITLE: React.CSSProperties = { fontSize: 15 };
const PANEL_BTN: React.CSSProperties = { flex: 1, padding: '0 10px', whiteSpace: 'nowrap', background: 'var(--surface)' };
const PANEL_SAVE: React.CSSProperties = { flex: 1, width: 'auto', minHeight: 48, fontSize: 15 };

/** A labelled one-of choice that can also be left empty (tap the picked one again to clear it): the daily check's
    Water and Appetite, Playtime's How long. `.seg`, so it reads as "pick one". */
function Choice<K extends string | number>({ label, options, value, onPick }: { label: string; options: [K, string][]; value?: K; onPick: (v?: K) => void }) {
  return <div style={{ marginTop: 'var(--sp-2)' }}>
    <span className="s" style={{ display: 'block', fontWeight: 800 }}>{label}</span>
    <div className="seg" role="group" aria-label={label} style={{ marginTop: 'var(--sp-1)' }}>
      {options.map(([k, name]) => <button key={k} className={value === k ? 'on' : ''} aria-pressed={value === k} onClick={() => onPick(value === k ? undefined : k)}>{name}</button>)}
    </div></div>;
}

/** Home: one tap each for the everyday things (Fed, Scooped, Played) and a two-tap daily health check, with Undo
    instead of forms. Shared with the household, so "Fed 1 of 2 · 7:40 by Megan" stops anyone double-feeding. */
export function DailyTaps() {
  const { cat, care, account, household, pets } = useStore();
  /** `ids`: everything the last tap logged (one per cat once "All cats" is tapped), so Undo takes all of it back. */
  /** `catId`: the cat it was logged for, so "<other cat> too" and the toast still mean that cat after a switch. */
  /** `data`: what was saved, so "<other cat> too" logs the same playtime; `label`: the toast's words when not `DONE`. */
  const [undo, setUndo] = useState<{ ids: string[]; what: DailyWhat; catId: string; all?: boolean; data?: CareData['daily']; label?: string } | null>(null);
  const [busy, setBusy] = useState<DailyWhat | null>(null);
  /** After "Something's off": the symptom chips, likely ones preselected, so saving is one more tap (not the full form). */
  /** `checkId`: the "something was off" check it belongs to, so Undo after Save takes back the check and the symptoms. */
  const [off, setOff] = useState<{ chips: string[]; picked: string[]; checkId: string } | null>(null);
  // the symptom picker belongs to one cat: close it when the shown cat changes, so Save never logs to the wrong one
  useEffect(() => setOff(null), [cat?.id]);
  /** After tapping Played: how long and with what, the last playtime's preselected (Save is then one tap). */
  const [playing, setPlaying] = useState<{ minutes?: number; toy?: string } | null>(null);
  useEffect(() => setPlaying(null), [cat?.id]);
  /** The daily check's optional Water and Appetite chips, saved on the check. */
  const [notes, setNotes] = useState<{ water?: Water; appetite?: Appetite }>({});
  useEffect(() => setNotes({}), [cat?.id]);
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
  const log = async (what: DailyWhat, extra: Omit<CareData['daily'], 'what'> = {}, label?: string) => {
    if (busy) return null; setBusy(what);
    try {
      const data = { what, ...extra };
      const it = await store.saveCare('daily', data);
      if (it) { audio.chirp(); setUndo({ ids: [it.id], what, catId: it.catId, data, label }); if (what === 'fed') fedEvent([it.catId]); }
      return it;
    } finally { setBusy(null); }
  };
  // Played: ask how long and with what first (chips, last time's preselected), then log it
  const openPlay = () => { setUndo(null); setOff(null); setPlaying(lastPlay(care)); };
  const savePlay = async () => {
    if (!playing) return;
    const extra = { ...(playing.minutes ? { minutes: playing.minutes } : {}), ...(playing.toy ? { toy: playing.toy } : {}) };
    const it = await log('play', extra, ['Played', playText(extra)].filter(Boolean).join(' '));
    if (it) setPlaying(null);
  };
  const check = async (ok: boolean) => { const it = await log('check', { ok, ...notes }); if (it) setNotes({}); return it; };
  // "Something's off": log the check, then ask what (the toast waits until Save, so it never covers the chips)
  const somethingOff = async () => {
    const likely = likelySymptoms(care);
    const it = await check(false);
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
    for (const p of others) { const it = await store.saveCare('daily', undo.data ?? { what: undo.what }, { catId: p.id }); if (it) ids.push(it.id); }
    audio.chirp(); setUndo({ ...undo, ids: [...undo.ids, ...ids], all: true });
    if (undo.what === 'fed') fedEvent(others.map((p) => p.id));
  };
  const symptomToday = care.some((c) => c.kind === 'symptom' && !c.deleted && localDay(c.at) === localDay(Date.now()));
  const fed = today.fed, scoop = today.scoop, play = today.play, done = today.check[0];
  const playMin = play.reduce((n, p) => n + (p.data.minutes ?? 0), 0);
  /** The check's water and appetite, for the one-line status once it's done ("Water: more · Appetite: picky"). */
  const doneNotes = done ? dailyDetail({ what: 'check', water: done.data.water, appetite: done.data.appetite }).replace(/^All normal( · )?/, '') : '';
  const tiles: { what: DailyWhat; label: string; icon: string; sub: string; done: boolean }[] = [
    { what: 'fed', label: 'Fed', icon: 'leaf', done: fed.length >= meals, sub: fed.length ? `${fed.length} of ${meals} · ${time(fed[0].at)}${who(fed[0]) === 'you' ? '' : ` by ${who(fed[0])}`}` : `0 of ${meals} today` },
    { what: 'scoop', label: 'Scooped', icon: 'box', done: scoop.length > 0, sub: scoop.length ? `${time(scoop[0].at)}${who(scoop[0]) === 'you' ? '' : ` by ${who(scoop[0])}`}` : 'Not yet today' },
    { what: 'play', label: 'Played', icon: 'yarn', done: play.length > 0, sub: play.length ? `${play.length}× today${playMin ? ` · ${playMin} min` : ''}` : 'Not yet today' },
  ];
  return <div className="card white">
    <div className="row"><b className="sp" style={{ fontSize: 'var(--fs-body)' }}>Quick log</b>
      <a href="#/week" className="s" style={{ color: 'var(--teal)', fontWeight: 700 }}>{[0, 1].includes(new Date().getDay()) ? `${cat.name}’s week is in` : 'This week'}</a></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--sp-2)', marginTop: 10 }}>
      {tiles.map((t) => <button key={t.what} className="chipbtn" disabled={busy === t.what} onClick={() => (t.done ? openEntries(t.what) : t.what === 'play' ? openPlay() : void log(t.what))}
        aria-label={`${t.label}. ${t.sub}${t.done ? '. Tap to see or fix today’s entries' : ''}`}
        style={{ height: 'auto', minHeight: 76, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 'var(--sp-2) var(--sp-1)', background: t.done ? 'var(--mint)' : 'var(--grey)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-1)' }}>{t.done ? <Icon name="check" size={18} /> : <Icon name={t.icon} size={18} />}<b style={{ fontSize: 15 }}>{t.label}</b></span>
        <span className="s" style={{ fontSize: 'var(--fs-label)', lineHeight: 1.2, textAlign: 'center' }}>{t.sub}</span>
      </button>)}
    </div>
    {Object.values(today).some((l) => l.length > 0) && <button className="s" onClick={() => openEntries('all')}
      style={{ marginTop: 6, minHeight: 44, width: '100%', border: 0, background: 'none', padding: 0, fontFamily: 'inherit', color: 'var(--teal)', fontWeight: 700, textAlign: 'left' }}>Logged by mistake? Fix today’s entries</button>}
    {entries && createPortal(<DailyLogSheet what={entries === 'all' ? undefined : entries} onClose={() => setEntries(null)}
      onAgain={entries === 'all' ? undefined : entries === 'play' ? openPlay : () => void log(entries)} />, document.body)}
    {playing && <div style={PANEL} role="group" aria-label="Playtime">
      <b style={PANEL_TITLE}>Playtime</b>
      <p className="s" style={{ marginTop: 2 }}>How long, and with what? Both optional.</p>
      <Choice label="How long" options={PLAY_MINUTES.map((m) => [m, `${m} min`] as [number, string])} value={playing.minutes} onPick={(minutes) => setPlaying({ ...playing, minutes })} />
      <span className="s" style={{ display: 'block', fontWeight: 800, marginTop: 'var(--sp-2)' }}>Toy</span>
      <div role="group" aria-label="Toy" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-2)', marginTop: 'var(--sp-1)' }}>{Object.entries(PLAY_TOYS).map(([id, name]) => { const on = playing.toy === id;
        return <button key={id} className={`chipbtn ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setPlaying({ ...playing, toy: on ? undefined : id })}>{name}</button>; })}</div>
      <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
        <button className="btn2" style={PANEL_BTN} onClick={() => setPlaying(null)}>Not now</button>
        <button className="btn" style={PANEL_SAVE} disabled={!!busy} onClick={() => void savePlay()}>Save</button>
      </div>
    </div>}
    {off ? <div style={PANEL}>
        <b style={PANEL_TITLE}>What’s off?</b>
        <p className="s" style={{ marginTop: 2 }}>{off.picked.length ? 'Picked from the last few days. Change it if it’s something else.' : 'Tap what you noticed.'}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'var(--sp-2)' }}>{off.chips.map((c) => { const on = off.picked.includes(c);
          return <button key={c} className={`chipbtn ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setOff({ ...off, picked: on ? off.picked.filter((x) => x !== c) : [...off.picked, c] })}>{c}</button>; })}</div>
        <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 10 }}>
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
      : done ? (done.data.ok === false && !symptomToday
        ? <button className="s row" onClick={() => reopen(done.id)} style={{ marginTop: 10, gap: 6, width: '100%', minHeight: 44, border: 0, background: 'none', padding: 0, textAlign: 'left', color: 'inherit', font: 'inherit' }}>
          <Icon name="check" size={16} /><span className="sp">Today’s check: something was off ({time(done.at)}).</span><b style={{ color: 'var(--teal)' }}>What was it?</b></button>
        : <p className="s row" style={{ marginTop: 10, gap: 6 }}><Icon name="check" size={16} />{done.data.ok === false ? `Today’s check: something was off (${time(done.at)}).` : `Today’s check: all normal (${time(done.at)}${who(done) === 'you' ? '' : `, ${who(done)}`}).`}{doneNotes && ` ${doneNotes}.`}</p>)
      : <div style={PANEL}>
        <b style={PANEL_TITLE}>Daily check</b>
        <p className="s" style={{ marginTop: 2 }}>Is {cat.name} eating, using the litter box and acting like {cat.sex === 'f' ? 'herself' : 'himself'}?</p>
        <Choice label="Water (optional)" options={Object.entries(WATER) as [Water, string][]} value={notes.water} onPick={(water) => setNotes({ ...notes, water })} />
        <Choice label="Appetite (optional)" options={Object.entries(APPETITE) as [Appetite, string][]} value={notes.appetite} onPick={(appetite) => setNotes({ ...notes, appetite })} />
        <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-3)' }}>
          <button className="btn2" style={PANEL_BTN} disabled={!!busy} onClick={() => void check(true)}>All normal</button>
          <button className="btn2" style={PANEL_BTN} disabled={!!busy} onClick={() => void somethingOff()}>Something’s off</button>
        </div>
      </div>}
    {undo && !off && createPortal(<div className="toast pop undo" role="status">
      <Paw color="var(--butter-strong)" size={18} /><span className="msg sp">{undo.label
        ? `Saved · ${undo.label}${undo.all ? ' for all cats' : pets.length > 1 && undoCat ? ` for ${undoCat.name}` : ''}`
        : undo.all ? `${DONE[undo.what]} for all cats` : pets.length > 1 && undoCat ? `${undoCat.name}: ${DONE[undo.what]}` : DONE[undo.what]}</span>
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
