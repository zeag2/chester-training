import { useEffect } from 'react';
import { Chester } from '../chester/Chester';
import { store, useStore } from '../db/store';
import { Icon, Paw } from './icons';
import { go } from './router';
import * as audio from '../lib/audio';
import { pendingFriend } from '../lib/invite';
import { FRIEND_BONUS } from '../engine/corner';

/** "Erin gave Chester a treat" / "Erin and Dana gave Chester treats". */
export function treatLine(cat: string, names: string[]): string {
  const who = names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return names.length === 1 ? `${who} gave ${cat} a treat` : `${who} gave ${cat} treats`;
}

/** Home's one friends card: friends' cats as little faces (tap one to visit), a paw on each that can still get
    today's treat, a line when a friend gave one of your cats a treat, and + to invite someone. */
export function FriendsStrip({ onInvite }: { onInvite: () => void }) {
  const { account, friends, treatNews, cat, thanks } = useStore();
  useEffect(() => { if (account && !friends) store.loadFriends().catch(() => {}); }, [account, friends]);
  if (!account) return null;
  const pets = friends && !friends.missing ? friends.pets : [];
  const given = new Set(friends?.given ?? []);
  const canTreat = !!friends && friends.treats !== 'missing';
  return <div className="card sky" style={{ paddingBottom: 10 }}>
    {treatNews && <div className="row pop" role="status" style={{ marginBottom: 10 }}>
      <Paw color="#d4a23a" size={22} />
      <b className="sp" style={{ fontSize: 15 }}>{treatLine(treatNews.cat, treatNews.names)}</b>
      {treatNews.items?.length ? (treatNews.thanked ? <span className="s" style={{ fontWeight: 700 }}>Thanks sent</span>
        : <button className="btn2" style={{ minHeight: 40, background: 'var(--surface)' }} onClick={() => { audio.chirp(); void store.thankTreats(); }}>Say thanks</button>) : null}
      <button className="iconbtn" aria-label="Dismiss" onClick={() => store.dismissTreatNews()}><Icon name="close" size={18} /></button>
    </div>}
    {thanks.length > 0 && <div className="row pop" role="status" style={{ marginBottom: 10 }}>
      <Paw color="#d4a23a" size={22} />
      <b className="sp" style={{ fontSize: 15 }}>{[...new Set(thanks.map((t) => t.catName || 'A friend’s cat'))].join(' and ')} {thanks.length === 1 ? 'says' : 'say'} thank you for the treat!</b>
      <button className="iconbtn" aria-label="Dismiss" onClick={() => store.dismissThanks()}><Icon name="close" size={18} /></button>
    </div>}
    <div className="row" style={{ gap: 8 }}>
      <a href="#/friends" className="sp" style={{ color: 'inherit', textDecoration: 'none' }}><b>Friends’ cats</b>
        {!pets.length && <p className="s">{pendingFriend() ? 'A friend invited you. Tap to add them.' : `Each new friend: +${FRIEND_BONUS.treats} treats for ${cat?.name ?? 'your cat'}.`}</p>}</a>
      {pets.length > 0 && <a href="#/friends" className="s" style={{ color: 'inherit', fontWeight: 700 }}>See all</a>}
      <button className="plusbtn" aria-label="Invite a friend" onClick={onInvite}><Icon name="plus" size={22} /></button></div>
    {pets.length > 0 && <>
      <div className="petswitch" role="group" aria-label="Friends’ cats" style={{ marginTop: 6 }}>
        {pets.map((p) => { const fresh = canTreat && !given.has(p.catId); return <button key={p.catId} onClick={() => { audio.chirp(); go('visit/' + p.catId); }}
          aria-label={`Visit ${p.card.name}${p.ownerName ? `, ${p.ownerName}’s cat` : ''}${fresh ? '. Can have a treat today' : ''}`} style={{ position: 'relative' }}>
          <span className="face" style={{ background: 'var(--surface)' }}><Chester coat={p.card.coat} eyes={p.card.eyes} wear={p.card.wear} mood="happy" width={40} label={p.card.name} /></span>
          {fresh && <span aria-hidden="true" style={{ position: 'absolute', top: -2, right: 2, width: 18, height: 18, borderRadius: 9, background: 'var(--butter)', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 2px var(--surface)' }}><Paw color="#d4a23a" size={12} /></span>}
          <span className="nm">{p.card.name}</span></button>; })}
      </div>
    </>}
  </div>;
}
