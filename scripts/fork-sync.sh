#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

echo "=== text-cli fork sync ==="
echo "Upstream: $(git remote get-url origin)"
echo "Fork:     $(git remote get-url fork)"
echo ""

echo "[1/4] Fetching upstream (origin)..."
git fetch origin --prune

echo "[2/4] Switching to main..."
git checkout main

echo "[3/4] Fast-forward main to upstream/main..."
git merge --ff-only origin/main

echo "[4/4] Pushing to fork..."
git push fork main --tags

echo ""
echo "=== Sync complete ==="
git log --oneline -3
