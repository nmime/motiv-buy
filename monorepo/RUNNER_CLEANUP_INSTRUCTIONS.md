# GitHub Actions Runner Disk Cleanup Instructions

## Problem

The self-hosted GitHub Actions runner 'runner-production-vps' is out of disk space, causing all deployments to fail during checkout with error:

```
tar: Cannot write: No space left on device
```

## Solution

Clean up disk space on the VPS where the GitHub Actions runner is installed.

## Quick Cleanup Steps

### 1. Connect to your VPS

```bash
ssh YOUR_USER@YOUR_VPS_HOST
```

### 2. Run the automated cleanup script

Download and run the cleanup script directly from this repo:

```bash
# Download the script from GitHub
curl -O https://raw.githubusercontent.com/YOUR_REPO/master/scripts/cleanup-runner.sh

# Make it executable
chmod +x cleanup-runner.sh

# Run cleanup (may require sudo for some operations)
./cleanup-runner.sh
```

### 3. Manual Cleanup (Alternative)

If you prefer manual cleanup or the script doesn't work:

```bash
# Check current disk usage
df -h /

# Find runner directory
find / -type d -name "_work" -path "*actions-runner*" 2>/dev/null

# Example cleanup commands (adjust paths as needed):
RUNNER_DIR="/home/your_user/actions-runner/_work"

# Stop runner service
sudo systemctl stop actions.runner.*.service

# Clean old workflow runs (keep only last 3)
cd "$RUNNER_DIR"
ls -dt */ 2>/dev/null | tail -n +4 | xargs rm -rf

# Clean temp files
rm -rf _temp/*

# Docker cleanup
docker container prune -f
docker image prune -af --filter "until=24h"
docker volume prune -f
docker builder prune -af

# System cleanup
sudo apt-get clean
sudo journalctl --vacuum-time=3d

# Restart runner
sudo systemctl start actions.runner.*.service

# Check final disk usage
df -h /
```

## After Cleanup

Once disk space is freed:

1. Trigger a new deployment from GitHub Actions
2. Monitor logs to verify deployment proceeds past the checkout phase
3. Confirm "Build & Push" stage completes successfully
4. Verify API and Bot services start and become healthy

## Expected Result

After cleanup, you should have at least 2-3 GB of free space, which is sufficient for GitHub Actions to checkout code and run workflows.

## Monitoring

Check deployment progress at:
https://github.com/YOUR_REPO/actions/workflows/deploy.yml

## Need Help?

If cleanup doesn't resolve the issue or you need assistance, check:

- Runner service status: `sudo systemctl status actions.runner.*.service`
- Runner logs: `journalctl -u actions.runner.*.service -f`
- Disk usage by directory: `sudo du -sh /* | sort -h`
