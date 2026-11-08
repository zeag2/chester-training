import { describe, it, expect, vi, afterEach } from 'vitest';
import { byBarcode, guessType, sameCode, search, toHit, validBarcode } from './petfood';

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
  it('accepts only barcodes with a correct check digit', () => {
    expect(validBarcode('036000291452')).toBe(true);   // UPC-A
    expect(validBarcode('036000291453')).toBe(false);  // one digit misread
    expect(validBarcode('4006381333931')).toBe(true);  // EAN-13
    expect(validBarcode('96385074')).toBe(true);       // EAN-8
    expect(validBarcode('12345')).toBe(false);
  });
  it('asks Open Food Facts when the pet database doesn’t know a barcode', async () => {
    const f = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => (url.startsWith('https://world.openfoodfacts.org') ? { status: 1, product: { code: '0829274512527', product_name: 'Meow Mix Tender Centers', categories_tags: ['en:cat-food'] } } : { status: 0 }) }));
    vi.stubGlobal('fetch', f);
    expect(await byBarcode('829274512527')).toMatchObject({ name: 'Meow Mix Tender Centers' });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('tells “not found” apart from “couldn’t reach the databases”', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ status: 0 }) })));
    expect(await byBarcode('036000291452')).toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(byBarcode('036000291452')).rejects.toThrow();
  });
  it('matches barcodes with or without leading zeros', () => {
    expect(sameCode('0050000429745', '050000429745')).toBe(true);
    expect(sameCode('0050000429745', '050000429746')).toBe(false);
  });
  it('lists cat foods before other matches when searching', async () => {
    reply({ products: [{ code: '1', product_name: 'Dog chews', categories_tags: ['en:dog-treats'] }, { code: '2', product_name: 'Kitten chicken pate', categories_tags: ['en:cat-food'] }] });
    expect((await search('chicken')).map((h) => h.code)).toEqual(['2', '1']);
  });
});
