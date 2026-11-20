#!/usr/bin/env bash
# Builds the app the suite runs against, in a DDEV project of type generic: the
# app in site/, its packages installed in the web container (Node.js 24), built
# for production (`next build`) and served (`next start`) by the web container
# as a daemon, at https://<PROJECT_NAME>.ddev.site.
#
#   learn    the finished app of the official Learn course (the dashboard of
#            github.com/vercel/next-learn, MIT), made with create-next-app from
#            the course's own example, on the release below, with PostgreSQL in
#            a container of the project (TLS on, as the app asks for it), the
#            course's own seed, and the two accounts below.
#   default  the app create-next-app makes with its defaults (App Router).
#   pages    the official with-typescript example (Pages Router), at the tag of
#            the release.
#
# The project folder holds the app in site/ and nothing else of it, so a test
# project (cucumber.js, package.json, tests/) can live at the top without
# touching the app's own package.json.
#
# Settings (environment variables, all optional):
#   PROJECT_NAME      the DDEV project name                          (default nextjssteps)
#   SITE_DIR          the project folder                             (default a new temporary folder)
#   APP               learn, default or pages                        (default learn)
#   NEXT_VERSION      the release the app runs on                    (default 16.4.6)
#   LEARN_REF         the commit of github.com/vercel/next-learn     (default the one this pack was proven on)
#   SERVER_MODE       production (next build, then next start) or development (next dev)
#                                                                    (default production)
#   ACCOUNT_PASSWORD  the password of the accounts below             (default dD.123123ddd)
#   ACCOUNTS_ONLY     1: build nothing; give the accounts of the Learn app in
#                     SITE_DIR their name and password back
#   TEST_DATA_ONLY    1: build nothing; make the suite's own customers of the
#                     Learn app in SITE_DIR and their invoices again (after a
#                     run that was stopped half way)
#   SERVE_ONLY        1: build nothing; serve the app in SITE_DIR in SERVER_MODE
#                     (production builds it again first)
#
# The accounts are configuration: this script creates them in the Learn app's
# own users table and cucumber.js names them; the features never create or
# delete users. The course's own account stays as its seed makes it.
#   administrator  administrator@example.com  Administrator
#   editor         editor@example.com         Editor
#
# The suite's own test data, beside the course's: two customers, "Ivy Example"
# and "Oak Example" (at example.com), and their three invoices, with fixed ids
# (site/test-app.cjs). And one route of the pack's own in the Learn app:
# /api/auth/session, the session of the browser as JSON (site/session-route.ts),
# which the session steps read to say who is signed in.
#
# Nothing is installed that the apps do not bring: no hosted database, no
# account at any vendor, no telemetry (NEXT_TELEMETRY_DISABLED).
set -euo pipefail

PROJECT_NAME="${PROJECT_NAME:-nextjssteps}"
APP="${APP:-learn}"
NEXT_VERSION="${NEXT_VERSION:-16.4.6}"
LEARN_REF="${LEARN_REF:-bb2558441a6673ab76c89914c25018bffa27a2ba}"
SERVER_MODE="${SERVER_MODE:-production}"
ACCOUNT_PASSWORD="${ACCOUNT_PASSWORD:-dD.123123ddd}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="${SITE_DIR:-$(mktemp -d)}"
HOST="${PROJECT_NAME}.ddev.site"
SITE_URL="https://${HOST}"
APP_DIR=/var/www/html/site

case "$APP" in
  learn|default|pages) ;;
  *) echo "APP is learn, default or pages, not \"$APP\"." >&2; exit 1 ;;
esac
case "$SERVER_MODE" in
  production|development) ;;
  *) echo "SERVER_MODE is production or development, not \"$SERVER_MODE\"." >&2; exit 1 ;;
esac

mkdir -p "$SITE_DIR"
SITE_DIR="$(cd "$SITE_DIR" && pwd)"
cd "$SITE_DIR"

# A command in the app's folder in the web container, with stdin closed (an open
# stdin pipe keeps some tools waiting for input when this runs in the background).
in_app() {
  ddev exec -d "$APP_DIR" "$@" </dev/null
}

