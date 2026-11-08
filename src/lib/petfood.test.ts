import { describe, it, expect, vi, afterEach } from 'vitest';
import { byBarcode, guessType, search, toHit } from './petfood';

afterEach(() => vi.unstubAllGlobals());
const reply = (body: unknown, ok = true) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body })));

describe('pet food lookup', () => {
  it('guesses wet, dry or treat from categories and name', () => {
    expect(guessType({ name: 'Classic Pâté Chicken Feast', tags: ['en:cat-food'] })).toBe('wet');
    expect(guessType({ name: 'Indoor Formula', tags: ['en:dry-cat-food'] })).toBe('dry');
    expect(guessType({ name: 'Temptations Tasty Chicken', tags: ['en:cat-food'] })).toBe('treat');
    expect(guessType({ name: 'Mystery', tags: [] })).toBe('other');
  });
  it('turns a product into a food entry, preferring English text and the first brand', () => {
    const h = toHit({ code: '123', product_name: 'Pâté poulet', product_name_en: 'Chicken pâté', brands: 'Fancy Feast,Purina', categories_tags: ['en:wet-cat-food'], ingredients_text_en: 'Chicken, liver' });
    expect(h).toMatchObject({ name: 'Chicken pâté', brand: 'Fancy Feast', type: 'wet', ingredients: 'Chicken, liver', forCats: true });
    expect(toHit({ code: '1' })).toBeNull();
  });
  it('finds a product by barcode, and returns null when it is unknown', async () => {
    reply({ status: 1, product: { code: '0050000123456', product_name: 'Salmon kibble', brands: 'Acme', categories_tags: ['en:dry-cat-food'] } });
    expect(await byBarcode('0 50000 12345 6')).toMatchObject({ name: 'Salmon kibble', type: 'dry' });
    reply({ status: 0 });
    expect(await byBarcode('00500001234')).toBeNull();
    expect(await byBarcode('12')).toBeNull();
  });
  it('lists cat foods before other matches when searching', async () => {
    reply({ products: [{ code: '1', product_name: 'Dog chews', categories_tags: ['en:dog-treats'] }, { code: '2', product_name: 'Kitten chicken pate', categories_tags: ['en:cat-food'] }] });
    expect((await search('chicken')).map((h) => h.code)).toEqual(['2', '1']);
  });
});
