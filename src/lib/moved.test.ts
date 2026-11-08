import { describe, it, expect } from 'vitest';
import { movedTo } from './moved';
describe('the old address points to the new one', () => {
  it('only on the old GitHub address', () => {
    expect(movedTo('zeag2.github.io')).toBe('https://paldex-4qh.pages.dev/');
    expect(movedTo('paldex-4qh.pages.dev')).toBeNull();
    expect(movedTo('localhost:5173')).toBeNull();
  });
});
