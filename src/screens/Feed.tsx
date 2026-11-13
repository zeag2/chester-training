import { useEffect, useRef, useState } from 'react';
import { store, useStore } from '../db/store';
import { timeAgo } from '../lib/photos';
import type { Photo } from '../sync/remote';
import { sharingConfigured } from '../sync/config';
import { go } from '../ui/router';
import * as audio from '../lib/audio';
import { ErrLine, Top, errText, useRun } from './Together';

const PAGE = 20;
/** The photo's shape, but no taller than 4:5, so a caption is always in view. */
const ratio = (p: Photo) => (p.width && p.height ? `${Math.max(p.width / p.height, 0.8)}` : '4 / 3');

/** #/feed: photos of your cats and your friends' cats, newest first. Post one with a caption. */
export function Feed() {
  const snap = useStore();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [more, setMore] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const signedIn = !!snap.account && sharingConfigured();

  const load = async (before?: string) => {
    try {
      const page = await store.photoFeed(before);
      setPhotos((old) => (before ? [...old, ...page.photos] : page.photos));
      setUrls((old) => ({ ...old, ...page.urls }));
      setMore(page.photos.length >= PAGE); setState('ready'); setLoadErr('');
    } catch (e) { setLoadErr(errText(e)); setState((s) => (s === 'ready' ? s : 'error')); }
  };
  useEffect(() => {
    if (!signedIn) return;
    if (!snap.friends) void store.loadFriends();
    void load();
  }, [signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // names: my pets and friends' pets; me, my household and my friends
  const petName = (id: string) => snap.pets.find((p) => p.id === id)?.name ?? snap.friends?.pets.find((p) => p.catId === id)?.card.name ?? 'A cat';
  const person = (id: string) => (id === snap.account?.userId ? 'You'
    : snap.household?.members.find((m) => m.userId === id)?.name || snap.friends?.list.find((f) => f.userId === id)?.name || 'A friend');

  return <div className="screen">
    <Top onBack={() => go('me')} title="Photos" />
    {!signedIn ? <>
      <h1 style={{ marginTop: 6 }}>Photos with friends</h1>
      <p className="m" style={{ marginTop: 6 }}>Sign in to post photos of your cats and see your friends’ cats.</p>
      {sharingConfigured() && <button className="btn" style={{ marginTop: 20 }} onClick={() => go('together')}>Sign in</button>}
    </> : <>
      {snap.pets.length > 0 && <Composer onPosted={() => void load()} />}
      {state === 'loading' && <p className="m" aria-busy="true" style={{ marginTop: 20 }}>Loading photos…</p>}
      {state === 'error' && <><ErrLine err={loadErr} /><button className="btn2" style={{ marginTop: 10, width: '100%' }} onClick={() => { setState('loading'); void load(); }}>Try again</button></>}
      {state === 'ready' && !photos.length && <p className="m" style={{ marginTop: 20, textAlign: 'center' }}>No photos yet. Post {snap.pets[0]?.name ?? 'your cat'}’s first one!</p>}
      {photos.map((p) => <article key={p.id} className="card white" style={{ padding: 0, overflow: 'hidden' }} aria-label={`${petName(p.catId)}, posted by ${person(p.by)}`}>
        {urls[p.path]
          ? <img src={urls[p.path]} alt={p.caption || `Photo of ${petName(p.catId)}`} loading="lazy" decoding="async" width={p.width} height={p.height}
              style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: ratio(p), objectFit: 'cover', background: 'var(--grey)' }} />
          : <div style={{ aspectRatio: '4 / 3', background: 'var(--grey)' }} />}
        <div style={{ padding: '12px 16px 14px' }}>
          <div className="row" style={{ gap: 6 }}><b style={{ fontSize: 16 }}>{petName(p.catId)}</b><span className="s sp">· {person(p.by)}</span><span className="s">{timeAgo(p.at)}</span></div>
          {p.caption && <p style={{ marginTop: 4, fontSize: 15, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{p.caption}</p>}
        </div>
      </article>)}
      {state === 'ready' && loadErr && <ErrLine err={loadErr} />}
      {more && <button className="btn2" style={{ marginTop: 14, width: '100%' }} onClick={() => void load(photos[photos.length - 1]?.at)}>Show older photos</button>}
    </>}
  </div>;
}

/** Pick a photo (camera or library), add a caption, post it for one of my cats. */
function Composer({ onPosted }: { onPosted: () => void }) {
  const snap = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [caption, setCaption] = useState('');
  const [catId, setCatId] = useState(snap.cat?.id ?? snap.pets[0]?.id ?? '');
  const { busy, err, setErr, run } = useRun();
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const pick = (f: File | undefined) => { if (!f) return; setErr(''); setFile(f); setPreview(URL.createObjectURL(f)); };
  const reset = () => { setFile(null); setPreview(''); setCaption(''); if (input.current) input.current.value = ''; };
  const name = snap.pets.find((p) => p.id === catId)?.name ?? 'your cat';

  return <div className="card mint" style={{ marginTop: 6 }}>
    <input ref={input} type="file" accept="image/*" hidden aria-hidden="true" onChange={(e) => pick(e.target.files?.[0])} />
    {!file ? <>
      <b style={{ fontSize: 16 }}>Share a photo</b>
      <p className="s" style={{ marginTop: 2 }}>Your household and your friends see it.</p>
      <button className="btn" style={{ marginTop: 12 }} onClick={() => input.current?.click()}>Add a photo</button>
    </> : <>
      {preview && <img src={preview} alt="The photo you picked" style={{ display: 'block', width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 16, background: 'var(--grey)' }} />}
      {snap.pets.length > 1 && <div className="row chiprow" role="group" aria-label="Which cat" style={{ gap: 6, marginTop: 12, overflowX: 'auto' }}>
        {snap.pets.map((p) => <button key={p.id} className={'chipbtn' + (p.id === catId ? ' on' : '')} aria-pressed={p.id === catId} onClick={() => setCatId(p.id)}>{p.name}</button>)}
      </div>}
      <label className="field" htmlFor="ph-cap">Caption <span className="s">(optional)</span></label>
      <input id="ph-cap" className="in" maxLength={140} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={`What’s ${name} up to?`} enterKeyHint="send" />
      <button className="btn" style={{ marginTop: 14 }} disabled={busy || !catId}
        onClick={() => run(async () => { await store.postPhoto(catId, file, caption); audio.sparkle(); reset(); onPosted(); })}>{busy ? 'Posting…' : `Post ${name}’s photo`}</button>
      <button className="btn2" style={{ marginTop: 10, width: '100%' }} disabled={busy} onClick={() => { reset(); setErr(''); }}>Cancel</button>
    </>}
    <ErrLine err={err} />
  </div>;
}
