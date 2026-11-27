-- Push keys from Vault (2026-11-27). The send-push Edge Function reads its four keys from Vault through this
-- function, so nobody has to type the VAPID private key into Edge Function secrets. Safe to run twice.
-- Needs the Vault secrets push_cron_key, push_vapid_public, push_vapid_private and push_vapid_subject (they exist).
-- Only the service role (the Edge Function's own client) can call it: never anon or signed-in people.

create or replace function public.push_secrets()
returns table (cron_key text, vapid_public text, vapid_private text, vapid_subject text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_key'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_public'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_private'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'push_vapid_subject');
$$;

revoke execute on function public.push_secrets() from public, anon, authenticated;
grant execute on function public.push_secrets() to service_role;

comment on function public.push_secrets() is 'send-push only (service role): its four keys from Vault.';
