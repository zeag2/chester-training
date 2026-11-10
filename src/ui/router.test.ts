import { describe, it, expect, beforeEach } from 'vitest';
import { back, go, trackHistory } from './router';

const hashchange = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

describe('Back on pages opened straight from a link', () => {
  beforeEach(() => { history.replaceState(null, '', '/#/health/docs'); trackHistory(); });
  it('goes to the fallback page, not out of the app, when the app was opened on this page', () => {
    history.pushState(null, '', '/#/other-site'); history.replaceState(null, '', '/#/health/docs'); trackHistory(); // history.length > 1
    expect(history.length).toBeGreaterThan(1);
    back('health');
    expect(location.hash).toBe('#/health');
  });
  it('goes back to the previous in-app page once you’ve moved inside the app', () => {
    go('health/visit/v1'); hashchange();
    expect(history.state.depth).toBe(1);
    let backed = false; const real = history.back; history.back = () => { backed = true; };
    try { back('health'); } finally { history.back = real; }
    expect(backed).toBe(true);
  });
});
