import Dexie, { type Table } from 'dexie';
import type { Cat, SessionDraft, SetRecord, SkillProgress, Wallet } from '../engine/types';

export type ProgressRow = SkillProgress & { catId: string };

export class ChesterDB extends Dexie {
  cats!: Table<Cat, string>;
  progress!: Table<ProgressRow, [string, string]>;
  sets!: Table<SetRecord, string>;
  wallet!: Table<Wallet, string>;
  drafts!: Table<SessionDraft, string>;
  constructor(name = 'chester') {
    super(name);
    this.version(1).stores({
      cats: 'id',
      progress: '[catId+skillId], catId',
      sets: 'id, catId, day, skillId, at',
      wallet: 'catId',
      drafts: 'catId',
    });
  }
}
