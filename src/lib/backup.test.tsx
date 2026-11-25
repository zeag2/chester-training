import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { Store, store } from '../db/store';
import { readBackup, BACKUP_FORMAT } from './backup';
import { Restore } from '../screens/Settings';

const catInput = { name: 'Chester', birthday: '2026-04', homeDate: '2026-11-01', breed: 'American Shorthair', coat: 'black', eyes: 'gold', rewards: ['treats'], outfit: '' };

async function phone(name: string, cat = 'Chester') {
  const s = new Store(name); s.rand = () => 0.5; await s.load();
  await s.saveCat({ ...catInput, name: cat });
  await s.logSet({ skillId: 'clicker', reps: 10, good: 9, mood: 'Happy', seconds: 90 });
  await s.saveCare('weight', { lb: 9.5 });
  await s.saveCare('doc', { title: 'Vaccines', path: 'x/y.pdf', mime: 'application/pdf', bytes: 10 });
  await s.settled();
  return s;
}
const fileOf = async (s: Store) => JSON.stringify(await s.backup());

describe('reading a backup file', () => {
  it('previews pets, days of logs and documents', async () => {
    const r = readBackup(await fileOf(await phone('bk1')));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.format).toBe(BACKUP_FORMAT);
    expect(r.summary.pets).toEqual(['Chester']);
    expect(r.summary.days).toBe(1);
    expect(r.summary.documents).toBe(1);
  });
  it('takes files saved before the format number was added', async () => {
    const old = JSON.parse(await fileOf(await phone('bk2'))); delete old.format;
    expect(readBackup(JSON.stringify(old)).ok).toBe(true);
  });
  it('says clearly what is wrong with a wrong or old file', () => {
    const err = (t: string) => { const r = readBackup(t); return r.ok ? '' : r.error; };
    expect(err('not json')).toMatch(/isn’t a PalDex backup/);
    expect(err('{"app":"Other","cats":[]}')).toMatch(/isn’t a PalDex backup/);
    expect(err('[1,2]')).toMatch(/isn’t a PalDex backup/);
    expect(err('{"app":"PalDex","exported":"x"}')).toMatch(/older version/);
    expect(err('{"app":"PalDex","format":0,"cats":[],"sets":[]}')).toMatch(/older version/);
    expect(err('{"app":"PalDex","format":99,"cats":[],"sets":[]}')).toMatch(/newer version/);
    expect(err('{"app":"PalDex","format":1,"cats":[],"sets":[]}')).toMatch(/no pets/);
  });
});

describe('restoring a backup', () => {
  it('merge adds what is missing, never a second copy, and Undo puts the phone back', async () => {
    const src = await phone('bk3');
    const r = readBackup(await fileOf(src)); if (!r.ok) throw new Error(r.error);
    const dst = await phone('bk4', 'Mochi');
    const before = { sets: await dst.db.sets.count(), care: await dst.db.care.count() };
    const first = await dst.importBackup(r.backup, 'merge');
    expect(first.changed).toBe(1 + 1 + 2);
    expect((await dst.db.cats.toArray()).map((c) => c.name).sort()).toEqual(['Chester', 'Mochi']);
    expect(dst.get().cat?.name).toBe('Mochi');
    const again = await dst.importBackup(r.backup, 'merge');
    expect(again.changed).toBe(0);
    expect(await dst.db.sets.count()).toBe(before.sets + 1);
    expect(await dst.db.care.count()).toBe(before.care + 2);
    await first.undo();
    expect((await dst.db.cats.toArray()).map((c) => c.name)).toEqual(['Mochi']);
    expect(await dst.db.sets.count()).toBe(before.sets);
    expect(dst.get().cat?.name).toBe('Mochi');
  });
  it('replace swaps this phone for the backup; Undo brings it back', async () => {
    const r = readBackup(await fileOf(await phone('bk5'))); if (!r.ok) throw new Error(r.error);
    const dst = await phone('bk6', 'Mochi');
    const { undo } = await dst.importBackup(r.backup, 'replace');
    expect((await dst.db.cats.toArray()).map((c) => c.name)).toEqual(['Chester']);
    expect(dst.get().cat?.name).toBe('Chester');
    expect(dst.get().sets).toHaveLength(1);
    await undo();
    expect((await dst.db.cats.toArray()).map((c) => c.name)).toEqual(['Mochi']);
    expect(dst.get().cat?.name).toBe('Mochi');
  });
});

describe('the Restore sheet', () => {
  afterEach(() => cleanup());
  it('shows the error and a way to pick another file', () => {
    const r = readBackup('nope'); let picked = 0;
    render(<Restore read={r} onPick={() => picked++} onClose={() => {}} />);
    expect(screen.getByRole('alert').textContent).toMatch(/isn’t a PalDex backup/);
    fireEvent.click(screen.getByText('Choose another file'));
    expect(picked).toBe(1);
  });
  it('previews the file, merges by default and asks in the app before replacing', async () => {
    await store.load();
    const r = readBackup(await fileOf(await phone('bk7'))); if (!r.ok) throw new Error(r.error);
    render(<Restore read={r} onPick={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Days of logs')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Merge' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('Merge into this phone')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    fireEvent.click(screen.getByText('Replace…'));
    expect(screen.getByText('Replace everything')).toBeTruthy();
    fireEvent.click(screen.getByText('Keep what’s here'));
    expect(screen.queryByText('Replace everything')).toBeNull();
  });
});
