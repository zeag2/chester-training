import { describe, it, expect } from 'vitest';
import { households } from './FriendsStrip';
import type { FriendPet } from '../sync/remote';

const pet = (owner: string, ownerName: string, name: string): FriendPet => ({ owner, ownerName, catId: name.toLowerCase(), card: { name } });

describe('households', () => {
  it('puts cats that live together on one tile, in the order they came', () => {
    const h = households([pet('e', 'Erin', 'Bijou'), pet('d', 'Dana', 'Mochi'), pet('e', 'Erin', 'Billie')]);
    expect(h.map((x) => [x.ownerName, x.pets.map((p) => p.card.name)])).toEqual([['Erin', ['Bijou', 'Billie']], ['Dana', ['Mochi']]]);
  });
});
