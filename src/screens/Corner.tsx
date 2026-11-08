import { useState } from 'react';
import { Chester } from '../chester/Chester';
import { store, useStore } from '../db/store';
import { BOND_LEVELS, bondGiftLevel, bondLevel, dailyGiftTreats, giftClaimed, ITEM_BY_ID, owned, playedToday, SHOP, type ShelfKind, type ShopItem } from '../engine/corner';
import { localDay } from '../engine/day';
import type { ReactionId } from '../chester/reactions';
import { Icon, Paw } from '../ui/icons';
import { go } from '../ui/router';
import * as audio from '../lib/audio';
import { usePetText } from '../lib/pet';

/** Cushions drawn under him in the corner. */
export function CushionArt({ id, width = 220 }: { id?: string; width?: number }) {
  const stroke = '#232320';
  const shape = id === 'heart'
    ? <g><path d="M110 70 C60 70 14 58 14 38 C14 18 44 12 66 22 C80 28 96 32 110 32 C124 32 140 28 154 22 C176 12 206 18 206 38 C206 58 160 70 110 70 Z" fill="#f4a9b6" stroke={stroke} strokeWidth="4" /><path d="M180 52 C172 44 170 36 177 34 C180 33 182 35 182 37 C182 35 184 33 187 34 C194 36 192 44 184 52 Z" fill="#e5484d" transform="translate(-4 -4)" /></g>
    : id === 'cloud'
      ? <g fill="#eef0fb" stroke={stroke} strokeWidth="4"><path d="M30 66 C6 66 6 36 30 36 C32 14 64 10 76 26 C88 8 128 8 140 26 C154 10 190 16 190 38 C214 40 214 66 190 66 Z" /><path d="M40 52 Q110 60 180 52" fill="none" stroke="#c9cdee" strokeWidth="3" strokeLinecap="round" /></g>
      : id === 'mint'
        ? <g><ellipse cx="110" cy="46" rx="98" ry="24" fill="#a9dcc9" stroke={stroke} strokeWidth="4" /><ellipse cx="110" cy="40" rx="70" ry="10" fill="#c9eadd" /></g>
        : <ellipse cx="110" cy="58" rx="90" ry="9" fill="rgba(29,35,64,.12)" />;
  return <svg viewBox="0 0 220 76" width={width} aria-hidden="true" style={{ display: 'block' }}>{shape}</svg>;
}

/** Toys from gifts are names like "a crinkle ball"; bought toys are shop ids. */
const toyName = (t: string) => ITEM_BY_ID[t]?.name ?? t.replace(/^an? /, '').replace(/^./, (c) => c.toUpperCase());
const TOY_MOVE: Record<string, [ReactionId, string]> = {
  box: ['r1', 'If I fits, I sits.'], laser: ['r14', 'Got it! …Where did it go?'], tunnel: ['r5', 'ZOOM. In. Out. Again!'],
  'a crinkle ball': ['r13', '*crinkle crinkle*'], 'a feather wand': ['r1', 'Mine! Mine!'], 'a toy mouse': ['r14', 'Caught one!'],
  'a catnip fish': ['r7', 'Oh wow. Oh WOW.'], 'a jingle ball': ['r2', '*jingle jingle*'],
};
const TOY_COLOR = ['#ef8f9a', '#efc44a', '#9fc0ea', '#a9dcc9', '#f0a07e'];

