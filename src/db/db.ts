import Dexie, { type Table } from 'dexie';
import type { Cat, SessionDraft, SetRecord, SkillProgress, Wallet } from '../engine/types';
import type { CareItem } from '../engine/care';

/** A care item as kept on the phone; dirty = 1 until the shared copy has it. */
export type CareRow = CareItem & { dirty?: number };

export type ProgressRow = SkillProgress & { catId: string };

export class ChesterDB extends Dexie {
  cats!: Table<Cat, string>;
  progress!: Table<ProgressRow, [string, string]>;
  sets!: Table<SetRecord, string>;
  wallet!: Table<Wallet, string>;
  drafts!: Table<SessionDraft, string>;
  care!: Table<CareRow, string>;
  constructor(name = 'chester') {
    super(name);
    this.version(1).stores({
      cats: 'id',
      progress: '[catId+skillId], catId',
      sets: 'id, catId, day, skillId, at',
      wallet: 'catId',
      drafts: 'catId',
    });
    this.version(2).stores({ care: 'id, catId, dirty' });
  }
}
