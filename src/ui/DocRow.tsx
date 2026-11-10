import { store } from '../db/store';
import type { CareItem } from '../engine/care';
import { docDay } from '../engine/docs';
import { Icon } from './icons';

const fmtDay = (day: string) => { const d = new Date(day + 'T12:00:00'); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }); };

/** Open a stored document in a new tab. The tab opens straight from the tap (phones block pop-ups opened after a
    wait), then goes to a short-lived link. */
export async function openDoc(path: string) {
  const w = window.open('', '_blank');
  try { const url = await store.docUrl(path); if (w) w.location.href = url; else location.href = url; }
  catch { w?.close(); alert('Couldn’t open the document. Check your connection (documents need you signed in).'); }
}

/** One document: tap opens it straight away; "…" is for renaming, linking to a visit or deleting. */
export function DocRow({ doc, visit, onMore }: { doc: CareItem<'doc'>; visit?: CareItem<'vet'>; onMore: () => void }) {
  const sub = [fmtDay(docDay(doc)), visit ? visit.data.reason : '', doc.data.mime === 'application/pdf' ? 'PDF' : 'Photo'].filter(Boolean).join(' · ');
  return <div className="row docrow" style={{ gap: 6, alignItems: 'stretch' }}>
    <button className="item sp" style={{ margin: 0 }} onClick={() => void openDoc(doc.data.path)} aria-label={`Open ${doc.data.title}`}>
      <div className="ico grey"><Icon name="book" /></div>
      <div className="sp" style={{ minWidth: 0 }}><b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.data.title}</b><p className="s">{sub}</p></div>
    </button>
    <button className="iconbtn" style={{ alignSelf: 'center', background: 'var(--grey)', fontWeight: 900, letterSpacing: 1 }} aria-label={`More for ${doc.data.title}: rename, link to a visit or delete`} onClick={onMore}>…</button>
  </div>;
}