function ToyArt({ name, i }: { name: string; i: number }) {
  const c = TOY_COLOR[i % TOY_COLOR.length];
  const L = { stroke: 'var(--ink)', strokeWidth: 2.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  const art = name === 'box' ? <><path d="M8 18 H40 V40 H8 Z" fill="#d9b382" {...L} /><path d="M8 18 L2 10 M40 18 L46 10 M8 18 L14 8 M40 18 L34 8" {...L} fill="none" /></>
    : name === 'laser' ? <><circle cx="24" cy="26" r="9" fill="#e5484d" {...L} /><circle cx="24" cy="26" r="17" fill="none" stroke="#e5484d" strokeWidth="2" opacity=".4" /></>
    : name === 'tunnel' ? <><path d="M4 34 C4 14 44 14 44 34 Z" fill="#6c7bd0" {...L} /><ellipse cx="24" cy="34" rx="10" ry="8" fill="#232320" /></>
    : /mouse/.test(name) ? <><ellipse cx="22" cy="30" rx="14" ry="9" fill="#b8b8c4" {...L} /><circle cx="32" cy="22" r="5" fill="#b8b8c4" {...L} /><path d="M8 30 C2 30 2 40 10 40" fill="none" {...L} /></>
    : /fish/.test(name) ? <><path d="M6 26 C14 14 32 14 38 26 C32 38 14 38 6 26 Z M38 26 L46 18 V34 Z" fill="#a9dcc9" {...L} /><circle cx="14" cy="24" r="2" fill="#232320" /></>
    : /feather/.test(name) ? <><path d="M6 42 L30 14" {...L} fill="none" /><path d="M30 14 C26 4 40 0 42 6 C46 14 38 22 30 14 Z" fill="#ef8f9a" {...L} /></>
    : <><circle cx="24" cy="26" r="14" fill={c} {...L} /><path d="M12 20 C20 24 28 20 36 24 M14 32 C22 28 30 34 36 30" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" /></>;
  return <svg viewBox="0 0 48 48" width={40} height={40} aria-hidden="true">{art}</svg>;
}

const SHELF: { kind: ShelfKind; title: string }[] = [{ kind: 'outfit', title: 'Outfits' }, { kind: 'toy', title: 'Toys' }, { kind: 'cushion', title: 'Cushions' }];

export function Corner() {
  const { cat, wallet } = useStore();
  const pt = usePetText();
  const [line, setLine] = useState('');
  const [react, setReact] = useState<{ id: ReactionId; n: number } | null>(null);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  if (!cat || !wallet) return null;
  const c = cat.corner;
  const day = localDay(Date.now());
  const have = owned(c, wallet.bond);
  const balance = Math.max(0, wallet.treats);
  const bond = bondLevel(wallet.bond);
  const giftReady = !giftClaimed(c, day);
  const toys = [...new Set([...wallet.toys, ...SHOP.filter((i) => i.kind === 'toy' && have.has(i.id)).map((i) => i.id)])];
  const say = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? '' : x)), 2600); };
  const act = async (f: () => Promise<unknown>) => { if (busy) return; setBusy(true); try { await f(); } finally { setBusy(false); } };

  const openGift = () => act(async () => {
    const n = await store.claimGift();
    if (n) { audio.sparkle(); audio.buzz([10, 40, 20]); setLine(`A gift! +${n} treats`); setReact({ id: 'r6', n: Date.now() }); say(`+${n} treats from today’s gift`); }
  });
  const playWith = (toy: string) => act(async () => {
    const [id, l] = TOY_MOVE[toy] ?? ['r13', 'Play time!'];
    setReact({ id, n: Date.now() }); setLine(l); audio.chirp();
    if (await store.play(toy)) say(pt('+1 bond. He loves playing with you.'));
  });
  const tap = (item: ShopItem) => act(async () => {
    if (!have.has(item.id) && item.special) { say(item.special); return; }
    if (!have.has(item.id)) {
      if (balance < item.price) { say(`${item.price - balance} more treats to go`); return; }
      if (await store.buy(item.id)) { audio.sparkle(); audio.buzz([10, 40, 20]); setReact({ id: 'r1', n: Date.now() }); setLine(item.kind === 'toy' ? 'A new toy!' : 'Ooh, fancy!'); say(`${item.name} bought`); }
      return;
    }
    audio.chirp();
    if (item.kind === 'outfit') await store.wear(c?.wearing === item.id ? null : item.id);
    else if (item.kind === 'cushion') await store.setCushion(c?.cushion === item.id ? null : item.id);
    else playWith(item.id);
  });

  return <div className="screen">
    <div className="top"><button className="iconbtn" aria-label="Back to Train" onClick={() => go('train')}><Icon name="back" /></button><b className="sp" style={{ fontSize: 17 }}>{cat.name}’s corner</b>
      <span className="chip num" style={{ background: 'var(--butter)', color: 'var(--butter-ink)', minHeight: 32, fontSize: 14 }} aria-label={`${balance} treats`}><Paw size={16} color="#d4a23a" />{balance}</span></div>
    <div className="stag">
      <div className="card butter" style={{ padding: '18px 16px 14px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'center', minHeight: 26 }}>{(line || toast) && <span key={line + toast} className="bubble mint">{toast || line}</span>}</div>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 4 }}>
          <div style={{ position: 'relative', zIndex: 1, marginBottom: -34 }}>
            <Chester coat={cat.coat} eyes={cat.eyes} wear={c?.wearing} width={150} interactive label={cat.name} mood="curious" onPet={(l) => setLine(l)} react={react?.id ?? null} reactKey={react?.n} /></div>
          <CushionArt id={c?.cushion} />
        </div>
        <div style={{ marginTop: 10 }}>
          <div className="row"><b className="sp">Bond: {bond.name}</b><span className="s num">Level {bond.level}</span></div>
          <div className="bar" style={{ marginTop: 8 }} role="progressbar" aria-label="Bond" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(bond.frac * 100)}><i style={{ width: `${Math.max(4, bond.frac * 100)}%` }} /></div>
          <p className="s" style={{ marginTop: 6 }}>{bond.next == null ? pt('As close as it gets. He adores you.') : `${bond.next - wallet.bond} more bond to the next level${(() => { const g = BOND_LEVELS[bond.level]?.gift; return g && !have.has(g) ? `, which gives ${pt('him')} a free ${ITEM_BY_ID[g].name.toLowerCase()}` : ''; })()}. Gifts, play and friends build it.`}</p>
        </div>
      </div>

      {giftReady
        ? <button className="card mint row" style={{ width: '100%', border: 0, textAlign: 'left', color: 'inherit', font: 'inherit' }} onClick={openGift} disabled={busy}>
            <div className="ico"><Icon name="star" /></div><div className="sp"><b style={{ fontSize: 16 }}>Today’s gift is here</b><p className="s">Tap to open. One a day for {cat.name}, shared with your household.</p></div></button>
        : <div className="card grey row"><div className="ico"><Icon name="check" /></div><div className="sp"><b>Today’s gift opened</b><p className="s">+{dailyGiftTreats(cat.id, day)} treats. Another one tomorrow.</p></div></div>}

      {toys.length > 0 && <>
        <div className="row" style={{ marginTop: 22 }}><h2 className="sp">Play</h2><span className="s">{playedToday(c, day) ? 'Bond point earned today' : 'First play today: +1 bond'}</span></div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '10px 2px 4px', margin: '0 -2px' }}>
          {toys.map((t, i) => <button key={t} className="card white" style={{ margin: 0, flex: 'none', width: 104, border: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 12, color: 'inherit' }} onClick={() => playWith(t)} aria-label={`Play with ${toyName(t)}`}>
            <ToyArt name={t} i={i} /><span className="s" style={{ fontWeight: 700, color: 'var(--ink)', textAlign: 'center', lineHeight: 1.2 }}>{toyName(t)}</span></button>)}
        </div></>}

      {SHELF.map((sh) => <section key={sh.kind}>
        <h2 style={{ marginTop: 22 }}>{sh.title}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          {SHOP.filter((i) => i.kind === sh.kind).map((item) => {
            const mine = have.has(item.id);
            const on = (item.kind === 'outfit' && c?.wearing === item.id) || (item.kind === 'cushion' && c?.cushion === item.id);
            const short = !mine && (!!item.special || balance < item.price);
            const label = mine ? (item.kind === 'toy' ? 'Play' : on ? (item.kind === 'outfit' ? 'Wearing' : 'In use') : item.kind === 'outfit' ? 'Wear' : 'Use') : `${item.price}`;
            return <button key={item.id} className={`card ${on ? 'mint' : 'grey'}`} style={{ margin: 0, border: on ? '2px solid var(--teal)' : '2px solid transparent', textAlign: 'left', color: 'inherit', display: 'flex', flexDirection: 'column', gap: 6, padding: 12 }}
              onClick={() => tap(item)} aria-pressed={item.kind !== 'toy' && mine ? on : undefined} aria-label={mine ? `${item.name}: ${label}` : item.special ? `${item.name}: ${item.special}` : `Buy ${item.name} for ${item.price} treats`}>
              <div style={{ height: 76, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: short ? 0.55 : 1 }}>
                {item.kind === 'outfit' ? <Chester coat={cat.coat} eyes={cat.eyes} wear={item.id} mood="happy" width={74} />
                  : item.kind === 'cushion' ? <CushionArt id={item.id} width={120} /> : <ToyArt name={item.id} i={0} />}</div>
              <b style={{ fontSize: 15 }}>{item.name}</b>
              <p className="s" style={{ lineHeight: 1.3 }}>{item.blurb}{!mine && bondGiftLevel(item.id) ? ` · Free at ${bondGiftLevel(item.id)!.name}` : ''}</p>
              <span className="chip num" style={{ alignSelf: 'flex-start', background: mine ? 'var(--surface)' : 'var(--butter)', color: mine ? 'var(--ink)' : 'var(--butter-ink)' }}>
                {mine ? (on ? <><Icon name="check" size={14} />{label}</> : label) : item.special ? <><Icon name="lock" size={14} />Make a friend</> : <><Paw size={14} color="#d4a23a" />{label}</>}</span>
            </button>;
          })}
        </div>
      </section>)}
      <p className="s" style={{ textAlign: 'center', marginTop: 20 }}>Treats come from the daily gift, logging {cat.name}’s care (a few a day, more for weigh-ins, doses on time and vet visits), training sets and friends. Tap an outfit or cushion again to take it off.</p>
    </div>
  </div>;
}
