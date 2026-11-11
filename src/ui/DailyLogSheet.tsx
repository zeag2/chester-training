import { useState } from 'react';
import { store, useStore } from '../db/store';
import { localDay } from '../engine/day';
import type { CareItem, DailyWhat } from '../engine/care';
import { atTimeOfDay, dailyLogDays, hhmm } from '../engine/dailylog';
import { Icon } from './icons';
import * as audio from '../lib/audio';
import { Sheet } from './Sheet';

const time = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const LABEL: Record<DailyWhat, string> = { fed: 'Fed', scoop: 'Scooped', play: 'Played', check: 'Daily check' };
const ICON: Record<DailyWhat, string> = { fed: 'leaf', scoop: 'box', play: 'yarn', check: 'check' };
const AGAIN: Record<DailyWhat, string> = { fed: 'Log another meal', scoop: 'Scooped again', play: 'Played again', check: 'Check again' };
const THIS: Record<DailyWhat, string> = { fed: 'this meal', scoop: 'this scoop', play: 'this playtime', check: 'this check' };
const label = (i: CareItem<'daily'>) => i.data.what !== 'check' ? LABEL[i.data.what] : i.data.ok === false ? 'Something off' : 'All normal';
/** For screen readers and tests: "fed at 7:40 AM", "daily check at 8:20 AM". */
const named = (i: CareItem<'daily'>) => `${LABEL[i.data.what].toLowerCase()} at ${time(i.at)}`;
function dayName(day: string, now: number): string {
  if (day === localDay(now)) return 'Today';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (day === localDay(y.getTime())) return 'Yesterday';
  return new Date(day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

/** The quick logs (Fed, Scooped, Played, daily check) for the cat shown, with a time to change and a Delete on each,
    so a mistaken tap can be fixed after the Undo toast is gone. Deletes and edits go through the same store calls as
    Undo and the log forms (soft delete, synced). `what`: one kind only (from its tile on Home); `days`: how far back
    (1 = today, from Home; 7 from Health); `onAgain`: offer "Log another meal" etc. */
export function DailyLogSheet({ what, days = 1, onAgain, onClose }: { what?: DailyWhat; days?: number; onAgain?: () => void; onClose: () => void }) {
  const { cat, care, account, household } = useStore();
  const [asking, setAsking] = useState<string | null>(null);
  if (!cat) return null;
  const now = Date.now();
  const groups = dailyLogDays(care, days, now, what);
  const who = (i: CareItem) => (!i.by || i.by === account?.userId ? '' : household?.members.find((m) => m.userId === i.by)?.name || 'someone');
  const title = what ? `${LABEL[what]}${days === 1 ? ' today' : ''}` : days === 1 ? 'Today’s quick logs' : 'Quick logs';
  const setTime = (i: CareItem<'daily'>, v: string) => {
    const at = atTimeOfDay(i.at, v); if (at === null || at === i.at) return;
    void store.saveCare('daily', i.data, { id: i.id, at, catId: i.catId });
  };
  const remove = async (i: CareItem<'daily'>) => { setAsking(null); audio.chirp(); await store.deleteCare(i.id); };

  return <Sheet label={`${cat.name}: ${title}`} onClose={onClose}>
      <div className="row"><b className="sp" style={{ fontSize: 18 }}>{cat.name}: {title}</b>
        <button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
      <p className="s" style={{ marginTop: 2 }}>Logged by mistake? Delete it, or change its time. Shared with your household.</p>
      {groups.length === 0 && <p className="s" style={{ marginTop: 14 }}>Nothing logged {days === 1 ? 'today' : `in the last ${days} days`}.</p>}
      {groups.map((g) => <div key={g.day} style={{ marginTop: 12 }}>
        {(days > 1) && <p className="s" style={{ fontWeight: 800 }}>{dayName(g.day, now)}</p>}
        {g.items.map((i) => <div key={i.id} className="row" style={{ gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)', minHeight: 56 }}>
          {asking === i.id
            ? <><span className="sp" style={{ fontWeight: 700 }}>Delete {THIS[i.data.what]} <span style={{ whiteSpace: 'nowrap' }}>({time(i.at)})?</span></span>
              <button className="btn2" style={{ padding: '0 12px', background: 'var(--grey)' }} onClick={() => setAsking(null)}>Keep</button>
              <button className="btn2" style={{ padding: '0 12px', background: 'var(--rose)', color: 'var(--bg)' }} onClick={() => void remove(i)}>Delete</button></>
            : <><div className="ico grey"><Icon name={ICON[i.data.what]} /></div>
              <div className="sp" style={{ minWidth: 0 }}><b>{label(i)}</b>{who(i) && <p className="s">by {who(i)}</p>}</div>
              <input type="time" className="in" aria-label={`Change the time of ${named(i)}`} defaultValue={hhmm(i.at)} key={i.at}
                style={{ width: 'auto', flex: 'none', height: 44, marginTop: 0, padding: '0 8px' }} onChange={(e) => setTime(i, e.target.value)} />
              <button className="iconbtn" style={{ color: 'var(--rose)' }} aria-label={`Delete ${named(i)}`} onClick={() => setAsking(i.id)}><TrashIcon /></button></>}
        </div>)}
      </div>)}
      {what && onAgain && <button className="btn" style={{ marginTop: 16 }} onClick={() => { onAgain(); onClose(); }}>{AGAIN[what]}</button>}
    </Sheet>;
}

function TrashIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>;
}
