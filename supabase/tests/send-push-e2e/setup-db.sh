#!/bin/bash
# throwaway Postgres 16 with all migrations, for the send-push end-to-end check
set -e
REPO=$(cd "$(dirname "$0")/../../.." && pwd)
PGB=/usr/lib/postgresql/16/bin
D=/tmp/pgpush; S=/tmp/pgx
su postgres -c "$PGB/pg_ctl -D $D stop -m fast" >/dev/null 2>&1 || true
rm -rf $D $S; mkdir -p $S; chown postgres $S
su postgres -c "$PGB/initdb -D $D -A trust >/dev/null"
su postgres -c "$PGB/pg_ctl -D $D -o '-k $S -p 5499 -c listen_addresses=127.0.0.1' -l $D/log start >/dev/null"
P="psql -h $S -p 5499 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "create database t"
P="$P -d t"
$P <<'SQL'
create role service_role nologin bypassrls;
create role authenticator login noinherit;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
SQL
$P -f $REPO/supabase/tests/stub_auth.sql
$P -f $REPO/supabase/tests/stub_storage.sql
$P -f $REPO/supabase/tests/stub_vault.sql
$P -c "grant anon, authenticated, service_role to authenticator; grant usage on schema public to service_role;"
# no pg_cron / pg_net here: stand-ins that record what would be scheduled
$P <<'SQL'
create schema cron; create table cron.job (jobname text primary key, schedule text, command text);
create function cron.schedule(n text, s text, c text) returns bigint language sql as
  $$ insert into cron.job values (n, s, c) on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command; select 1::bigint $$;
SQL
for f in $(ls $REPO/supabase/migrations/*.sql | sort); do
  if grep -q "^create extension if not exists pg_\(net\|cron\)" $f; then grep -v "^create extension if not exists pg_\(net\|cron\)" $f > /tmp/noext.sql; f=/tmp/noext.sql; fi
  $P -f $f
done
echo "db ready"
