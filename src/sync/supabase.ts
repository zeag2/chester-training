import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Cat, SetRecord } from '../engine/types';
import type { CareItem } from '../engine/care';
import type { Account, Member, Remote } from './remote';

const toAccount = (u: User | null | undefined): Account | null => (u ? { userId: u.id, email: u.email ?? '' } : null);
const check = <T,>(r: { data: T; error: { message: string } | null }): T => { if (r.error) throw new Error(r.error.message); return r.data; };

export class SupabaseRemote implements Remote {
  sb: SupabaseClient;
  constructor(url: string, key: string) {
    this.sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'chester-auth' } });
  }

  async account() { const { data } = await this.sb.auth.getSession(); return toAccount(data.session?.user); }
  onAccountChange(fn: (a: Account | null) => void) {
    const { data } = this.sb.auth.onAuthStateChange((_e, s) => fn(toAccount(s?.user)));
    return () => data.subscription.unsubscribe();
  }
  async signIn(email: string, password: string) {
    const r = await this.sb.auth.signInWithPassword({ email, password });
    if (r.error) throw new Error(/invalid login credentials/i.test(r.error.message) ? 'bad-login' : r.error.message);
    return toAccount(r.data.user)!;
  }
  async signUp(email: string, password: string) {
    const r = await this.sb.auth.signUp({ email, password });
    if (r.error) throw new Error(/already registered|already exists/i.test(r.error.message) ? 'email-taken' : r.error.message);
    // With "Confirm email" on, Supabase hides taken emails and returns no session
    if (!r.data.session) throw new Error('confirm-email-on');
    return toAccount(r.data.user)!;
  }
  async signOut() { await this.sb.auth.signOut(); }

  async myCatIds() {
    const a = await this.account(); if (!a) return [];
    const rows = check(await this.sb.from('cat_members').select('cat_id, joined_at').eq('user_id', a.userId).order('joined_at'));
    return (rows ?? []).map((r) => r.cat_id as string);
  }
  async getCat(id: string) {
    const r = check(await this.sb.from('cats').select('data, invite_code').eq('id', id).maybeSingle());
    return r ? { cat: { ...(r.data as Cat), id }, inviteCode: r.invite_code as string } : null;
  }
  async createCat(cat: Cat) { check(await this.sb.from('cats').insert({ id: cat.id, data: cat })); }
  async updateCat(cat: Cat) { check(await this.sb.from('cats').update({ data: cat }).eq('id', cat.id)); }
  async join(code: string, name: string) { return check(await this.sb.rpc('join_cat', { code, name })) as string | null; }
  async members(catId: string): Promise<Member[]> {
    const rows = check(await this.sb.from('cat_members').select('user_id, display_name').eq('cat_id', catId).order('joined_at'));
    return (rows ?? []).map((r) => ({ userId: r.user_id as string, name: r.display_name as string }));
  }
  async setName(catId: string, name: string) {
    const a = await this.account(); if (!a) return;
    check(await this.sb.from('cat_members').update({ display_name: name.slice(0, 40) }).eq('cat_id', catId).eq('user_id', a.userId));
  }

  async pullSets(catId: string) {
    const out: SetRecord[] = []; const page = 1000;
    for (let from = 0; ; from += page) {
      const rows = check(await this.sb.from('sets').select('id, by_user, data').eq('cat_id', catId).order('at').order('id').range(from, from + page - 1)) ?? [];
      for (const r of rows) out.push({ ...(r.data as SetRecord), id: r.id as string, catId, by: r.by_user as string });
      if (rows.length < page) return out;
    }
  }
  async pushSets(sets: SetRecord[]) {
    if (!sets.length) return;
    const rows = sets.map((s) => ({ id: s.id, cat_id: s.catId, at: s.at, data: s }));
    check(await this.sb.from('sets').upsert(rows, { onConflict: 'id', ignoreDuplicates: true }));
  }

  async pullCare(catId: string) {
    const out: CareItem[] = []; const page = 1000;
    for (let from = 0; ; from += page) {
      const rows = check(await this.sb.from('care').select('id, kind, at, updated_at, deleted, by_user, data').eq('cat_id', catId).order('id').range(from, from + page - 1)) ?? [];
      for (const r of rows) out.push({ id: r.id, catId, kind: r.kind, at: Number(r.at), updatedAt: Number(r.updated_at), deleted: r.deleted, by: r.by_user ?? undefined, data: r.data } as CareItem);
      if (rows.length < page) return out;
    }
  }
  async pushCare(items: CareItem[]) {
    if (!items.length) return;
    const rows = items.map((i) => ({ id: i.id, cat_id: i.catId, kind: i.kind, at: i.at, updated_at: i.updatedAt, deleted: !!i.deleted, data: i.data }));
    check(await this.sb.from('care').upsert(rows, { onConflict: 'id' }));
  }
}
