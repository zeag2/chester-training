import { downloadIcs, googleCalendarUrl, type CalEvent } from '../lib/calendar';
import * as audio from '../lib/audio';
import { Icon } from './icons';
import { Sheet } from './Sheet';

/* Which calendar to add a visit to: always asked (Apple Calendar or Google Calendar), with the phone's last choice
   preselected. Apple = the .ics file (iPhone and Mac open it in Calendar); Google = a calendar.google.com link. */

export type Cal = 'apple' | 'google';
/** What the booking sheet remembers: a calendar, or "don't add". */
export type CalChoice = Cal | 'none';
const CAL_KEY = 'paldex-calendar';

export function lastCalendar(): CalChoice | null {
  try { const v = localStorage.getItem(CAL_KEY); return v === 'apple' || v === 'google' || v === 'none' ? v : null; } catch { return null; }
}
export function rememberCalendar(c: CalChoice) { try { localStorage.setItem(CAL_KEY, c); } catch { /* private mode */ } }

export const CAL_NAME: Record<Cal, string> = { apple: 'Apple Calendar', google: 'Google Calendar' };

/** Add the event to the chosen calendar. Google opens in a new tab, so call this straight from the tap
    (or pass a tab opened during the tap). */
export function addToCalendar(ev: CalEvent, cal: Cal, tab?: Window | null) {
  rememberCalendar(cal);
  if (cal === 'google') { const url = googleCalendarUrl(ev); if (tab) tab.location.href = url; else window.open(url, '_blank'); }
  else downloadIcs(ev);
}

/** "Add to which calendar?": Apple or Google, the last one used first and marked. */
export function CalendarSheet({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const last = lastCalendar();
  const order: Cal[] = last === 'google' ? ['google', 'apple'] : ['apple', 'google'];
  const pick = (c: Cal) => { audio.chirp(); addToCalendar(event, c); onClose(); };
  return <Sheet label="Add to which calendar?" onClose={onClose}>
    <div className="row"><b className="sp" style={{ fontSize: 18 }}>Add to which calendar?</b><button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
      {order.map((c) => { const preferred = c === last;
        return <button key={c} className={preferred ? 'btn' : 'btn2'} style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...(preferred ? {} : { background: 'var(--grey)' }) }} onClick={() => pick(c)}>
          <Icon name="cal" size={18} />{CAL_NAME[c]}{preferred && <span style={{ fontWeight: 600, opacity: 0.75 }}> · last used</span>}</button>; })}
    </div>
    <p className="s" style={{ marginTop: 10 }}>PalDex remembers your choice on this phone.</p>
  </Sheet>;
}
