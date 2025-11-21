#!/usr/bin/env bash
# GitHub Actions Runner Disk Cleanup Script
# Run this on the VPS where the self-hosted runner is located
#
# Usage: ./cleanup-runner.sh

set -euo pipefail

echo "=========================================="
echo "🧹 GitHub Actions Runner Disk Cleanup"
echo "=========================================="

# Check current disk usage
echo ""
echo "📊 Current disk usage:"
df -h /

echo ""
echo "🔍 Checking runner directory..."
RUNNER_DIR=$(find / -type d -name "_work" -path "*actions-runner*" 2>/dev/null | head -1 || echo "")
if [ -n "$RUNNER_DIR" ]; then
  RUNNER_BASE=$(dirname "$RUNNER_DIR")
  echo "Found runner at: $RUNNER_BASE"
  echo "Runner work directory size:"
  du -sh "$RUNNER_DIR" 2>/dev/null || echo "Could not calculate size"
else
  echo "⚠️  Could not find runner directory automatically"
  echo "Common locations: /home/*/actions-runner/_work, /opt/actions-runner/_work"
  exit 1
fi

echo ""
echo "🧹 Cleaning up runner workspace..."

# Stop the runner service temporarily
echo "Stopping runner service..."
sudo systemctl stop actions.runner.*.service || echo "Could not stop runner service (may not be systemd)"

# Clean up old workflow runs
if [ -n "$RUNNER_DIR" ]; then
  echo "Removing old workflow directories..."
  cd "$RUNNER_DIR"

  # Keep only the last 3 workflow runs
  ls -dt */ 2>/dev/null | tail -n +4 | xargs rm -rf 2>/dev/null || true

  echo "Cleaning _temp directory..."
  rm -rf _temp/* 2>/dev/null || true

  echo "Cleaning _diag logs..."
  rm -rf "$RUNNER_BASE/_diag"/*.log 2>/dev/null || true
  find "$RUNNER_BASE/_diag" -name "*.log" -mtime +7 -delete 2>/dev/null || true
fi

# Docker cleanup
echo ""
echo "🐳 Docker cleanup..."
if command -v docker >/dev/null 2>&1; then
  echo "Removing stopped containers..."
  docker container prune -f 2>/dev/null || true

  echo "Removing dangling images..."
  docker image prune -f 2>/dev/null || true

  echo "Removing unused volumes..."
  docker volume prune -f 2>/dev/null || true

  echo "Removing build cache older than 24h..."
  docker builder prune -f --filter "until=24h" 2>/dev/null || true

  echo "Removing all build cache (if needed)..."
  # Uncomment next line if more aggressive cleanup is needed
  # docker builder prune -af 2>/dev/null || true
fi

# System cleanup
echo ""
echo "🗑️  System cleanup..."
echo "Cleaning apt cache..."
sudo apt-get clean 2>/dev/null || true

echo "Cleaning journald logs older than 3 days..."
sudo journalctl --vacuum-time=3d 2>/dev/null || true

echo "Removing old log files..."
sudo find /var/log -name "*.log.*" -mtime +7 -delete 2>/dev/null || true
sudo find /var/log -name "*.gz" -mtime +7 -delete 2>/dev/null || true

# Restart runner
echo ""
echo "Starting runner service..."
sudo systemctl start actions.runner.*.service || echo "Could not start runner service (may not be systemd)"

# Final disk usage
echo ""
echo "=========================================="
echo "✅ Cleanup completed!"
echo "=========================================="
echo ""
echo "📊 Final disk usage:"
df -h /

echo ""
echo "💾 Disk space freed:"
echo "(Compare with initial usage above)"

echo ""
echo "✅ Runner cleanup complete. You can now trigger a new deployment."
