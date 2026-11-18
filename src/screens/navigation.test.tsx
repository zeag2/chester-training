import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, fireEvent, screen, act, waitFor } from '@testing-library/react';
import { store } from '../db/store';
import { Onboarding } from './Onboarding';
import { CatPage } from './CatPage';
import { AccountNudge } from '../ui/AccountNudge';

afterEach(() => { cleanup(); location.hash = ''; });
beforeEach(() => { try { localStorage.clear(); } catch { /* */ } });

describe('navigation Option A and the short onboarding', () => {
  it('sets up a cat in three screens: welcome, name and look, training', async () => {
    await store.load();
    render(<Onboarding />);
    expect(screen.getByRole('button', { name: 'Someone invited me' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Set up my cat' }));
    // name, boy/girl and the look on one screen; no birthday or breed questions any more
    expect(screen.getByRole('group', { name: 'Coat' })).toBeTruthy();
    expect(screen.queryByLabelText(/Birthday/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Mochi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Girl' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Do you want to train Mochi?')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Yes, let’s train/ })); });
    await waitFor(() => expect(location.hash).toBe('#/another'));
    expect(store.get().cat).toMatchObject({ name: 'Mochi', sex: 'f', training: true, rewards: ['treats', 'petting'] });
  });

  it('asks for an account after the first Fed, not before; Not now hides it', async () => {
    await store.load();
    if (!store.get().cat) await store.saveCat({ name: 'Mochi', birthday: '', homeDate: '2026-11-01', breed: '', coat: 'black', eyes: 'gold', rewards: [], outfit: '' });
    const { rerender } = render(<AccountNudge />);
    expect(screen.queryByText(/Save .* to your account\?/)).toBeNull();
    await act(async () => { await store.saveCare('daily', { what: 'fed' }, {}); await store.settled(); });
    rerender(<AccountNudge />);
    expect(screen.getByText(/Save Mochi to your account\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByText(/Save Mochi to your account\?/)).toBeNull();
    cleanup(); render(<AccountNudge />);
    expect(screen.queryByText(/Save Mochi to your account\?/)).toBeNull(); // remembered on this phone
  });

  it('the cat’s tab: his name, his corner, and training as a section (or the switch to turn it on)', async () => {
    await store.load();
    const cat = store.get().cat!;
    await store.saveCat({ ...cat, training: true });
    render(<CatPage />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(cat.name);
    expect(screen.getByRole('link', { name: new RegExp(`${cat.name}’s corner`) }).getAttribute('href')).toBe('#/corner');
    expect(screen.getByRole('heading', { level: 2, name: 'Training' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: new RegExp(`${cat.name}’s corner`) })).toBeNull(); // not twice
    await act(async () => { await store.saveCat({ ...store.get().cat!, training: false }); });
    expect(screen.getByRole('button', { name: `Turn on training for ${cat.name}` })).toBeTruthy();
  });
});
