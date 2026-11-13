import { describe, expect, it, vi } from 'vitest';
import { fitSize, photoPath, shrinkPhoto, timeAgo, type PhotoIO } from './photos';

const io = (sizes: number[], w = 4032, h = 3024): PhotoIO & { calls: number[][] } => {
  const calls: number[][] = [];
  return {
    calls,
    decode: vi.fn(async () => ({ width: w, height: h, close: vi.fn() })),
    encode: vi.fn(async (_i, width, height, q) => { calls.push([width, height, q]); return new Blob([new Uint8Array(sizes[calls.length - 1] ?? 10)]); }),
  };
};

describe('photos', () => {
  it('fits the long side to 1600 and never scales up', () => {
    expect(fitSize(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitSize(3024, 4032)).toEqual({ width: 1200, height: 1600 });
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it('encodes once at 0.8 when small enough', async () => {
    const x = io([400_000]);
    const r = await shrinkPhoto(new Blob(['x']), x);
    expect(x.calls).toEqual([[1600, 1200, 0.8]]);
    expect(r).toMatchObject({ width: 1600, height: 1200 });
  });
  it('tries 0.6 when 0.8 is over 1.5 MB, and refuses over 2 MB', async () => {
    const x = io([1_600_000, 900_000]);
    expect((await shrinkPhoto(new Blob(['x']), x)).blob.size).toBe(900_000);
    expect(x.calls.map((c) => c[2])).toEqual([0.8, 0.6]);
    await expect(shrinkPhoto(new Blob(['x']), io([2_500_000, 2_100_000]))).rejects.toThrow('photo-too-big');
  });
  it('says unreadable when the phone can’t decode it', async () => {
    await expect(shrinkPhoto(new Blob(['x']), { decode: async () => { throw new Error('nope'); }, encode: vi.fn() })).rejects.toThrow('photo-unreadable');
  });
  it('puts photos in the pet’s folder', () => { expect(photoPath('mochi', 'abc')).toBe('mochi/abc.jpg'); });
  it('says how long ago', () => {
    const now = Date.parse('2026-11-13T12:00:00Z');
    expect(timeAgo('2026-11-13T11:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-11-13T11:55:00Z', now)).toBe('5 min');
    expect(timeAgo('2026-11-13T09:00:00Z', now)).toBe('3 h');
    expect(timeAgo('2026-11-11T12:00:00Z', now)).toBe('2 d');
  });
});