# The script of this repository that writes the accounts and the suite's own
# customers into the Learn app's tables (site/test-app.cjs), run with the app's
# own Node.js packages in its folder.
test_app() {
  cp "$REPO_DIR/site/test-app.cjs" "$SITE_DIR/site/.webship-test-app.cjs"
  local status=0
  in_app "ACCOUNT_PASSWORD='$ACCOUNT_PASSWORD' node .webship-test-app.cjs $*" || status=$?
  rm -f "$SITE_DIR/site/.webship-test-app.cjs"
  return $status
}

# The accounts of the Learn app (see the header).
write_accounts() {
  test_app accounts add "'[{\"name\":\"Administrator\",\"email\":\"administrator@example.com\"},{\"name\":\"Editor\",\"email\":\"editor@example.com\"}]'"
}

# Wait until the app's server answers on its own port in the web container.
wait_for_server() {
  local path="$1" attempt
  for attempt in $(seq 1 90); do
    if ddev exec "curl -fsS -o /dev/null http://127.0.0.1:3000${path}" </dev/null >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "The app's server did not answer at ${path}; its last lines:" >&2
  docker logs --tail 40 "ddev-${PROJECT_NAME}-web" 2>&1 | tail -40 >&2 || true
  return 1
}

# Stop the app's server, and wait until port 3000 is free: the server finishes
# the requests it has before it lets the port go, and a server started before
# that would find the port taken while the old one still answers. A server that
# keeps the port longer is stopped by its port.
stop_server() {
  ddev exec "supervisorctl stop webextradaemons:nextjs" </dev/null >/dev/null 2>&1 || true
  ddev exec 'for i in $(seq 1 20); do fuser 3000/tcp >/dev/null 2>&1 || exit 0; sleep 1; done; fuser -k -TERM 3000/tcp >/dev/null 2>&1; sleep 2; fuser -k -KILL 3000/tcp >/dev/null 2>&1; exit 0' </dev/null || true
}

# Serve the app the way SERVER_MODE says: the production build (built again
# first) or the development server.
serve() {
  stop_server
  echo "$SERVER_MODE" > "$SITE_DIR/.ddev/nextjs-mode"
  if [ "$SERVER_MODE" = "production" ]; then
    echo "Building the app for production (next build)."
    in_app "node_modules/.bin/next build"
  fi
  ddev exec "supervisorctl start webextradaemons:nextjs" </dev/null
  wait_for_server "$( [ "$APP" = learn ] && echo /login || echo / )"
}

if [ "${ACCOUNTS_ONLY:-}" = "1" ]; then
  write_accounts
  exit 0
fi
if [ "${TEST_DATA_ONLY:-}" = "1" ]; then
  test_app customers
  exit 0
fi
if [ "${SERVE_ONLY:-}" = "1" ]; then
  serve
  echo "Serving $APP ($SERVER_MODE) at $SITE_URL"
  exit 0
fi

# A project of this name somewhere else is somebody else's: never touch it.
if ddev describe "$PROJECT_NAME" -j </dev/null >/dev/null 2>&1; then
  EXISTING="$(ddev describe "$PROJECT_NAME" -j </dev/null 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin)['raw']['approot'])" || true)"
  if [ -n "$EXISTING" ] && [ "$EXISTING" != "$SITE_DIR" ]; then
    echo "A DDEV project named $PROJECT_NAME already lives at $EXISTING. Choose another PROJECT_NAME, or delete that project first." >&2
    exit 1
  fi
fi

# A generic project: the web container runs no web server of its own; the
# router sends ports 80 and 443 of the project's address to the app's server.
# PostgreSQL for the Learn app, no database for the others.
if [ "$APP" = "learn" ]; then
  ddev config --project-type=generic --webserver-type=generic --docroot="" --project-name="$PROJECT_NAME" \
    --nodejs-version=24 --database=postgres:17 </dev/null
else
  ddev config --project-type=generic --webserver-type=generic --docroot="" --project-name="$PROJECT_NAME" \
    --nodejs-version=24 --omit-containers=db </dev/null
fi

# Node.js 24 and pnpm (the Learn course's package manager) in the web image, so
# the app's server has them before the container's daemons start.
mkdir -p .ddev/web-build
cat > .ddev/web-build/Dockerfile.nextjs <<'DOCKEREOF'
# Node.js 24 and pnpm in the web image, so the app's server has them before the daemons start.
RUN N_PREFIX=/usr/local n install 24 && node --version && npm install -g pnpm@10.33.0 && pnpm --version
DOCKEREOF

