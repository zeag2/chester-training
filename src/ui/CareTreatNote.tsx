import { useEffect } from 'react';
import { store, useStore } from '../db/store';
import { Paw } from './icons';
import { useToast } from './Toast';

const WHY = { entry: 'for logging', weighIn: 'for this week’s weigh-in', medOnTime: 'for a dose on time', vetVisit: 'for the vet visit', streak: 'for a whole week of care' };

/** "+7 treats for this week's weigh-in": a short note after a care entry earns treats. Goes away by itself. */
export function CareTreatNote() {
  const { careNews, cat } = useStore();
  // a booking's "Booked … · Undo" toast sits where this note goes: stand above it instead of covering Undo
  const toast = useToast();
  useEffect(() => { if (!careNews) return; const t = window.setTimeout(() => store.dismissCareNews(), 4000); return () => window.clearTimeout(t); }, [careNews]);
  if (!careNews || !cat) return null;
  return <div key={careNews.at} className="card butter row pop" role="status" onClick={() => store.dismissCareNews()}
    style={{ position: 'fixed', left: 16, right: 16, bottom: toast ? 'calc(168px + env(safe-area-inset-bottom))' : 'calc(96px + env(safe-area-inset-bottom))', zIndex: 30, margin: 0, maxWidth: 480, marginInline: 'auto', boxShadow: '0 6px 24px rgba(0,0,0,.15)' }}>
    <Paw color="#d4a23a" size={22} />
    <p className="sp" style={{ color: 'var(--butter-ink)', fontWeight: 700 }}>+{careNews.treats} treats for {cat.name} {WHY[careNews.why]}</p>
  </div>;
}
