import { describe, it, expect, beforeEach } from 'vitest';
import { setPendingRecovery, takePendingRecovery, takeRecoveryFromUrl } from './recovery';
import { Store } from '../db/store';
import { FakeServer } from '../sync/fake';

describe('password reset links', () => {
  beforeEach(() => { setPendingRecovery(null); history.replaceState(null, '', '/'); });
  it('takes the tokens out of the address bar and opens the new-password page', () => {
    history.replaceState(null, '', '/#access_token=AT&expires_in=3600&refresh_token=RT&token_type=bearer&type=recovery');
    expect(takeRecoveryFromUrl()).toBe(true);
    expect(location.hash).toBe('#/reset-password');
    expect(location.href).not.toContain('AT');
    expect(takePendingRecovery()).toEqual({ accessToken: 'AT', refreshToken: 'RT' });
    expect(takePendingRecovery()).toBeNull();
  });
  it('turns an expired link into an error on that page', () => {
    history.replaceState(null, '', '/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid');
    expect(takeRecoveryFromUrl()).toBe(true);
    expect(takePendingRecovery()).toEqual({ error: 'otp_expired' });
  });
  it('leaves ordinary pages and other links alone', () => {
    for (const u of ['/#/home', '/#/friends/K7Q2MX', '/#access_token=AT&refresh_token=RT&type=signup']) {
      history.replaceState(null, '', u); expect(takeRecoveryFromUrl()).toBe(false); expect(location.pathname + location.hash).toBe(u);
    }
  });
  it('sends the email, signs in from the link and saves the new password', async () => {
    const server = new FakeServer();
    const a = new Store('reset-a', server.device()); await a.load();
    await a.signIn('josh@example.com', 'catnip1', 'Josh', false, true); await a.signOut();
    const b = new Store('reset-b', server.device()); await b.load();
    await b.forgotPassword(' Josh@Example.com ', 'https://example.com/app/');
    expect(server.resets).toEqual(['josh@example.com']);
    await expect(b.startRecovery('bogus', 'x')).rejects.toThrow('link-expired');
    await b.startRecovery('reset:josh@example.com', 'x');
    expect(b.get().account?.email).toBe('josh@example.com');
    await expect(b.setPassword('catnip1')).rejects.toThrow('same-password');
    await b.setPassword('newpass1');
    const c = new Store('reset-c', server.device()); await c.load();
    await expect(c.signIn('josh@example.com', 'catnip1', '', false)).rejects.toThrow('bad-login');
    await c.signIn('josh@example.com', 'newpass1', '', false);
    expect(c.get().account?.email).toBe('josh@example.com');
  });
});