# The app's server: the production build, or the development server when
# .ddev/nextjs-mode says so. It waits for the build rather than fail.
cat > .ddev/nextjs-serve.sh <<'SERVEEOF'
#!/usr/bin/env bash
# Serves the app on port 3000: its production build (next start), or the development server
# (next dev) when .ddev/nextjs-mode says "development". Run by the web container's supervisor.
cd /var/www/html/site 2>/dev/null || { sleep 5; exit 1; }
mode="$(cat /var/www/html/.ddev/nextjs-mode 2>/dev/null || echo production)"
if [ ! -x node_modules/.bin/next ]; then sleep 5; exit 1; fi
if [ "$mode" = "development" ]; then
  exec node_modules/.bin/next dev --port 3000 --hostname 0.0.0.0
fi
if [ ! -f .next/BUILD_ID ]; then sleep 5; exit 1; fi
exec node_modules/.bin/next start --port 3000 --hostname 0.0.0.0
SERVEEOF
chmod +x .ddev/nextjs-serve.sh
echo production > .ddev/nextjs-mode

cat > .ddev/config.nextjs.yaml <<'YAMLEOF'
# The app in this project. The web container serves no files of its own: the router sends ports
# 80 and 443 of the project's address to the app's server on port 3000, which the web container
# runs as a daemon (.ddev/nextjs-serve.sh).
web_environment:
  - NEXT_TELEMETRY_DISABLED=1
web_extra_exposed_ports:
  - name: nextjs
    container_port: 3000
    http_port: 80
    https_port: 443
web_extra_daemons:
  - name: nextjs
    command: "bash /var/www/html/.ddev/nextjs-serve.sh"
    directory: /var/www/html
YAMLEOF

if [ "$APP" = "learn" ]; then
  # PostgreSQL with TLS, as a hosted database has it: the Learn app connects
  # with ssl 'require'. The certificate is the self-signed one of the
  # PostgreSQL image, copied for the postgres user (PostgreSQL refuses a key
  # file it does not own); 'require' asks for no verification.
  mkdir -p .ddev/db-build
  cat > .ddev/db-build/Dockerfile.tls <<'DOCKEREOF'
# A copy of the image's self-signed certificate that the database server (the postgres user of
# the image) may read: PostgreSQL refuses a key file that it does not own or that others can read.
RUN mkdir -p /etc/postgresql-tls \
 && cp /etc/ssl/certs/ssl-cert-snakeoil.pem /etc/postgresql-tls/server.crt \
 && cp /etc/ssl/private/ssl-cert-snakeoil.key /etc/postgresql-tls/server.key \
 && chown -R postgres:postgres /etc/postgresql-tls \
 && chmod 600 /etc/postgresql-tls/server.key
DOCKEREOF
  cat > .ddev/docker-compose.postgres-tls.yaml <<'YAMLEOF'
# PostgreSQL with TLS, as a hosted database has it: the app connects with ssl 'require'.
services:
  db:
    command:
      - -c
      - config_file=/etc/postgresql/postgresql.conf
      - -c
      - hba_file=/etc/postgresql/pg_hba.conf
      - -c
      - ssl=on
      - -c
      - ssl_cert_file=/etc/postgresql-tls/server.crt
      - -c
      - ssl_key_file=/etc/postgresql-tls/server.key
YAMLEOF
fi

ddev start -y </dev/null

# The app, in site/.
rm -rf "$SITE_DIR/site"
case "$APP" in
  learn)
    # The course's own way to start from its example (`--example <url>`), at a
    # pinned commit, with pnpm (the course's package manager, which builds
    # bcrypt and sharp as its pnpm-workspace.yaml allows); then the release
    # this run is for (the course's lockfile pins an older one).
    ddev exec -d /var/www/html "npx -y create-next-app@${NEXT_VERSION} site --example 'https://github.com/vercel/next-learn/tree/${LEARN_REF}/dashboard/final-example' --use-pnpm --skip-install --disable-git --yes" </dev/null
    cat > "$SITE_DIR/site/.env" <<ENVEOF
