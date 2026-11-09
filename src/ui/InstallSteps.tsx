import { useState } from 'react';
import { browser, platform, type Browser, type Platform } from '../lib/install';

const svg = { stroke: 'currentColor', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', verticalAlign: '-5px' } as const;
export const ShareIcon = () => <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true" style={svg}><path d="M8 9 H6 V20 H18 V9 H16 M12 3 V14 M8.5 6.5 L12 3 L15.5 6.5" /></svg>;
export const PlusBox = () => <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true" style={svg}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5 V15.5 M8.5 12 H15.5" /></svg>;

const NAMES: Record<Exclude<Browser, 'other'>, string> = { safari: 'Safari', chrome: 'Chrome', firefox: 'Firefox', edge: 'Edge', samsung: 'Samsung Internet', inapp: 'Another app' };
/** The browsers that can add to the Home Screen on each phone, in the order people are likely to use them. */
const CHOICES: Record<Platform, Browser[]> = { ios: ['safari', 'chrome', 'firefox', 'edge'], android: ['chrome', 'samsung', 'firefox', 'edge'], desktop: ['chrome', 'edge', 'safari'] };

/** The steps for one browser on one kind of phone. */
function steps(os: Platform, b: Browser, name: string): React.ReactNode[] {
  const open = <>Open <b>{name}</b> from your Home Screen.</>;
  if (b === 'inapp') return os === 'ios'
    ? [<>This page is open inside another app, which can’t add to the Home Screen.</>, <>Tap <b>•••</b> or the compass in a corner and choose <b>Open in Safari</b> (or Open in browser).</>, <>Then tap <b>Add to Home Screen</b> again there.</>]
    : [<>This page is open inside another app, which can’t add to the Home Screen.</>, <>Tap <b>⋮</b> in a corner and choose <b>Open in Chrome</b> (or Open in browser).</>, <>Then tap <b>Add to Home Screen</b> again there.</>];
  if (os === 'ios') {
    if (b === 'chrome') return [<>Tap <b>Share</b> <ShareIcon /> at the right of the address bar, at the top.</>, <>Tap <b>Add to Home Screen</b> <PlusBox /> (scroll down or tap <b>More</b> if it isn’t showing).</>, <>Tap <b>Add</b>. {open}</>];
    if (b === 'firefox') return [<>Tap the menu <b>☰</b> at the bottom right.</>, <>Tap <b>Share</b> <ShareIcon />, then <b>Add to Home Screen</b> <PlusBox />.</>, <>Tap <b>Add</b>. {open}</>];
    if (b === 'edge') return [<>Tap the menu <b>•••</b> at the bottom.</>, <>Tap <b>Share</b> <ShareIcon />, then <b>Add to Home Screen</b> <PlusBox />.</>, <>Tap <b>Add</b>. {open}</>];
    return [<>Tap <b>Share</b> <ShareIcon /> in Safari’s toolbar. On newer iPhones, tap <b>•••</b> at the bottom right first, then Share.</>, <>Scroll down and tap <b>Add to Home Screen</b> <PlusBox /></>, <>Tap <b>Add</b>. {open}</>];
  }
  if (b === 'samsung') return [<>Tap the menu <b>☰</b> at the bottom right.</>, <>Tap <b>Add page to</b>, then <b>Home screen</b> (or tap the install icon in the address bar if there is one).</>, <>Tap <b>Add</b>. {open}</>];
  if (b === 'firefox') return [<>Tap the menu <b>⋮</b>.</>, <>Tap <b>Add to Home screen</b> (or <b>Add app to Home screen</b>).</>, <>Tap <b>Add</b>. {open}</>];
  if (b === 'edge') return [<>Tap the menu <b>•••</b> at the bottom.</>, <>Tap <b>Add to phone</b> or <b>Add to Home screen</b>.</>, <>Tap <b>Install</b> or <b>Add</b>. {open}</>];
  if (b === 'safari') return [<>In the menu bar, choose <b>File</b>, then <b>Add to Dock</b>.</>, <>Open <b>{name}</b> from the Dock.</>];
  return [<>Open the browser’s menu <b>⋮</b> at the top right.</>, <>Tap <b>Install app</b> or <b>Add to Home screen</b>.</>, <>Tap <b>Install</b>. {open}</>];
}

/** Add to Home Screen steps for the browser this is, with chips to pick another if the guess is wrong. */
export function InstallSteps({ name }: { name: string }) {
  const os = platform();
  const guess = browser();
  const choices = CHOICES[os];
  const [b, setB] = useState<Browser>(guess === 'inapp' || choices.includes(guess) ? guess : choices[0]);
  return <>
    <div className="row" role="group" aria-label="Which browser are you using?" style={{ gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
      {(guess === 'inapp' ? ['inapp' as Browser, ...choices] : choices).map((k) => <button key={k} className="chip" aria-pressed={b === k} onClick={() => setB(k)}
        style={{ border: 0, minHeight: 32, background: b === k ? 'var(--ink)' : 'var(--grey)', color: b === k ? 'var(--on-ink)' : 'inherit', fontWeight: 700 }}>{NAMES[k as Exclude<Browser, 'other'>]}</button>)}
    </div>
    <ol className="steps">{steps(os, b, name).map((s, i) => <li key={b + i}><span>{s}</span></li>)}</ol>
    {os === 'ios' && b === 'safari' && <div className="pointdown" aria-hidden="true">↓</div>}
  </>;
}
