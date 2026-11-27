import { useId, useState } from 'react';
import { Icon } from './icons';

/** Accordion (docs/design-system.md, Components): a header button that shows or hides what's under it, for
    progressive disclosure. Opens and closes in --dur (CSS `.acc` in app.css: the body's grid row goes 0fr → 1fr);
    with reduced motion the body appears at once and fades in over --dur-fast. Uncontrolled (`defaultOpen`) or
    controlled (`open` + `onToggle`). Closed content is hidden from the tab order and VoiceOver (`inert`). */
export function Accordion({ title, children, defaultOpen = false, open: openProp, onToggle, style }: {
  title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; open?: boolean; onToggle?: (open: boolean) => void; style?: React.CSSProperties;
}) {
  const [own, setOwn] = useState(defaultOpen);
  const open = openProp ?? own;
  const id = useId();
  const toggle = () => { const next = !open; if (openProp === undefined) setOwn(next); onToggle?.(next); };
  return <div className={`acc${open ? ' open' : ''}`} style={style}>
    <button type="button" className="acchead" aria-expanded={open} aria-controls={id} onClick={toggle}>
      <span className="sp">{title}</span><span className="accchev" aria-hidden="true"><Icon name="chevron" size={18} /></span>
    </button>
    <div className="accbody" id={id} role="region" aria-label={typeof title === 'string' ? title : undefined} inert={!open} aria-hidden={!open}>
      <div className="accinner">{children}</div>
    </div>
  </div>;
}
