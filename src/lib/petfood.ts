/* Food and treat lookup from Open Pet Food Facts (free, open data, no key). Barcode or name → name, brand, type, ingredients. */
import type { FoodType } from '../engine/care';

const API = 'https://world.openpetfoodfacts.org';
const FIELDS = 'code,product_name,product_name_en,brands,categories_tags,ingredients_text,ingredients_text_en,quantity,image_front_small_url';

export interface FoodHit { code: string; name: string; brand?: string; type: FoodType; ingredients?: string; quantity?: string; image?: string; forCats: boolean }

interface OffProduct { code?: string; product_name?: string; product_name_en?: string; brands?: string; categories_tags?: string[]; ingredients_text?: string; ingredients_text_en?: string; quantity?: string; image_front_small_url?: string }

/** Wet, dry or treat from the product's categories and name. */
export function guessType(p: { name: string; tags: string[] }): FoodType {
  const t = p.tags.join(' ') + ' ' + p.name.toLowerCase();
  if (/treat|snack|stick|crunch|lickable|puree|purée|temptation|greenies|chew/.test(t)) return 'treat';
  if (/wet|p[aâ]t[eé]|gravy|chunks|jelly|loaf|mousse|stew|broth|can\b|canned|pouch|sauce/.test(t)) return 'wet';
  if (/dry|kibble|croquette|biscuit/.test(t)) return 'dry';
  return 'other';
}

export function toHit(p: OffProduct): FoodHit | null {
  const name = (p.product_name_en || p.product_name || '').trim();
  if (!name || !p.code) return null;
  const tags = p.categories_tags ?? [];
  const brand = p.brands?.split(',')[0]?.trim() || undefined;
  return {
    code: p.code, name, brand, type: guessType({ name, tags }),
    ingredients: (p.ingredients_text_en || p.ingredients_text || '').trim() || undefined,
    quantity: p.quantity || undefined, image: p.image_front_small_url || undefined,
    forCats: tags.some((x) => /cat/.test(x)) || /\bcat|kitten|feline/i.test(name),
  };
}

async function get(url: string, signal?: AbortSignal) {
  const r = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('Lookup failed (' + r.status + ')');
  return r.json();
}

/** One product by barcode, or null when the database doesn't know it. */
export async function byBarcode(code: string, signal?: AbortSignal): Promise<FoodHit | null> {
  const clean = code.replace(/\D/g, ''); if (clean.length < 8) return null;
  const j = await get(`${API}/api/v2/product/${clean}.json?fields=${FIELDS}`, signal);
  return j?.status === 1 && j.product ? toHit({ ...j.product, code: j.product.code ?? clean }) : null;
}

/** Products matching a name or brand; cat foods first. */
export async function search(q: string, signal?: AbortSignal): Promise<FoodHit[]> {
  const terms = q.trim(); if (terms.length < 2) return [];
  const j = await get(`${API}/cgi/search.pl?search_terms=${encodeURIComponent(terms)}&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}`, signal);
  const hits = ((j?.products ?? []) as OffProduct[]).map(toHit).filter((h): h is FoodHit => !!h);
  return hits.sort((a, b) => Number(b.forCats) - Number(a.forCats)).slice(0, 12);
}
