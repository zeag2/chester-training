import { useEffect, useState } from 'react';
import { Icon } from './icons';
import { store, useStore } from '../db/store';
import { timeAgo } from '../lib/photos';
import type { Photo } from '../sync/remote';
import { sharingConfigured } from '../sync/config';
import { go } from './router';

// one fetch per few minutes, not one per visit to Home
let cache: { at: number; user: string; photo: Photo | null; url: string } | null = null;
const FRESH = 5 * 60_000;

/** Home: the newest photo a friend posted (navigation plan, Option A), linking to the feed on the Friends tab.
    Hidden without an account, before the photo SQL, or when friends haven't posted anything. */
export function NewestPhoto() {
  const { account, friends } = useStore();
  const user = account?.userId ?? '';
  const [got, setGot] = useState(cache && cache.user === user ? cache : null);
  useEffect(() => {
    if (!user || !sharingConfigured() || (cache && cache.user === user && Date.now() - cache.at < FRESH)) return;
    let live = true;
    store.photoFeed().then(({ photos, urls }) => {
      const photo = photos.find((p) => p.by !== user) ?? null;
      cache = { at: Date.now(), user, photo, url: photo ? urls[photo.path] ?? '' : '' };
      if (live) setGot(cache);
    }).catch(() => {});
    return () => { live = false; };
  }, [user]);
  const p = got?.photo;
  if (!user || !p || !got?.url) return null;
  const pet = friends?.pets.find((x) => x.catId === p.catId)?.card.name ?? 'A friend’s cat';
  const who = friends?.list.find((f) => f.userId === p.by)?.name;
  return <button className="card white" data-home="photo" style={{ width: '100%', border: 0, padding: 0, overflow: 'hidden', textAlign: 'left', color: 'inherit', display: 'block' }}
    onClick={() => go('friends')} aria-label={`New photo of ${pet}. See all photos`}>
    <img src={got.url} alt={p.caption || `Photo of ${pet}`} style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', background: 'var(--grey)' }} />
    <div className="row" style={{ padding: '10px 14px' }}><div className="sp"><b>{pet}</b><p className="s">{[who, timeAgo(p.at), p.caption].filter(Boolean).join(' · ')}</p></div><span className="s row" style={{ fontWeight: 800, gap: 2, color: 'var(--ink)' }}>See all<Icon name="chevron" size={16} /></span></div>
  </button>;
}
