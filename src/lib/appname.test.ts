import { describe, it, expect, beforeEach } from 'vitest';
import { applyAppName, donePendingPet, pendingPets, setPendingPets, takePendingFromUrl, titleFor } from './appname';

describe('naming the app after the kittens', () => {
  beforeEach(() => { localStorage.clear(); history.replaceState(null, '', '/'); });
  it('joins names the way people say them', () => {
    expect(titleFor([])).toBe('PalDex'); expect(titleFor([' ', ''])).toBe('PalDex');
    expect(titleFor(['Chester'])).toBe('Chester');
    expect(titleFor(['Chester', 'Luna'])).toBe('Chester & Luna');
    expect(titleFor(['Chester', 'Luna', 'Max'])).toBe('Chester, Luna & Max');
  });
  it('remembers kittens to set up and ticks them off one by one', () => {
    setPendingPets(['Chester', ' Luna ', '']);
    expect(pendingPets()).toEqual(['Chester', 'Luna']);
    donePendingPet('chester'); expect(pendingPets()).toEqual(['Luna']);
    donePendingPet('Lulu'); expect(pendingPets()).toEqual([]); // renamed during setup: still ticked off
  });
  it('carries names into the installed app in the start address, then tidies it', () => {
    history.replaceState(null, '', '/?pets=Chester,Luna%20B#/home');
    takePendingFromUrl();
    expect(pendingPets()).toEqual(['Chester', 'Luna B']);
    expect(location.search).toBe(''); expect(location.hash).toBe('#/home');
  });
  it('puts the name on the tab and the iPhone Home Screen title', () => {
    applyAppName(['Chester', 'Luna']);
    expect(document.title).toBe('Chester & Luna');
    expect(document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content')).toBe('Chester & Luna');
  });
});