# The database of this project (the db container), and the secret of the app's sessions.
POSTGRES_URL=postgres://db:db@db:5432/db
AUTH_SECRET=$(openssl rand -base64 32)
AUTH_URL=${SITE_URL}/api/auth
AUTH_TRUST_HOST=true
ENVEOF
    in_app "pnpm install --reporter=append-only"
    in_app "pnpm add next@${NEXT_VERSION} --reporter=append-only"
    # The course names its middleware proxy.ts, the name of the 16.x line; the
    # 15.x line reads the same file as middleware.ts.
    case "$NEXT_VERSION" in
      1[0-5].*)
        if [ -f "$SITE_DIR/site/proxy.ts" ] && [ ! -f "$SITE_DIR/site/middleware.ts" ]; then
          mv "$SITE_DIR/site/proxy.ts" "$SITE_DIR/site/middleware.ts"
        fi
        ;;
    esac
    # The one route of this pack's own: the session of the browser as JSON
    # (null when nobody is signed in), at the address the app's authentication
    # library answers when an app mounts its handlers; the course does not.
    mkdir -p "$SITE_DIR/site/app/api/auth/session"
    cp "$REPO_DIR/site/session-route.ts" "$SITE_DIR/site/app/api/auth/session/route.ts"
    ;;
  default)
    ddev exec -d /var/www/html "npx -y create-next-app@${NEXT_VERSION} site --yes --use-npm --disable-git --skip-install" </dev/null
    in_app "npm install --no-audit --no-fund"
    ;;
  pages)
    # The example at the tag of the release, so the run does not follow the
    # canary branch; it asks for next "latest": the release is pinned after.
    ddev exec -d /var/www/html "npx -y create-next-app@${NEXT_VERSION} site --example 'https://github.com/vercel/next.js/tree/v${NEXT_VERSION}/examples/with-typescript' --use-npm --skip-install --disable-git --yes" </dev/null
    in_app "npm install --no-audit --no-fund"
    in_app "npm install --no-audit --no-fund next@${NEXT_VERSION}"
    ;;
esac

# The development server answers at the project's address, not at localhost:
# the release refuses requests for its development resources (/_next/hmr) from
# another origin unless next.config names it (allowedDevOrigins).
python3 - "$SITE_DIR/site" "$HOST" <<'PYEOF'
import os, re, sys
site, host = sys.argv[1:3]
line = "  // The development server answers at the project's address, not at localhost.\n  allowedDevOrigins: ['%s'],\n" % host
for name in ('next.config.ts', 'next.config.mjs', 'next.config.js'):
    path = os.path.join(site, name)
    if os.path.exists(path):
        src = open(path).read()
        if 'allowedDevOrigins' in src:
            sys.exit(0)
        m = re.search(r'(const nextConfig[^=]*=\s*\{\s*\n|module\.exports\s*=\s*\{\s*\n)', src)
        if not m:
            sys.exit('%s has no config object this can add allowedDevOrigins to.' % name)
        open(path, 'w').write(src[:m.end()] + line + src[m.end():])
        sys.exit(0)
open(os.path.join(site, 'next.config.mjs'), 'w').write('/** @type {import("next").NextConfig} */\nconst nextConfig = {\n' + line + '};\n\nexport default nextConfig;\n')
PYEOF

if [ "$APP" = "learn" ]; then
  # The course seeds its database through the app's own /seed route, into an
  # empty database (a second seed would add the invoices again). Its three
  # tables that need the uuid-ossp extension create it at the same moment,
  # which the database refuses for all but one: the extension is made first.
  ddev exec "psql -h db -U db -d db -c 'DROP TABLE IF EXISTS users, customers, invoices, revenue' -c 'CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"'" </dev/null
  stop_server
  echo development > .ddev/nextjs-mode
  ddev exec "supervisorctl start webextradaemons:nextjs" </dev/null
  wait_for_server /login
  SEEDED="$(ddev exec "curl -sS http://127.0.0.1:3000/seed" </dev/null)"
  echo "Seed: $SEEDED"
  case "$SEEDED" in
    *"seeded successfully"*) ;;
    *) echo "The course's seed failed." >&2; exit 1 ;;
  esac
  test_app customers
  write_accounts
fi

serve

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
fi
RELEASE="$(in_app "node -p \"require('next/package.json').version\"" 2>/dev/null | tr -d '\r' || true)"
echo "Built the ${APP} app on ${RELEASE:-the release} (${SERVER_MODE}) at $SITE_URL"
