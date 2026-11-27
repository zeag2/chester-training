import { useEffect, useMemo, useState } from 'react';
import { store, useStore } from '../db/store';
import type { CareItem } from '../engine/care';
import { useLayout } from '../ui/layout';
import { DOC_FILTERS, findDocs, visitOfDoc, type DocFilter } from '../engine/docs';
import { Icon } from '../ui/icons';
import { ScreenHeader } from '../ui/ScreenHeader';
import { back as goBack, go } from '../ui/router';
import { DocRow, docSub, openDoc } from '../ui/DocRow';
import { CareSheet, DocAdder, type Editing } from './Care';
import { DropNote, useDocDrop, type Dropped } from '../ui/DocDrop';

/* All documents (`#/health/docs`, step 4 of docs/plans/2026-11-09-vet-redesign.md): search (title, the reader's
   summary, the visit it came from), filters, newest first. Tap opens the document; "…" renames, links or deletes.
   On desktop (desktop plan step 6) it's two panes: the list on the left, and the selected document's details and a
   preview (the PDF in an iframe, a photo as an image) on the right. */
export function Documents() {
  const { cat, care, account } = useStore();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<DocFilter>('all');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const all = useMemo(() => findDocs(care), [care]);
  const list = useMemo(() => findDocs(care, q, filter), [care, q, filter]);
  // drop a file anywhere here to add it (desktop plan step 5): opens the adder and reads it, as if picked
  const [dropped, setDropped] = useState<Dropped>();
  const drop = useDocDrop((d) => { setAdding(true); setDropped(d); });
  const big = useLayout() === 'desktop';
  const [selId, setSelId] = useState<string>();
  if (!cat) return null;
  const sel = big ? list.find((d) => d.id === selId) ?? list[0] : undefined;
  const rows = list.map((d) => <DocRow key={d.id} doc={d} visit={visitOfDoc(care, d)} onMore={() => setEditing({ kind: 'doc', item: d })}
    onSelect={big ? () => setSelId(d.id) : undefined} selected={sel?.id === d.id} />);
  return <div className={big ? 'screen wide' : 'screen'} {...drop.bind}>
    <ScreenHeader onBack={() => goBack('health')} title={`${cat.name}’s documents`}
      trailing={<button className="iconbtn" style={{ background: adding ? 'var(--ink)' : 'var(--grey)', color: adding ? 'var(--on-ink)' : undefined }} aria-label="Add a document" aria-pressed={adding} onClick={() => { setAdding(!adding); setDropped(undefined); }}><Icon name="plus" /></button>} />
    {(adding || all.length === 0) && <DocAdder signedIn={!!account} dropped={dropped} />}
    {all.length > 0 && <>
      <div className="row" style={{ gap: 'var(--sp-2)', marginTop: 'var(--sp-3)', background: 'var(--grey)', borderRadius: 'var(--r-row)', padding: '0 var(--sp-3)' }}>
        <Icon name="search" size={18} />
        <input className="in sp" type="search" style={{ background: 'transparent', margin: 0, border: 0, paddingLeft: 0 }} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search documents" aria-label="Search documents" enterKeyHint="search" />
      </div>
      <div className="row chiprow" role="group" aria-label="Show" style={{ gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
        {DOC_FILTERS.map(([f, label]) => <button key={f} className={`chipbtn ${filter === f ? 'on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>{label}</button>)}
      </div>
      <p className="s" style={{ marginTop: 'var(--sp-3)', fontWeight: 800 }}>{q || filter !== 'all' ? `${list.length} of ${all.length}` : 'Newest first'}</p>
      {big ? <div className="docpanes">
        <div className="doclist">{rows}{list.length === 0 && <p className="s" style={{ marginTop: 'var(--sp-2)' }}>No documents match. Try another word, or All.</p>}</div>
        {sel && <DocPreview key={sel.id} doc={sel} visit={visitOfDoc(care, sel)} onMore={() => setEditing({ kind: 'doc', item: sel })} />}
      </div> : <>
        {rows}
        {list.length === 0 && <p className="s" style={{ marginTop: 'var(--sp-2)' }}>No documents match. Try another word, or All.</p>}
      </>}
    </>}
    {drop.dragging && <DropNote />}
    {editing && <CareSheet key={editing.item?.id ?? editing.kind} editing={editing} onClose={() => setEditing(null)} />}
  </div>;
}

/** The right-hand pane on desktop: title, date · visit · type, the reader's summary, and the document itself. The
    link is short-lived and needs the account (documents are stored with it), so signed out it says so instead. */
function DocPreview({ doc, visit, onMore }: { doc: CareItem<'doc'>; visit?: CareItem<'vet'>; onMore: () => void }) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => store.docUrl(doc.data.path)).then((u) => { if (live) setUrl(u); }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [doc.data.path]);
  const pdf = doc.data.mime === 'application/pdf';
  return <section className="docpreview" aria-label={`Preview of ${doc.data.title}`}>
    <div className="row" style={{ gap: 'var(--sp-2)', alignItems: 'flex-start' }}>
      <div className="sp" style={{ minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: 19, overflowWrap: 'anywhere' }}>{doc.data.title}</h2>
        <p className="s" style={{ marginTop: 2 }}>{docSub(doc, visit)}</p>
      </div>
      <button className="btn2" style={{ width: 'auto', padding: '0 14px', minHeight: 40, flex: 'none' }} onClick={() => void openDoc(doc.data.path)}>Open in new tab</button>
      <button className="iconbtn" style={{ background: 'var(--grey)', fontWeight: 900, letterSpacing: 1, flex: 'none' }} aria-label={`More for ${doc.data.title}: rename, link to a visit or delete`} onClick={onMore}>…</button>
    </div>
    {doc.data.summary && <p className="docsum">{doc.data.summary}</p>}
    <div className="docview">
      {failed ? <p className="s">Can’t show it here. Documents need you signed in and online.</p>
        : !url ? <p className="s" aria-busy="true">Loading…</p>
        : pdf ? <iframe src={url} title={doc.data.title} />
        : <img src={url} alt={doc.data.title} />}
    </div>
  </section>;
}
