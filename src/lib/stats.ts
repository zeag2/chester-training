import { localDay, daysBetween } from '../engine/day';
import { SKILLS } from '../engine/skills';
import type { SetRecord, SkillProgress } from '../engine/types';

export const today = () => localDay(Date.now());
export function lastNDays(n: number, end = today()): string[] {
  const base = Date.parse(end + 'T12:00:00Z');
  return Array.from({ length: n }, (_, i) => new Date(base - (n - 1 - i) * 864e5).toISOString().slice(0, 10));
}
export function weekStats(sets: SetRecord[]) {
  const days = lastNDays(7); const w = sets.filter((s) => days.includes(s.day));
  const reps = w.reduce((a, s) => a + s.reps, 0), good = w.reduce((a, s) => a + s.good, 0);
  return { sessions: w.length, reps, good, rate: reps ? Math.round((100 * good) / reps) : 0 };
}
/** Days in a row with a set. A rest day never shows as a broken streak when a nap token covers it: every 7 days
    trained earn one (keep up to 2), and a missed day uses one instead of resetting. Today never breaks it. */
export function streakInfo(sets: SetRecord[], end = today()): { days: number; naps: number; napsUsed: number } {
  const days = new Set(sets.map((s) => s.day)); if (!days.size) return { days: 0, naps: 0, napsUsed: 0 };
  let d = [...days].sort()[0]; let n = 0, naps = 0, used = 0, since = 0;
  while (d <= end) {
    if (days.has(d)) { n++; since++; if (since === 7) { naps = Math.min(2, naps + 1); since = 0; } }
    else if (d !== end) { if (naps > 0) { naps--; used++; } else { n = 0; since = 0; used = 0; } }
    d = new Date(Date.parse(d + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10);
  }
  return { days: n, naps, napsUsed: used };
}
export function streak(sets: SetRecord[]): number { return streakInfo(sets).days; }
export function dailyRates(sets: SetRecord[]) {
  return lastNDays(7).map((d) => { const x = sets.filter((s) => s.day === d); const r = x.reduce((a, s) => a + s.reps, 0), g = x.reduce((a, s) => a + s.good, 0); return { day: d, rate: r ? Math.round((100 * g) / r) : null }; });
}
export function inProgress(progress: Record<string, SkillProgress>, sets: SetRecord[]) {
  return SKILLS.filter((d) => !progress[d.id]?.mastered && sets.some((s) => s.skillId === d.id));
}
export function ageText(birthday: string): string {
  if (!birthday) return '';
  const [y, m] = birthday.split('-').map(Number); const now = new Date();
  const months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - (m || 1));
  return months < 24 ? `about ${Math.max(0, months)} months old` : `about ${Math.floor(months / 12)} years old`;
}
export const daysHome = (homeDate: string) => (homeDate ? daysBetween(homeDate, today()) + 1 : 0);
