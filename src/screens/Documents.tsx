import { useMemo, useState } from 'react';
import { useStore } from '../db/store';
import { DOC_FILTERS, findDocs, visitOfDoc, type DocFilter } from '../engine/docs';
import { Icon } from '../ui/icons';
import { back as goBack, go } from '../ui/router';
import { DocRow } from '../ui/DocRow';
import { CareSheet, DocAdder, type Editing } from './Care';

/* All documents (`#/health/docs`, step 4 of docs/plans/2026-11-09-vet-redesign.md): search (title, the reader's
   summary, the visit it came from), filters, newest first. Tap opens the document; "…" renames, links or deletes. */
export function Documents() {
  const { cat, care, account } = useStore();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<DocFilter>('all');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const all = useMemo(() => findDocs(care), [care]);
  const list = useMemo(() => findDocs(care, q, filter), [care, q, filter]);
  if (!cat) return null;
  return <div className="screen">
    <div className="top"><button className="iconbtn" aria-label="Back" onClick={() => goBack('health')}><Icon name="back" /></button>
      <b className="sp" style={{ fontSize: 17 }}>{cat.name}’s documents</b>
      <button className="iconbtn" style={{ background: adding ? 'var(--ink)' : 'var(--grey)', color: adding ? 'var(--bg)' : undefined }} aria-label="Add a document" aria-pressed={adding} onClick={() => setAdding(!adding)}><Icon name="plus" /></button></div>
    {(adding || all.length === 0) && <DocAdder signedIn={!!account} />}
    {all.length > 0 && <>
      <div className="row" style={{ gap: 8, marginTop: 12, background: 'var(--grey)', borderRadius: 14, padding: '0 12px' }}>
        <Icon name="search" size={18} />
        <input className="in sp" type="search" style={{ background: 'transparent', margin: 0, border: 0, paddingLeft: 0 }} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search documents" aria-label="Search documents" enterKeyHint="search" />
      </div>
      <div className="row chiprow" role="group" aria-label="Show" style={{ gap: 6, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
        {DOC_FILTERS.map(([f, label]) => <button key={f} className={`chipbtn ${filter === f ? 'on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>{label}</button>)}
      </div>
      <p className="s" style={{ marginTop: 12, fontWeight: 800 }}>{q || filter !== 'all' ? `${list.length} of ${all.length}` : 'Newest first'}</p>
      {list.map((d) => <DocRow key={d.id} doc={d} visit={visitOfDoc(care, d)} onMore={() => setEditing({ kind: 'doc', item: d })} />)}
      {list.length === 0 && <p className="s" style={{ marginTop: 8 }}>No documents match. Try another word, or All.</p>}
    </>}
    {editing && <CareSheet key={editing.item?.id ?? editing.kind} editing={editing} onClose={() => setEditing(null)} />}
  </div>;
}
