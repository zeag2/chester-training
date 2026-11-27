/** Icon motion (docs/design-system.md, Motion › Icon motion): a small, warm move on an icon, played only by the
    person's own tap. Adds `.imo-<kind>` to the svg and takes it off again on animationend, so the next tap replays it.
    The classes (and their reduced-motion fade) live in src/styles/tokens.css. */
export type IconMotion = 'turn' | 'bounce' | 'nod' | 'pop';
export const ICON_MOTIONS: IconMotion[] = ['turn', 'bounce', 'nod', 'pop'];

export function playIconMotion(el: Element | null | undefined, kind: IconMotion) {
  if (!el) return;
  const cls = 'imo-' + kind;
  for (const k of ICON_MOTIONS) el.classList.remove('imo-' + k);
  void (el as HTMLElement).getBoundingClientRect(); // restart the animation if it's still running
  el.classList.add(cls);
  const done = () => el.classList.remove(cls);
  el.addEventListener('animationend', done, { once: true });
  // a fallback in case animationend never comes (a hidden tab, no CSS): never leave the class on
  window.setTimeout(done, 400);
}

/** An onClick / onPointerDown handler that plays `kind` on the first svg inside the pressed element. */
export const iconPress = (kind: IconMotion) => (e: { currentTarget: Element }) => playIconMotion(e.currentTarget.querySelector('svg'), kind);
