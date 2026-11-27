-- Stand-in for Supabase Vault and the service_role role, for testing on plain Postgres (load after stub_auth.sql).
-- Fake values only: the real secrets live in the project's Vault.
do $$ begin if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin; end if; end $$;
grant usage on schema public to service_role;
create schema if not exists vault;
create table if not exists vault.secrets (name text primary key, secret text not null);
create or replace view vault.decrypted_secrets as select name, secret as decrypted_secret from vault.secrets;
revoke all on schema vault from public;
