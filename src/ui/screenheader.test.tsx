import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { ScreenHeader } from './ScreenHeader';
import { Node } from '../screens/Tree';
import { SKILLS } from '../engine/skills';

afterEach(cleanup);

describe('ScreenHeader (docs/design-system.md, "Screen header")', () => {
  it('is a back button, the name as the h1, and a trailing action', () => {
    const onBack = vi.fn();
    render(<ScreenHeader onBack={onBack} title="Trophy case" trailing={<button className="btn2">Share</button>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Trophy case' }).className).toBe('toptitle');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
  });
  it('is not a heading when the page has its own subject as the h1', () => {
    render(<ScreenHeader onBack={() => {}} backLabel="Back to Health" title="Vet visit" heading={false} />);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByRole('button', { name: 'Back to Health' })).toBeTruthy();
  });
});

describe('visual match (UX review 2026-11-25)', () => {
  it('item 7: a locked skill row has the lock icon and no "Locked" pill, but still says Locked to VoiceOver', () => {
    const d = SKILLS.find((s) => s.requires.length > 0)!;
    const { container } = render(<Node d={d} st="l" sub="Needs Charge the clicker" />);
    expect(container.querySelector('.chip')).toBeNull();
    expect(container.querySelector('.visually-hidden')?.textContent).toBe('Locked');
  });
  it('item 2: tab labels are 12 px in --muted; touch targets in the header and Roll a toy are 44 px', async () => {
    const fs = 'node:fs'; // read the file itself: vitest drops CSS imports (as in src/styles/cssText.ts)
    const css: string = (await import(/* @vite-ignore */ fs)).readFileSync('src/styles/app.css', 'utf8');
    expect(css).toMatch(/\.tab\{[^}]*font-size:var\(--fs-label\);[^}]*color:var\(--muted\);/);
    expect(css).toMatch(/\.top \.btn2\{min-height:44px/);
    expect(css).toMatch(/\.yarnbtn\{[^}]*width:44px;height:44px/);
    expect(css).not.toMatch(/\.vetcard\{/);
  });
});
