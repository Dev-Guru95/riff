#!/usr/bin/env bash
#
# Push a commit (or your working tree) to the Riff STAGING environment.
#
#   ./scripts/deploy-staging.sh              # deploys HEAD
#   ./scripts/deploy-staging.sh my-branch    # deploys that ref
#   ./scripts/deploy-staging.sh --dirty      # deploys uncommitted work too
#
# Staging lives on the same VPS as production but shares nothing that matters:
# its own Postgres schema (riff_staging), its own secrets, Stripe TEST keys,
# its own uploads directory and its own pm2 process on port 4004.
#
# It has NO public URL. Reach it with:
#   ssh -L 4004:localhost:4004 riff-prod
# then open http://localhost:4004
#
# This script never touches production. The only shared resource is the
# Postgres server itself, and every statement is scoped to the staging schema
# by the DATABASE_URL in ~/apps/riff-staging/.env.
set -euo pipefail

HOST="${RIFF_STAGING_HOST:-riff-prod}"
APP_DIR="apps/riff-staging"
REF="${1:-HEAD}"
DIRTY=0
if [ "$REF" = "--dirty" ]; then DIRTY=1; REF="HEAD"; fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ARCHIVE="$TMP/riff-staging.tar.gz"

if [ "$DIRTY" = "1" ]; then
  echo "==> Packaging working tree (including uncommitted changes)"
  # Tracked files as they currently are on disk, ignoring .gitignore'd junk.
  git ls-files -z | tar -czf "$ARCHIVE" --null -T -
else
  echo "==> Packaging $REF ($(git rev-parse --short "$REF"))"
  git archive --format=tar.gz -o "$ARCHIVE" "$REF"
fi

echo "==> Uploading to $HOST"
ssh "$HOST" 'mkdir -p ~/tmp'
scp -q "$ARCHIVE" "$HOST:~/tmp/riff-staging.tar.gz"

echo "==> Unpacking, building and restarting staging"
ssh "$HOST" 'set -euo pipefail
cd ~/'"$APP_DIR"'
# Keep the env and pm2 config; replace the code.
cp .env /tmp/riff-staging.env
cp ecosystem.config.js /tmp/riff-staging.ecosystem.js
find . -mindepth 1 -maxdepth 1 \
  ! -name node_modules ! -name .next ! -name .env ! -name ecosystem.config.js \
  -exec rm -rf {} +
tar -xzf ~/tmp/riff-staging.tar.gz -C .
cp /tmp/riff-staging.env .env
cp /tmp/riff-staging.ecosystem.js ecosystem.config.js
chmod 600 .env

# Refuse to continue if this env ever stops being test-mode and isolated.
grep -q "schema=riff_staging" .env || { echo "ABORT: staging .env is not pointed at the staging schema"; exit 1; }
grep -q "sk_test" .env || { echo "ABORT: staging .env does not hold a Stripe TEST key"; exit 1; }

pnpm install --frozen-lockfile 2>&1 | tail -2
npx prisma generate 2>&1 | tail -1
npx prisma migrate deploy 2>&1 | tail -3
pnpm run build 2>&1 | tail -4
pm2 restart riff-staging --update-env >/dev/null
sleep 4
pm2 describe riff-staging | grep -E "^│ status" | head -1
rm -f ~/tmp/riff-staging.tar.gz'

echo
echo "==> Staging updated."
echo "    Tunnel:  ssh -L 4004:localhost:4004 $HOST"
echo "    Open:    http://localhost:4004"
