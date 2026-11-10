import { describe, it, expect, beforeEach } from 'vitest';
import { applyAppName, closeHomeIconNote, rememberHomeLook, staleHomeIcon, decodePets, donePendingPet, encodePets, pendingPets, setPendingPets, takePendingFromUrl, titleFor } from './appname';

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
    expect(pendingPets().map((p) => p.name)).toEqual(['Chester', 'Luna']);
    donePendingPet('chester'); expect(pendingPets().map((p) => p.name)).toEqual(['Luna']);
    donePendingPet('Lulu'); expect(pendingPets()).toEqual([]); // renamed during setup: still ticked off
  });
  it('carries names into the installed app in the start address, then tidies it', () => {
    history.replaceState(null, '', '/?pets=Chester~black~gold,Luna%20B~orange#/home');
    takePendingFromUrl();
    expect(pendingPets()).toEqual([{ name: 'Chester', coat: 'black', eyes: 'gold' }, { name: 'Luna B', coat: 'orange', eyes: undefined }]);
    expect(location.search).toBe(''); expect(location.hash).toBe('#/home');
  });
  it('round-trips names and looks through an address, odd characters included', () => {
    const pets = [{ name: 'Mr. Whiskers, Jr', coat: 'tuxedo', eyes: 'blue' }, { name: 'Luna' }];
    expect(decodePets(encodePets(pets))).toEqual([{ name: 'Mr. Whiskers, Jr', coat: 'tuxedo', eyes: 'blue' }, { name: 'Luna', coat: undefined, eyes: undefined }]);
  });
  it('puts the name on the tab and the iPhone Home Screen title', () => {
    applyAppName(['Chester', 'Luna']);
    expect(document.title).toBe('Chester & Luna');
    expect(document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content')).toBe('Chester & Luna');
  });

  it('in the installed iPhone app only, notices once when the cats behind the icon change', () => {
    const chester = [{ name: 'Chester', coat: 'black', eyes: 'gold' }];
    const both = [...chester, { name: 'Luna', coat: 'orange', eyes: 'green' }];
    // a Safari tab or Android: never
    rememberHomeLook(chester, false);
    expect(staleHomeIcon(both, false)).toBe(false);
    // the installed app remembers what it was added with
    rememberHomeLook(chester, true);
    expect(staleHomeIcon(chester, true)).toBe(false);
    rememberHomeLook(both, true); // only the first time counts
    expect(staleHomeIcon(both, true)).toBe(true);
    expect(staleHomeIcon([{ name: 'Chester', coat: 'tabby', eyes: 'gold' }], true)).toBe(true); // a new look, same name
    closeHomeIconNote(both);
    expect(staleHomeIcon(both, true)).toBe(false); // once
    expect(staleHomeIcon(chester, true)).toBe(false); // back as it was added
  });
});
