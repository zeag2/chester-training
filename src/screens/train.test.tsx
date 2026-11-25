import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react';
import { store } from '../db/store';
import { Train } from './Train';

afterEach(() => { cleanup(); location.hash = ''; });

describe('Training card: the last skill trained, with Change', () => {
  it('falls back to the plan on day one, then offers the last skill; Start goes straight in, Change opens the tree', async () => {
    await store.load();
    await store.saveCat({ name: 'Chester', birthday: '2026-04', homeDate: '2026-11-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' });
    const { rerender } = render(<Train embedded />);
    expect(screen.getByText('Up next · new skill')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Start Charge the clicker/ })).toBeTruthy();
    await act(async () => { await store.logSet({ skillId: 'clicker', reps: 6, good: 5, mood: 'Happy', seconds: 90 }); });
    rerender(<Train embedded />);
    expect(screen.getByText(/Same as last time · trained earlier today/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Start Charge the clicker/ }));
    expect(location.hash).toBe('#/session/clicker');
    fireEvent.click(screen.getByRole('button', { name: 'Change skill (now Charge the clicker)' }));
    expect(location.hash).toBe('#/tree');
  });
});
