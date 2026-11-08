import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { store } from '../db/store';
import { Session } from './Session';

describe('Session screen', () => {
  it('restores a half-finished set after the app was closed, and counts taps', async () => {
    await store.load();
    await store.saveCat({ name: 'Chester', birthday: '2026-04', homeDate: '2026-11-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' });
    await store.saveDraft({ skillId: 'clicker', startedAt: 1, reps: 8, good: 6, seconds: 50 });
    render(<Session skillId="clicker" />);
    expect(screen.getByText('6 good · 2 missed')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Yes! Log a good rep' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Missed' })); });
    expect(screen.getByText('7 good · 3 missed')).toBeTruthy();
  });
  it('restarts the timer, keeping the reps or clearing them', async () => {
    cleanup();
    await store.saveDraft({ skillId: 'clicker', startedAt: 1, reps: 4, good: 3, seconds: 95 });
    render(<Session skillId="clicker" />);
    expect(screen.getByText('0:25')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Restart the timer' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Keep the 4 reps' })); });
    expect(screen.getByText('2:00')).toBeTruthy(); expect(screen.getByText('3 good · 1 missed')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Restart the timer' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Clear them too' })); });
    expect(screen.getByText('0 good · 0 missed')).toBeTruthy();
  });
});
