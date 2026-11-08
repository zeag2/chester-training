import { useEffect, useMemo, useRef, useState } from 'react';
import { store, useStore } from '../db/store';
import { dailyToday, MEALS_PER_DAY, type CareItem, type DailyWhat } from '../engine/care';
import { Icon, Paw } from './icons';
import { go } from './router';
import * as audio from '../lib/audio';

const time = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const DONE: Record<DailyWhat, string> = { fed: 'Fed', scoop: 'Litter scooped', play: 'Playtime logged', check: 'Daily check saved' };

/** Home: one tap each for the everyday things (Fed, Scooped, Played) and a two-tap daily health check, with Undo
    instead of forms. Shared with the household, so "Fed 1 of 2 · 7:40 by Megan" stops anyone double-feeding. */
export function DailyTaps() {
  const { cat, care, account, household } = useStore();
  const [undo, setUndo] = useState<{ id: string; what: DailyWhat } | null>(null);
  const [busy, setBusy] = useState<DailyWhat | null>(null);
  useEffect(() => { if (!undo) return; const t = window.setTimeout(() => setUndo(null), 5000); return () => window.clearTimeout(t); }, [undo]);
  const today = useMemo(() => dailyToday(care), [care]);
  if (!cat) return null;
  const who = (i?: CareItem) => (!i ? '' : !i.by || i.by === account?.userId ? 'you' : household?.members.find((m) => m.userId === i.by)?.name || 'someone');
  const meals = cat.mealsPerDay ?? MEALS_PER_DAY;
  const log = async (what: DailyWhat, extra: { ok?: boolean } = {}) => {
    if (busy) return; setBusy(what);
    try { const it = await store.saveCare('daily', { what, ...extra }); if (it) { audio.chirp(); setUndo({ id: it.id, what }); } }
    finally { setBusy(null); }
  };
  const fed = today.fed, scoop = today.scoop, play = today.play, check = today.check[0];
  const tiles: { what: DailyWhat; label: string; icon: string; sub: string; done: boolean }[] = [
    { what: 'fed', label: 'Fed', icon: 'leaf', done: fed.length >= meals, sub: fed.length ? `${fed.length} of ${meals} · ${time(fed[0].at)}${who(fed[0]) === 'you' ? '' : ` by ${who(fed[0])}`}` : `0 of ${meals} today` },
    { what: 'scoop', label: 'Scooped', icon: 'box', done: scoop.length > 0, sub: scoop.length ? `${time(scoop[0].at)}${who(scoop[0]) === 'you' ? '' : ` by ${who(scoop[0])}`}` : 'Not yet today' },
    { what: 'play', label: 'Played', icon: 'yarn', done: play.length > 0, sub: play.length ? `${play.length}× today` : 'Not yet today' },
  ];
  return <div className="card white" style={{ border: '1px solid var(--grey)' }}>
    <div className="row"><b className="sp" style={{ fontSize: 16 }}>Quick log</b><span className="s">One tap, logged now</span></div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 10 }}>
      {tiles.map((t) => <button key={t.what} className="chipbtn" disabled={busy === t.what} onClick={() => void log(t.what)}
        aria-label={`${t.label}. ${t.sub}`}
        style={{ height: 'auto', minHeight: 76, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '8px 4px', background: t.done ? 'var(--mint)' : 'var(--grey)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{t.done ? <Icon name="check" size={18} /> : <Icon name={t.icon} size={18} />}<b style={{ fontSize: 15 }}>{t.label}</b></span>
        <span className="s" style={{ fontSize: 12, lineHeight: 1.2, textAlign: 'center' }}>{t.sub}</span>
      </button>)}
    </div>
    {check ? <p className="s row" style={{ marginTop: 10, gap: 6 }}><Icon name="check" size={16} />{check.data.ok === false ? `Today’s check: something was off (${time(check.at)}).` : `Today’s check: all normal (${time(check.at)}${who(check) === 'you' ? '' : `, ${who(check)}`}).`}</p>
      : <div style={{ marginTop: 12, padding: 12, borderRadius: 16, background: 'var(--sky)' }}>
        <b style={{ fontSize: 15 }}>Daily check</b>
        <p className="s" style={{ marginTop: 2 }}>Is {cat.name} eating, using the litter box and acting like {cat.sex === 'f' ? 'herself' : 'himself'}?</p>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <button className="btn2" style={{ flex: 1, background: 'var(--surface)' }} disabled={!!busy} onClick={() => void log('check', { ok: true })}>All normal</button>
          <button className="btn2" style={{ flex: 1, background: 'var(--surface)' }} disabled={!!busy} onClick={async () => { await log('check', { ok: false }); go('health/log/symptom'); }}>Something’s off</button>
        </div>
      </div>}
    {undo && <div className="row pop" role="status" style={{ marginTop: 10, padding: '6px 6px 6px 12px', borderRadius: 14, background: 'var(--butter)' }}>
      <Paw color="#d4a23a" size={18} /><span className="sp" style={{ color: 'var(--butter-ink)', fontWeight: 700, fontSize: 14 }}>{DONE[undo.what]} · {time(Date.now())}</span>
      {undo.what === 'scoop' && <button className="btn2" style={{ minHeight: 40, background: 'var(--surface)' }} onClick={async () => { await store.saveCare('symptom', { what: 'Litter box change' }); setUndo(null); go('health'); }}>Looked off?</button>}
      <button className="btn2" style={{ minHeight: 40, background: 'var(--surface)' }} onClick={() => { void store.deleteCare(undo.id); setUndo(null); }}>Undo</button>
    </div>}
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
