#!/usr/bin/env bash
set -euo pipefail

UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-upstream}"
ORIGIN_REMOTE="${ORIGIN_REMOTE:-origin}"
MAIN_BRANCH="${MAIN_BRANCH:-main}"
BRAND_BRANCH="${BRAND_BRANCH:-feature/feiye-branding}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-deploy/tencent}"

ROOT_DIR="$(git rev-parse --show-toplevel)"
CURRENT_BRANCH="$(git branch --show-current)"

cd "$ROOT_DIR"

echo "==> Fetch remotes..."
git fetch "$UPSTREAM_REMOTE" "$MAIN_BRANCH"
git fetch "$ORIGIN_REMOTE" --prune

echo "==> Update $MAIN_BRANCH from $UPSTREAM_REMOTE/$MAIN_BRANCH..."
git checkout "$MAIN_BRANCH"
git merge --ff-only "$UPSTREAM_REMOTE/$MAIN_BRANCH"
git push "$ORIGIN_REMOTE" "$MAIN_BRANCH"

echo "==> Rebase $BRAND_BRANCH onto $MAIN_BRANCH..."
git checkout "$BRAND_BRANCH"
git rebase "$MAIN_BRANCH"
git push "$ORIGIN_REMOTE" "$BRAND_BRANCH" --force-with-lease

if git show-ref --verify --quiet "refs/remotes/$ORIGIN_REMOTE/$DEPLOY_BRANCH"; then
  echo "==> Rebase $DEPLOY_BRANCH onto $BRAND_BRANCH..."
  if git show-ref --verify --quiet "refs/heads/$DEPLOY_BRANCH"; then
    git checkout "$DEPLOY_BRANCH"
  else
    git checkout -b "$DEPLOY_BRANCH" "$ORIGIN_REMOTE/$DEPLOY_BRANCH"
  fi

  git rebase "$BRAND_BRANCH"
  git push "$ORIGIN_REMOTE" "$DEPLOY_BRANCH" --force-with-lease
fi

echo "==> Return to $CURRENT_BRANCH..."
git checkout "$CURRENT_BRANCH"

echo ""
echo "Sync complete."
echo "Branch stack:"
echo "  $MAIN_BRANCH"
echo "    -> $BRAND_BRANCH"
echo "      -> $DEPLOY_BRANCH"
