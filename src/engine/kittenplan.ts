/* The usual kitten vaccine and checkup schedule (general guidance; the vet sets the real one), ticked off from what's
   been logged. Shown for pets under 18 months. Matching is by name, so "FVRCP", "Distemper combo", "Rabies" all count. */
import type { CareItem } from './care';
import type { Cat } from './types';

export interface PlanStep { key: string; title: string; when: string; done: boolean; progress?: string; preset: { name: string; what: 'vaccine' | 'medicine' } | { reason: string } }

const MONTH = 30.44 * 864e5;
function bornAt(birthday: string): number | null { const [y, m, d] = birthday.split('-').map(Number); return y && m ? new Date(y, m - 1, d || 15).getTime() : null; }

export function kittenPlan(cat: Pick<Cat, 'birthday' | 'altered' | 'sex'>, care: CareItem[], now = Date.now()): PlanStep[] | null {
  const born = bornAt(cat.birthday); if (born == null || now - born > 18 * MONTH) return null;
  const meds = care.filter((i) => i.kind === 'med' && !i.deleted) as CareItem<'med'>[];
  const vets = care.filter((i) => i.kind === 'vet' && !i.deleted) as CareItem<'vet'>[];
  const doses = (re: RegExp) => meds.filter((m) => re.test(m.data.name));
  const core = doses(/fvrcp|fvrc|distemper|feline viral|panleuk|\bfvr\b/i), rabies = doses(/rabies/i), felv = doses(/felv|leuk/i);
  const after = (xs: CareItem[], months: number) => xs.some((x) => x.at - born >= months * MONTH);
  const spay = cat.sex === 'f' ? 'Spay' : 'Neuter';
  return [
    { key: 'core', title: 'Core vaccine series (FVRCP)', when: 'Usually every 3–4 weeks from 6–8 weeks old until about 16 weeks', done: core.length >= 3 || after(core, 3.7), progress: `${Math.min(core.length, 3)} of about 3 logged`, preset: { name: 'FVRCP', what: 'vaccine' } },
    { key: 'rabies', title: 'Rabies', when: 'Usually around 12–16 weeks (local law may set it)', done: rabies.length > 0, preset: { name: 'Rabies', what: 'vaccine' } },
    { key: 'felv', title: 'FeLV (feline leukemia)', when: 'Recommended for kittens: 2 doses, 3–4 weeks apart, from 8 weeks', done: felv.length >= 2, progress: `${Math.min(felv.length, 2)} of 2 logged`, preset: { name: 'FeLV', what: 'vaccine' } },
    { key: 'spay', title: spay, when: 'Often around 5–6 months; ask your vet', done: !!cat.altered || vets.some((v) => /spay|neuter/i.test(v.data.reason)), preset: { reason: spay } },
    { key: 'boost', title: 'One-year boosters', when: 'About a year after the kitten series (core and rabies)', done: after(core, 12) || after(rabies, 12), preset: { name: 'FVRCP booster', what: 'vaccine' } },
  ];
}
