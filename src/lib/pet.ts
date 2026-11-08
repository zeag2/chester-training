import { useStore } from '../db/store';

export type Sex = 'm' | 'f';
const SHE: Record<string, string> = { he: 'she', He: 'She', HE: 'SHE', him: 'her', Him: 'Her', his: 'her', His: 'Her', himself: 'herself', Himself: 'Herself', boy: 'girl', Boy: 'Girl' };

/** Texts are written for a boy named Chester; this fits them to the pet: the pet's own name, and she/her for a girl. */
export function petText(s: string, pet?: { name: string; sex?: Sex } | null): string {
  if (!s || !pet) return s;
  let out = pet.name && pet.name !== 'Chester' ? s.replace(/\bChester\b/g, pet.name) : s;
  if (pet.sex === 'f') out = out.replace(/\b(he|He|HE|him|Him|his|His|himself|Himself|boy|Boy)\b/g, (m) => SHE[m] ?? m);
  return out;
}

/** t(text) for the current pet. */
export function usePetText() {
  const { cat } = useStore();
  return (s: string) => petText(s, cat);
}
