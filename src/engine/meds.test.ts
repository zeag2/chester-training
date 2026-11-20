import { describe, it, expect } from 'vitest';
import { medsDue, type CareItem } from './care';

const at = (d: string, h = 9) => Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00`);
let n = 0;
const med = (name: string, when: number, extra: Partial<CareItem<'med'>['data']> = {}): CareItem<'med'> =>
  ({ id: 'm' + ++n, catId: 'c', kind: 'med', at: when, updatedAt: when, data: { name, what: 'medicine', ...extra } });

describe('medicine due today', () => {
  it('a daily course: doses left today until its last day, then nothing', () => {
    const course = { times: 2, until: '2026-11-21' };
    const items = [med('Clavamox', at('2026-11-19', 8), { course })];
    expect(medsDue(items, at('2026-11-19', 12)).map((d) => [d.name, d.kind, d.given, d.times])).toEqual([['Clavamox', 'course', 1, 2]]);
    items.push(med('Clavamox', at('2026-11-19', 20), { course }));
    expect(medsDue(items, at('2026-11-19', 21))).toEqual([]); // both given today
    expect(medsDue(items, at('2026-11-20', 7))[0]).toMatchObject({ given: 0, times: 2 });
    expect(medsDue(items, at('2026-11-21', 7))).toHaveLength(1);
    expect(medsDue(items, at('2026-11-22', 7))).toEqual([]); // the course is over
  });
  it('a dose whose next-due day has come or passed; not one still ahead', () => {
    const items = [med('Revolution', at('2026-10-19'), { what: 'flea', nextDue: '2026-11-19' }), med('Pyrantel', at('2026-11-01'), { what: 'worm', nextDue: '2026-12-01' }),
      med('FeLV', at('2026-11-01'), { what: 'vaccine', nextDue: '2026-11-15' })];
    expect(medsDue(items, at('2026-11-19')).map((d) => [d.name, d.daysLeft])).toEqual([['FeLV', -4], ['Revolution', 0]]);
    // giving it (a newer entry, next due a month on) clears it
    items.push(med('Revolution', at('2026-11-19', 10), { what: 'flea', nextDue: '2026-12-19' }));
    expect(medsDue(items, at('2026-11-19', 11)).map((d) => d.name)).toEqual(['FeLV']);
  });
});
