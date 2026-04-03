#!/usr/bin/env bash
# sync-upstream.sh — 合并上游更新到 main，然后将 deploy/tencent rebase 到最新 main
# 在本地机器上执行（不是服务器），从仓库根目录运行: bash deploy/scripts/sync-upstream.sh
set -euo pipefail

DEPLOY_BRANCH="deploy/tencent"
MAIN_BRANCH="main"

# 确保工作区干净
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: 工作区有未提交的改动，请先 commit 或 stash"
  exit 1
fi

echo "==> 拉取 upstream 和 origin 最新内容..."
git fetch upstream
git fetch origin

echo "==> 将 upstream/main 合并到本地 $MAIN_BRANCH..."
git checkout "$MAIN_BRANCH"
git merge --ff-only "origin/$MAIN_BRANCH"   # 先同步本地与远端
git merge upstream/main --no-edit

echo "==> 推送更新后的 $MAIN_BRANCH 到 origin..."
git push origin "$MAIN_BRANCH"

echo "==> 将 $DEPLOY_BRANCH rebase 到最新 $MAIN_BRANCH..."
git checkout "$DEPLOY_BRANCH"
git rebase "$MAIN_BRANCH"

echo "==> 推送 $DEPLOY_BRANCH 到 origin（rebase 后使用 force-with-lease）..."
git push origin "$DEPLOY_BRANCH" --force-with-lease

echo ""
echo "同步完成："
echo "  upstream/main  --> 已合并到 origin/$MAIN_BRANCH"
echo "  $DEPLOY_BRANCH --> 已 rebase 到 $MAIN_BRANCH 并推送"
echo ""
echo "接下来在服务器上执行部署："
echo "  ssh -i /path/to/ting_20260403.pem ubuntu@<SERVER_IP>"
echo "  cd /srv/banana-slides && git pull origin $DEPLOY_BRANCH && bash deploy/scripts/deploy.sh"
