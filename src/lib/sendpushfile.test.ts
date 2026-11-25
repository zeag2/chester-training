// supabase/deploy/send-push.ts (the one-file copy for the dashboard editor) must match the function's source files.
import { describe, it, expect } from 'vitest';

describe('send-push one-file copy', () => {
  it('is current (if not: node scripts/send-push-one-file.mjs)', async () => {
    const fs = 'node:fs'; const script = '../../scripts/send-push-one-file.mjs'; // no Node types here
    const { readFileSync } = await import(/* @vite-ignore */ fs);
    const { oneFile } = await import(/* @vite-ignore */ script);
    expect(readFileSync('supabase/deploy/send-push.ts', 'utf8')).toBe(oneFile());
    expect(oneFile()).not.toMatch(/from '\.{1,2}\//); // no relative imports left
  });
});
