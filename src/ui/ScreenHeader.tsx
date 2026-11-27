import type { ReactNode } from 'react';
import { Icon } from './icons';

/** The back row at the top of every screen that isn't a tab (docs/design-system.md, "Screen header"): a 44 px back
    button, the screen's name at section-head size, and an optional trailing action (an `.iconbtn`, a `.btn2`, a chip).
    Top-level tabs (Home, Health, Chester, Friends) use a plain 28 px `<h1>` instead and have no back row.
    `heading`: false when the page opens with its own subject as the h1 under this row (a visit, For the vet), so the
    page keeps one h1. */
export function ScreenHeader({ title, onBack, backLabel = 'Back', back = 'back', trailing, heading = true }: {
  title: ReactNode; onBack?: () => void; backLabel?: string; back?: 'back' | 'close'; trailing?: ReactNode; heading?: boolean;
}) {
  const T = heading ? 'h1' : 'p';
  return <div className="top">
    {onBack && <button className="iconbtn" aria-label={backLabel} onClick={onBack}><Icon name={back} /></button>}
    <T className="toptitle">{title}</T>
    {trailing}
  </div>;
}
