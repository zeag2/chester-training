import { describe, it, expect, beforeEach } from 'vitest';
import { captureInvite, inviteLink, inviteText, pendingFriend, setPendingFriend } from './invite';

describe('friend invites', () => {
  beforeEach(() => { localStorage.clear(); history.replaceState(null, '', '/'); });
  it('remembers the code from an invite link until it’s used', () => {
    history.replaceState(null, '', '/#/friends/k7q2mx'); captureInvite();
    expect(pendingFriend()).toBe('K7Q2MX');
    setPendingFriend(''); expect(pendingFriend()).toBe('');
    history.replaceState(null, '', '/?friend=ab12cd#/home'); captureInvite();
    expect(pendingFriend()).toBe('AB12CD');
  });
  it('ignores ordinary pages', () => { history.replaceState(null, '', '/#/friends'); captureInvite(); expect(pendingFriend()).toBe(''); });
  it('writes a link that opens the app with the code filled in', () => {
    expect(inviteLink('k7q2mx')).toBe(location.origin + '/#/friends/K7Q2MX');
    expect(inviteText('K7Q2MX', 'Chester & Luna')).toContain('so Chester & Luna can meet');
  });
});
