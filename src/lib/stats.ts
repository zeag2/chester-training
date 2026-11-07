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
export function streak(sets: SetRecord[]): number {
  const days = new Set(sets.map((s) => s.day)); let d = today(); let n = 0;
  if (!days.has(d)) d = lastNDays(2)[0];
  while (days.has(d)) { n++; d = new Date(Date.parse(d + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10); }
  return n;
}
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
