import { describe, it, expect } from 'vitest';
import { petText } from './pet';

describe('petText', () => {
  it('leaves Chester as he is', () => expect(petText('Chester is proud of himself', { name: 'Chester' })).toBe('Chester is proud of himself'));
  it('uses the pet’s name and she/her for a girl', () => {
    expect(petText('Chester is proud of himself. Give him his treat; he earned it, good boy.', { name: 'Luna', sex: 'f' }))
      .toBe('Luna is proud of herself. Give her her treat; she earned it, good girl.');
  });
  it('does not touch words that merely contain he/his', () => expect(petText('The other theme: this cat helps', { name: 'Luna', sex: 'f' })).toBe('The other theme: this cat helps'));
});
