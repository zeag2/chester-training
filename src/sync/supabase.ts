import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { Cat, SetRecord } from '../engine/types';
import type { CareItem, DocReading } from '../engine/care';
import type { Account, Friend, FriendPet, Member, PetCard, Remote } from './remote';

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

  // ---- households: people and pets together. Until the households SQL is run, each pet is shared on its own. ----
  private hasHouseholds: Promise<boolean> | null = null;
  private checkedAt = 0;
  /** Whether the households SQL has been run. A "no" is re-checked after a minute, so running it takes effect without a restart. */
  private households(): Promise<boolean> {
    if (this.hasHouseholds && Date.now() - this.checkedAt > 60_000) void this.hasHouseholds.then((ok) => { if (!ok) this.hasHouseholds = null; });
    if (!this.hasHouseholds) { this.checkedAt = Date.now(); this.hasHouseholds = Promise.resolve(this.sb.from('households').select('id').limit(1)).then((r) => !r.error, () => false); }
    return this.hasHouseholds;
  }
  private async householdOf(catId: string): Promise<{ id: string; code: string; owner: string } | null> {
    const k = await this.sb.from('cats').select('household_id').eq('id', catId).maybeSingle();
    const hid = (k.data as { household_id?: string } | null)?.household_id; if (!hid) return null;
    const h = check(await this.sb.from('households').select('id, invite_code, created_by').eq('id', hid).maybeSingle());
    return h ? { id: h.id as string, code: h.invite_code as string, owner: h.created_by as string } : null;
  }
  /** The household new pets go into: the given one, else one you're in, else a new one. */
  private async homeFor(preferred?: string): Promise<string> {
    if (preferred) return preferred;
    const a = await this.account();
    const mine = check(await this.sb.from('household_members').select('household_id, joined_at').eq('user_id', a!.userId).order('joined_at'));
    if (mine?.length) return mine[0].household_id as string;
    const made = check(await this.sb.from('households').insert({}).select('id').single());
    if (!made) throw new Error('Could not make a household');
    return made.id as string;
  }

  async myCatIds() {
    const a = await this.account(); if (!a) return [];
    if (await this.households()) {
      // every pet you can see: all pets in your households (row-level security decides)
      const rows = check(await this.sb.from('cats').select('id, created_at').order('created_at'));
      return (rows ?? []).map((r) => r.id as string);
    }
    const rows = check(await this.sb.from('cat_members').select('cat_id, joined_at').eq('user_id', a.userId).order('joined_at'));
    return (rows ?? []).map((r) => r.cat_id as string);
  }
  async getCat(id: string) {
    const r = check(await this.sb.from('cats').select('data, invite_code').eq('id', id).maybeSingle());
    if (!r) return null;
    const h = (await this.households()) ? await this.householdOf(id) : null;
    return { cat: { ...(r.data as Cat), id, householdId: h?.id }, inviteCode: h?.code ?? (r.invite_code as string) };
  }
  async createCat(cat: Cat) {
    if (await this.households()) {
      const hid = await this.homeFor(cat.householdId);
      check(await this.sb.from('cats').insert({ id: cat.id, data: { ...cat, householdId: hid }, household_id: hid }));
    } else check(await this.sb.from('cats').insert({ id: cat.id, data: cat }));
  }
  async updateCat(cat: Cat) { check(await this.sb.from('cats').update({ data: cat }).eq('id', cat.id)); }
  async join(code: string, name: string) {
    if (await this.households()) {
      const hid = check(await this.sb.rpc('join_household', { code, name })) as string | null;
      if (!hid) return null;
      const first = check(await this.sb.from('cats').select('id').eq('household_id', hid).order('created_at').limit(1));
      return (first?.[0]?.id as string | undefined) ?? '';
    }
    return check(await this.sb.rpc('join_cat', { code, name })) as string | null;
  }
  async members(catId: string): Promise<Member[]> {
    type Row = { user_id: string; display_name: string; email: string; sets_logged: number; is_owner: boolean };
    const map = (rows: Row[]) => rows.map((r) => ({ userId: r.user_id, name: r.display_name, email: r.email, sets: Number(r.sets_logged), owner: r.is_owner }));
    if (await this.households()) {
      const h = await this.householdOf(catId);
      if (h) { const p = await this.sb.rpc('household_people', { h: h.id }); if (!p.error && Array.isArray(p.data)) return map(p.data as Row[]); }
    }
    const people = await this.sb.rpc('cat_people', { c: catId });
    if (!people.error && Array.isArray(people.data)) return map(people.data as Row[]);
    const rows = check(await this.sb.from('cat_members').select('user_id, display_name').eq('cat_id', catId).order('joined_at'));
    return (rows ?? []).map((r) => ({ userId: r.user_id as string, name: r.display_name as string }));
  }
  async removeMember(catId: string, userId: string) {
    const h = (await this.households()) ? await this.householdOf(catId) : null;
    const r = h
      ? await this.sb.from('household_members').delete().eq('household_id', h.id).eq('user_id', userId).select('user_id')
      : await this.sb.from('cat_members').delete().eq('cat_id', catId).eq('user_id', userId).select('user_id');
    if (r.error) throw new Error(r.error.message);
    if (!r.data?.length) throw new Error('not-allowed');
  }
  async setName(catId: string, name: string) {
    const a = await this.account(); if (!a) return;
    const n = name.slice(0, 40);
    const h = (await this.households()) ? await this.householdOf(catId) : null;
    if (h) check(await this.sb.from('household_members').update({ display_name: n }).eq('household_id', h.id).eq('user_id', a.userId));
    await this.sb.from('cat_members').update({ display_name: n }).eq('cat_id', catId).eq('user_id', a.userId);
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

  async uploadDoc(path: string, file: Blob, mime: string) { check(await this.sb.storage.from('pet-docs').upload(path, file, { contentType: mime, upsert: false })); }
  async docUrl(path: string) { const d = check(await this.sb.storage.from('pet-docs').createSignedUrl(path, 600)); if (!d) throw new Error('No link'); return d.signedUrl; }
  async removeDoc(path: string) { await this.sb.storage.from('pet-docs').remove([path]); }
  async readDoc(path: string): Promise<DocReading> {
    const { data, error } = await this.sb.functions.invoke('read-vet-doc', { body: { path } });
    if (error) {
      // the function answers errors as { error: "…" }; show that message when there is one
      const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
      throw new Error(body?.error ?? (/not found|404/i.test(error.message) ? 'reader-missing' : error.message));
    }
    return (data as { result: DocReading }).result;
  }

  // ---- friends ----
  private async rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const r = await this.sb.rpc(fn, args);
    if (r.error) throw new Error(/could not find the function|does not exist|schema cache|PGRST202/i.test(r.error.message + (r.error as { code?: string }).code) ? 'friends-missing' : r.error.message);
    return r.data as T;
  }
  friendCode(name: string) { return this.rpc<string>('my_friend_code', { name }); }
  addFriend(code: string) { return this.rpc<string | null>('add_friend', { code }); }
  async friends(): Promise<Friend[]> { return ((await this.rpc<{ user_id: string; name: string }[]>('my_friends')) ?? []).map((r) => ({ userId: r.user_id, name: r.name })); }
  async friendPets(): Promise<FriendPet[]> {
    return ((await this.rpc<{ owner: string; owner_name: string; cat_id: string; card: PetCard }[]>('friend_pets')) ?? []).map((r) => ({ owner: r.owner, ownerName: r.owner_name, catId: r.cat_id, card: r.card }));
  }
  async removeFriend(userId: string) { await this.rpc('remove_friend', { friend: userId }); }
  async publishCard(catId: string, card: PetCard) { await this.rpc('set_pet_card', { c: catId, card }); }
}
