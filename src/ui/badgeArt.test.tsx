import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { badgeArtKey, BRANCH_ORDER, badgeFor } from '../engine/badges';
import { SKILLS } from '../engine/skills';
import { BADGE_ART } from './badgeArt';
import { SHINE_FLASH_MS, SHINE_MS } from './BadgeShine';
import { BadgeTile } from '../screens/Trophies';
import { CHESTER_ICONS, linePath } from './icons';
import { LINE } from './iconArt';
import * as router from './router';

const tokensCss = async (): Promise<string> => { // read the file itself: vitest drops CSS imports
  const fs = 'node:fs'; return ((await import(/* @vite-ignore */ fs)).readFileSync as (f: string, e: string) => string)('src/styles/tokens.css', 'utf8');
};

afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('badge art', () => {
  it('has earned and locked art for every skill id in skills.ts, and hidden art for every branch', () => {
    for (const s of SKILLS) for (const state of ['earned', 'locked'] as const) expect(BADGE_ART[badgeArtKey({ state, skill: s })], `${state}/${s.id}`).toBeTruthy();
    for (const b of BRANCH_ORDER) expect(BADGE_ART[`hidden/${b.toLowerCase()}`], b).toBeTruthy();
    expect(Object.keys(BADGE_ART)).toHaveLength(SKILLS.length * 2 + BRANCH_ORDER.length);
  });
  it('keeps SHINE_MS and the reduced-motion flash in step with the tokens', async () => {
    const tokens = await tokensCss();
    expect(tokens).toContain(`--shine-ms:${SHINE_MS}ms`);
    expect(tokens).toContain(`--shine-flash-ms:${SHINE_FLASH_MS}ms`);
  });
  it('has a branch colour token for every branch', async () => {
    const tokens = await tokensCss();
    for (const b of BRANCH_ORDER) for (const k of ['', '-light', '-ink']) expect(tokens).toContain(`--branch-${b.toLowerCase()}${k}:`);
  });
});

describe('BadgeTile', () => {
  const sit = SKILLS.find((s) => s.id === 'sit')!;
  const stay = SKILLS.find((s) => s.id === 'stay')!;
  const goSpy = () => vi.spyOn(router, 'go').mockImplementation(() => {});
  it('an earned badge shines, then opens the skill after SHINE_MS', () => {
    vi.useFakeTimers(); const go = goSpy();
    const { getByRole, container } = render(<BadgeTile b={badgeFor(sit, { skillId: 'sit', step: 4, mastered: true, masteredAt: 1 })} />);
    fireEvent.click(getByRole('button'));
    expect(container.querySelector('.badgeshine')!.classList.contains('is-shining')).toBe(true);
    expect(container.querySelector('.glint')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(SHINE_MS - 1); }); expect(go).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); }); expect(go).toHaveBeenCalledWith('skill/sit');
  });
  it('a locked badge has no shine and opens at once', () => {
    vi.useFakeTimers(); const go = goSpy();
    const { getByRole, container } = render(<BadgeTile b={badgeFor(sit, { skillId: 'sit', step: 1, mastered: false })} />);
    expect(container.querySelector('img')!.getAttribute('src')).toBe(BADGE_ART['locked/sit']);
    fireEvent.click(getByRole('button'));
    expect(container.querySelector('.glint')).toBeNull();
    act(() => { vi.advanceTimersByTime(0); }); expect(go).toHaveBeenCalledWith('skill/sit');
  });
  it('a hidden badge shows the branch mystery art, no name, and is not a button', () => {
    const { queryByRole, getByRole, container } = render(<BadgeTile b={badgeFor(stay, undefined, true)} />);
    expect(queryByRole('button')).toBeNull();
    expect(getByRole('img').getAttribute('aria-label')).toBe('A hidden Manners skill');
    expect(container.textContent).not.toContain('Stay');
    expect(container.querySelector('img')!.getAttribute('src')).toBe(BADGE_ART['hidden/manners']);
  });
});

describe('icons', () => {
  it('has the Chester-style tab icons', () => {
    for (const n of ['home', 'health', 'plus', 'paw', 'friends', 'settings']) expect(CHESTER_ICONS).toContain(n);
  });
  it('line icons come from the approved set, with the old names as aliases; plus and check keep the plain glyphs', () => {
    expect(linePath('heart')).toBe(LINE.health);
    expect(linePath('gear')).toBe(LINE.settings);
    expect(linePath('back')).toBe(LINE.back);
    expect(linePath('plus')).not.toBe(LINE.plus);
    expect(linePath('plus-circle')).toBe(LINE.plus);
  });
});
