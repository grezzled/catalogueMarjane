#!/bin/bash
# One-command deploy for marjanecatalogue (cataloguemarjane.com):
# build locally, push .next + files to prod, restart the app.
#
#   npm run deploy
#
# Optional overrides (defaults below):
#   PROD_HOST=root@143.110.217.90  PROD_ROOT=/var/www/catalogueMarjane
#   PROD_SSH_KEY=~/.ssh/tkdia_prod   DRY_RUN=1 (preview)   SKIP_RESTART=1
#
# NEVER synced (prod owns them): *.db (SQLite data), .env, node_modules, .git
set -euo pipefail

PROD_HOST="${PROD_HOST:-root@143.110.217.90}"
PROD_ROOT="${PROD_ROOT:-/var/www/catalogueMarjane}"
PROD_SSH_KEY="${PROD_SSH_KEY:-$HOME/.ssh/tkdia_prod}"
PROD_PM2="${PROD_PM2:-catalogueMarjane}"
PROD_PORT="${PROD_PORT:-3006}"
DRY_RUN="${DRY_RUN:-0}"
SKIP_RESTART="${SKIP_RESTART:-0}"

SSH="ssh -i ${PROD_SSH_KEY} -o BatchMode=yes"
RSYNC_SSH="ssh -i ${PROD_SSH_KEY} -o BatchMode=yes"
if [ "$DRY_RUN" = "1" ]; then
  DRY="--dry-run"
  echo "*** DRY RUN — no transfers, no restart ***"
else
  DRY=""
fi

echo "==> 1/4 build locally"
if [ "$DRY_RUN" = "1" ]; then
  echo "(skipped: dry run — assuming .next is fresh)"
else
  npm run build
fi

echo "==> 2/4 push .next (build output, cache excluded)"
# shellcheck disable=SC2086
rsync -avz --delete $DRY --exclude "cache/" -e "$RSYNC_SSH" ".next/" "${PROD_HOST}:${PROD_ROOT}/.next/"

echo "==> 3/4 push uploads and store logos (prod *.db/.env untouched)"
for d in uploads stores; do
  if [ ! -d "public/$d" ]; then
    echo "→ $d (skipped: not present locally)"
    continue
  fi
  echo "→ $d"
  # shellcheck disable=SC2086
  rsync -avz --delete $DRY --exclude "*.db" -e "$RSYNC_SSH" "public/$d/" "${PROD_HOST}:${PROD_ROOT}/public/$d/"
done
# sitemap.xml is generated on prod from its own DB (marjane-sitemap cron),
# so pushing the local copy would publish local-only data.

if [ "$SKIP_RESTART" = "1" ]; then
  echo "==> 4/4 restart skipped (SKIP_RESTART=1) — run on server: pm2 restart ${PROD_PM2} --update-env"
else
  echo "==> 4/4 restart ${PROD_PM2} on prod (picks up new code + env)"
  # shellcheck disable=SC2086
  $SSH "$PROD_HOST" "pm2 restart ${PROD_PM2} --update-env && for i in 1 2 3 4 5 6; do sleep 10; code=\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${PROD_PORT}/); if [ \"\$code\" = 200 ]; then echo \"app:\$code (attempt \$i)\"; break; else echo \"waiting… (\$code, attempt \$i)\"; fi; done"
fi

echo "Done."
