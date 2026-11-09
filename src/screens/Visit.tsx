import { useEffect, useState } from 'react';
import { Chester } from '../chester/Chester';
import type { ReactionId } from '../chester/reactions';
import { store, useStore } from '../db/store';
import { bondLevel } from '../engine/corner';
import { SKILL_BY_ID } from '../engine/skills';
import { ageText } from '../lib/stats';
import * as audio from '../lib/audio';
import { Icon, Paw } from '../ui/icons';

const back = () => { if (history.length > 1) history.back(); else location.hash = '#/home'; };

/** Visiting a friend's cat: big and pettable, with the same reactions, and a free treat once a day. */
export function Visit({ catId }: { catId: string }) {
  const { account, friends } = useStore();
  const [loading, setLoading] = useState(!friends);
  const [line, setLine] = useState('');
  const [busy, setBusy] = useState(false);
  const [react, setReact] = useState<{ id: ReactionId; n: number } | null>(null);
  useEffect(() => { if (account) store.loadFriends().catch(() => {}).finally(() => setLoading(false)); else setLoading(false); }, [account]);
  const pet = friends?.pets.find((p) => p.catId === catId);
  const top = <div className="top"><button className="iconbtn" aria-label="Back" onClick={back}><Icon name="back" /></button>
    <b className="sp" style={{ fontSize: 17 }}>{pet ? `Visiting ${pet.card.name}` : 'Visit'}</b></div>;
  if (!pet) return <div className="screen">{top}
    {loading ? <p className="s" style={{ marginTop: 16 }} aria-busy="true">Loading…</p>
      : <div className="card grey"><b>This cat isn’t on your friends list</b><p className="s" style={{ marginTop: 4 }}>Friends’ cats show up once you’ve swapped friend codes.</p>
        <button className="btn" style={{ marginTop: 12 }} onClick={() => { location.hash = '#/friends'; }}>Friends</button></div>}
  </div>;

  const c = pet.card; const he = c.sex === 'f' ? 'she' : 'he'; const him = c.sex === 'f' ? 'her' : 'him';
  const mastered = c.mastered ?? [];
  const given = !!friends?.given?.includes(catId); const off = friends?.treats === 'missing';
  const give = async () => {
    if (busy || given || off) return; setBusy(true);
    const r = await store.giveTreat(catId); setBusy(false);
    if (r === 'given') { audio.sparkle(); setReact({ id: 'r6', n: (react?.n ?? 0) + 1 }); setLine(`Nom nom! Thank you!`); }
    else if (r === 'already') setLine(`${c.name} already had a treat from you today.`);
    else if (r === 'missing') setLine('');
    else setLine('Can’t reach PalDex right now. Try again in a moment.');
  };
  return <div className="screen">{top}
    <div className="stag">
      <p className="m">{pet.ownerName ? `${pet.ownerName}’s cat` : 'A friend’s cat'}{c.birthday ? ` · ${ageText(c.birthday)}` : ''}</p>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 8 }}>
        <div style={{ minHeight: 44 }}><span key={line + (react?.n ?? 0)} className="bubble mint">{line || `Hi! I’m ${c.name}. Pet me!`}</span></div>
        <div style={{ marginTop: -36 }}><Chester coat={c.coat} eyes={c.eyes} wear={c.wear} mood="happy" width={200} interactive label={c.name}
          onPet={(l) => setLine(l)} react={react?.id ?? null} reactKey={react?.n ?? 0} /></div>
      </div>
      <div className="card butter" style={{ textAlign: 'center' }}>
        {off ? <><b style={{ color: 'var(--butter-ink)' }}>Treats aren’t switched on yet</b>
            <p className="s" style={{ color: 'var(--butter-ink)', marginTop: 4 }}>Whoever runs this PalDex needs to run its treats setup once. You can still pet {him}.</p></>
          : <><b style={{ color: 'var(--butter-ink)' }}>{given ? `You gave ${c.name} a treat today` : `Give ${c.name} a treat`}</b>
            <p className="s" style={{ color: 'var(--butter-ink)', marginTop: 4 }}>{given ? 'Come back tomorrow for another.' : `One free treat a day. It goes into ${him === 'her' ? 'her' : 'his'} corner, to spend on outfits and toys.`}</p>
            <button className="btn" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} disabled={busy || given} onClick={give}>
              <Paw color="currentColor" size={20} />{busy ? 'Giving…' : given ? 'Given today' : 'Give a treat'}</button></>}
      </div>
      <div className="card white" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="chip" style={{ background: 'var(--mint)' }}>{mastered.length} {mastered.length === 1 ? 'skill' : 'skills'}</span>
          {(c.streak ?? 0) > 0 && <span className="chip" style={{ background: 'var(--butter)', color: 'var(--butter-ink)' }}>{c.streak}-day streak</span>}
          {(c.setsWeek ?? 0) > 0 && <span className="chip" style={{ background: 'var(--grey)' }}>{c.setsWeek} sets this week</span>}
        </div>
        <p className="s" style={{ lineHeight: 1.35 }}>{mastered.length ? `${he[0].toUpperCase() + he.slice(1)} can: ${mastered.slice(0, 4).map((id) => SKILL_BY_ID[id]?.name ?? id).join(', ')}${mastered.length > 4 ? '…' : ''}` : 'Just getting started'}</p>
        <p className="s">Bond with {pet.ownerName || 'their person'}: {bondLevel(c.bond ?? 0).name}</p>
      </div>
    </div>
  </div>;
}
