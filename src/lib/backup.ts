import type { Cat, SetRecord, Wallet } from '../engine/types';
import type { CareItem } from '../engine/care';
import { localDay } from '../engine/day';

/* The backup file from Settings → App → Download a backup, and reading one back in ("Restore from a backup").
   Format 1 is { app: 'PalDex', format: 1, exported, cats, sets, care, wallet }; files saved before `format` was added
   have the same shape and count as format 1. */

export const BACKUP_FORMAT = 1;

export interface Backup { app: 'PalDex'; format: number; exported: string; cats: Cat[]; sets: SetRecord[]; care: CareItem[]; wallet: Wallet[] }

/** What a backup holds, for the preview before restoring it. */
export interface BackupSummary { pets: string[]; days: number; documents: number; exported: string }

export type BackupRead = { ok: true; backup: Backup; summary: BackupSummary } | { ok: false; error: string };

const NOT_OURS = 'This isn’t a PalDex backup. Choose the .json file that “Download a backup” saved.';
const OLD = 'This backup is from an older version of PalDex and can’t be restored here.';
const NEWER = 'This backup is from a newer version of PalDex. Reload the app to update it, then try again.';

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Build the file's contents from what's on this phone. */
export function makeBackup(data: Pick<Backup, 'cats' | 'sets' | 'care' | 'wallet'>, now = new Date()): Backup {
  return { app: 'PalDex', format: BACKUP_FORMAT, exported: now.toISOString(), cats: data.cats, sets: data.sets,
    care: data.care.map(({ dirty: _d, ...c }: CareItem & { dirty?: number }) => c as CareItem), wallet: data.wallet };
}

/** Check a picked file's text. Rows that are missing their ids are dropped; a file with no pets is refused. */
export function readBackup(text: string): BackupRead {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: NOT_OURS }; }
  if (!obj(raw) || raw.app !== 'PalDex') return { ok: false, error: NOT_OURS };
  const format = raw.format === undefined ? 1 : raw.format;
  if (!num(format) || format < 1) return { ok: false, error: OLD };
  if (format > BACKUP_FORMAT) return { ok: false, error: NEWER };
  if (!Array.isArray(raw.cats) || !Array.isArray(raw.sets)) return { ok: false, error: OLD };
  const cats = raw.cats.filter((c): c is Cat => obj(c) && str(c.id) && str(c.name) && num(c.createdAt));
  if (!cats.length) return { ok: false, error: 'This backup has no pets in it, so there’s nothing to restore.' };
  const ids = new Set(cats.map((c) => c.id));
  const sets = raw.sets.filter((s): s is SetRecord => obj(s) && str(s.id) && str(s.catId) && ids.has(s.catId) && num(s.at) && str(s.day) && str(s.skillId));
  const care = (Array.isArray(raw.care) ? raw.care : []).filter((c): c is CareItem & { dirty?: number } => obj(c) && str(c.id) && str(c.catId) && ids.has(c.catId) && str(c.kind) && num(c.at) && num(c.updatedAt))
    .map(({ dirty: _d, ...c }) => c as CareItem);
  const wallet = (Array.isArray(raw.wallet) ? raw.wallet : []).filter((w): w is Wallet => obj(w) && str(w.catId) && ids.has(w.catId));
  const backup: Backup = { app: 'PalDex', format, exported: str(raw.exported) ? raw.exported : '', cats, sets, care, wallet };
  return { ok: true, backup, summary: summarize(backup) };
}

/** Pets by name, the number of days with anything logged (training or health), and how many documents. */
export function summarize(b: Backup): BackupSummary {
  const live = b.care.filter((c) => !c.deleted);
  const days = new Set([...b.sets.map((s) => s.day), ...live.filter((c) => c.kind !== 'doc' && c.kind !== 'food').map((c) => localDay(c.at))]);
  return { pets: [...b.cats].sort((a, c) => a.createdAt - c.createdAt).map((c) => c.name), days: days.size, documents: live.filter((c) => c.kind === 'doc').length, exported: b.exported };
}
