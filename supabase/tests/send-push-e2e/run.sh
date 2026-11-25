#!/bin/bash
# End-to-end check of the send-push Edge Function (not run in CI): the real function in Deno, PostgREST 12 and a
# throwaway Postgres 16 with every migration, sending to a fake HTTPS push service that decrypts each push.
# Needs: root (for the postgres user), Postgres 16 at /usr/lib/postgresql/16, and network for Deno, PostgREST and npm.
# Usage: supabase/tests/send-push-e2e/run.sh
set -e
HERE=$(cd "$(dirname "$0")" && pwd); T=${E2E_TMP:-/tmp/send-push-e2e/}; mkdir -p $T; export E2E_TMP=$T
[ -x $T/deno/node_modules/.bin/deno ] || (mkdir -p $T/deno && cd $T/deno && npm init -y >/dev/null && npm i deno@2.9.6 >/dev/null)
DENO=$T/deno/node_modules/.bin/deno
[ -x $T/postgrest ] || (cd $T && curl -sSfL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz | tar xJ)
[ -f $T/cert.pem ] || openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout $T/key.pem -out $T/cert.pem -days 30 -subj /CN=127.0.0.1 -addext subjectAltName=IP:127.0.0.1 2>/dev/null
SECRET=e2e-secret-e2e-secret-e2e-secret-32
$DENO eval "const e=(o)=>btoa(JSON.stringify(o)).replace(/=+\$/,'').replace(/\+/g,'-').replace(/\//g,'_');const h=e({alg:'HS256',typ:'JWT'}),p=e({role:'service_role',exp:2000000000});const k=await crypto.subtle.importKey('raw',new TextEncoder().encode('$SECRET'),{name:'HMAC',hash:'SHA-256'},false,['sign']);const s=new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(h+'.'+p)));console.log(h+'.'+p+'.'+btoa(String.fromCharCode(...s)).replace(/=+\$/,'').replace(/\+/g,'-').replace(/\//g,'_'))" > $T/service.jwt
"$HERE/setup-db.sh"
printf 'db-uri = "postgres://authenticator@/t?host=/tmp/pgx&port=5499"\ndb-schemas = "public"\ndb-anon-role = "anon"\njwt-secret = "%s"\nserver-port = 3000\n' $SECRET > $T/pg.conf
pkill -f "postgrest $T/pg.conf" 2>/dev/null || true
$T/postgrest $T/pg.conf > $T/postgrest.log 2>&1 & PGRST=$!; sleep 2
cd $T && $DENO run -A --no-lock --node-modules-dir=none --unsafely-ignore-certificate-errors=127.0.0.1 "$HERE/e2e.ts"; R=$?
kill $PGRST; exit $R
