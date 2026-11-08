import { describe, it, expect } from 'vitest';
import { streakInfo } from './stats';
import type { SetRecord } from '../engine/types';

const on = (...days: string[]) => days.map((day) => ({ day }) as SetRecord);
const run = (from: string, n: number) => Array.from({ length: n }, (_, i) => new Date(Date.parse(from + 'T12:00:00Z') + i * 864e5).toISOString().slice(0, 10));

describe('streak with nap tokens', () => {
  it('counts days in a row; today not done yet never breaks it', () => {
    expect(streakInfo(on('2026-11-06', '2026-11-07'), '2026-11-08')).toEqual({ days: 2, naps: 0, napsUsed: 0 });
    expect(streakInfo([], '2026-11-08').days).toBe(0);
  });
  it('resets on a missed day with no nap token', () => {
    expect(streakInfo(on('2026-11-04', '2026-11-05', '2026-11-07'), '2026-11-08').days).toBe(1);
  });
  it('earns a nap every 7 days and spends it on a rest day instead of resetting', () => {
    const week = run('2026-11-01', 7); // Nov 1–7, then rest on the 8th, back on the 9th
    expect(streakInfo(on(...week), '2026-11-07')).toEqual({ days: 7, naps: 1, napsUsed: 0 });
    expect(streakInfo(on(...week, '2026-11-09'), '2026-11-09')).toEqual({ days: 8, naps: 0, napsUsed: 1 });
    expect(streakInfo(on(...week, '2026-11-10'), '2026-11-10').days).toBe(1); // two rest days: one nap isn't enough
  });
});
