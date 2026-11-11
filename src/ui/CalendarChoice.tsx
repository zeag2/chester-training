import { downloadIcs, googleCalendarUrl, type CalEvent } from '../lib/calendar';
import * as audio from '../lib/audio';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import { showToast } from './Toast';

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

/** "Add to which calendar?": Apple or Google, the last one used first and marked. With `change`, the visit was
    rescheduled or cancelled: Apple gets the .ics again (same UID, higher SEQUENCE, or STATUS:CANCELLED), which
    updates the event it added; a Google link can only add, so Google says what to do by hand. */
export function CalendarSheet({ event, onClose, change }: { event: CalEvent; onClose: () => void; change?: 'moved' | 'cancelled' }) {
  const last = lastCalendar();
  const order: Cal[] = last === 'google' ? ['google', 'apple'] : ['apple', 'google'];
  const pick = (c: Cal) => {
    audio.chirp(); onClose();
    if (change === 'cancelled' && c === 'google') { rememberCalendar(c); showToast({ msg: 'Delete it in Google Calendar too: a link can’t remove an event.' }); return; }
    addToCalendar(event, c);
    if (change === 'moved' && c === 'google') showToast({ msg: 'Added at the new time. Delete the old one in Google Calendar.' });
  };
  const title = change === 'cancelled' ? 'Remove it from your calendar?' : change === 'moved' ? 'Move it in your calendar?' : 'Add to which calendar?';
  return <Sheet label={title} onClose={onClose}>
    <div className="row"><b className="sp" style={{ fontSize: 18 }}>{title}</b><button className="iconbtn" aria-label="Close" onClick={onClose}><Icon name="close" /></button></div>
    {change && <p className="s" style={{ marginTop: 6 }}>Pick the calendar you added it to. Apple Calendar {change === 'cancelled' ? 'marks the event cancelled' : 'moves the event'}; Google needs you to {change === 'cancelled' ? 'delete it there' : 'delete the old one'}.</p>}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
      {order.map((c) => { const preferred = c === last;
        return <button key={c} className={preferred ? 'btn' : 'btn2'} style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...(preferred ? {} : { background: 'var(--grey)' }) }} onClick={() => pick(c)}>
          <Icon name="cal" size={18} />{CAL_NAME[c]}{preferred && <span style={{ fontWeight: 600, opacity: 0.75 }}> · last used</span>}</button>; })}
      {change && <button className="btn2" style={{ width: '100%', background: 'transparent' }} onClick={onClose}>It’s not in a calendar</button>}
    </div>
    {!change && <p className="s" style={{ marginTop: 10 }}>PalDex remembers your choice on this phone.</p>}
  </Sheet>;
}
