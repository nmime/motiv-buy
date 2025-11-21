# Deployment Approval Configuration

This document explains how to configure manual approval requirements for deployments.

## Overview

The `auto-deploy.yml` workflow uses **GitHub Environment Protection Rules** to require manual approval before deploying to staging or production. Without these rules configured, deployments will execute automatically.

## Configuration Steps

### 1. Access Environment Settings

1. Go to your repository on GitHub
2. Navigate to: **Settings** → **Environments**
3. You should see two environments:
   - `staging` - Used for PR deployments
   - `production` - Used for production deployments

### 2. Configure Staging Environment

Click on the `staging` environment and configure:

#### Required Reviewers

- **Add reviewers**: Select team members who can approve staging deployments
- **Recommended**: At least 1 reviewer from the development team
- Reviewers will receive a notification when a deployment is waiting for approval

#### Wait Timer (Optional)

- Set a delay before deployment can be approved (e.g., 5 minutes)
- Useful for giving time to cancel accidental deployments

#### Deployment Branches

- **Recommended**: Allow all branches (for PR deployments)
- Or restrict to specific branch patterns if needed

#### Example Configuration

```
Environment name: staging
Required reviewers: @dev-team-member-1
Wait timer: 5 minutes (optional)
Deployment branches: All branches
```

### 3. Configure Production Environment

Click on the `production` environment and configure:

#### Required Reviewers

- **Add reviewers**: Select team members who can approve production deployments
- **Recommended**: At least 2 reviewers, including a senior developer or tech lead
- Consider requiring multiple approvals for production

#### Wait Timer (Recommended)

- Set a delay of 15-30 minutes
- Allows time to monitor staging deployment before production
- Example: Deploy to staging → wait 30 min → approve production if staging is healthy

#### Deployment Branches

- **CRITICAL**: Limit to `master` branch only
- Prevents accidental production deployments from feature branches

#### Example Configuration

```
Environment name: production
Required reviewers: @tech-lead, @senior-dev
Wait timer: 30 minutes (recommended)
Deployment branches: Selected branches → master
```

## Deployment Workflow

### Automatic Trigger (PR Deployment to Staging)

1. Developer opens/updates a PR
2. CI workflow runs and completes
3. Auto-deploy workflow starts and waits for approval
4. **Reviewer receives notification**
5. Reviewer checks CI results and approves staging deployment
6. Deployment proceeds to staging
7. PR comment posted with deployment status

### Automatic Trigger (Production Deployment)

1. PR merged to master
2. CI workflow runs on master and completes
3. Auto-deploy workflow starts and waits for approval
4. **Reviewer receives notification**
5. Wait timer counts down (e.g., 30 minutes)
6. Reviewer verifies staging is healthy
7. Reviewer approves production deployment
8. Deployment proceeds to production

### Manual Deployment (workflow_dispatch)

1. Team member goes to: Actions → Auto Deploy → Run workflow
2. Selects environment (staging/production)
3. Workflow starts and waits for approval
4. **Reviewer receives notification**
5. Reviewer approves deployment
6. Deployment proceeds

## Approval Process

### Receiving Approval Requests

When a deployment is waiting for approval:

1. You'll receive a GitHub notification
2. Email notification (if enabled in your GitHub settings)
3. You can view pending deployments in the Actions tab

### Approving a Deployment

1. Go to: **Actions** → Select the waiting workflow run
2. You'll see a yellow banner: "Review required"
3. Click **Review deployments**
4. Review the details:
   - Environment (staging/production)
   - Commit SHA
   - Changes being deployed
5. Add a comment (optional but recommended)
6. Click **Approve and deploy** or **Reject**

### Rejecting a Deployment

If you reject a deployment:

- The workflow will fail and stop
- No changes will be deployed
- The team will be notified of the rejection
- A new workflow run must be started to retry

## Best Practices

### Staging Approvals

- ✅ Quick review of CI results
- ✅ Check that tests passed
- ✅ Verify it's the correct PR/commit
- ⚠️ Don't approve if CI failed

### Production Approvals

- ✅ Verify staging deployment is healthy
- ✅ Check staging health endpoints
- ✅ Review what changed since last production deploy
- ✅ Ensure monitoring shows no issues in staging
- ✅ Check if it's during allowed deployment window
- ⚠️ Don't approve during peak traffic hours
- ⚠️ Don't approve without verifying staging first

### Emergency Deployments

For urgent hotfixes:

1. Use manual workflow_dispatch trigger
2. Select production environment
3. Request emergency approval from on-call team
4. Still require at least 1 approval (never disable protection rules)

## Monitoring Deployments

After approving a deployment, monitor:

1. **Workflow logs**: Watch the deployment progress in Actions tab
2. **Health checks**: Verify health endpoints return 200 OK
3. **Application logs**: Check for errors in container logs
4. **Metrics**: Monitor response times, error rates
5. **Rollback**: Be prepared to approve a rollback if issues occur

## Rollback Process

If a deployment causes issues:

1. New PR can be created to revert changes, OR
2. Use manual workflow_dispatch to redeploy previous version:
   - Find the previous successful commit SHA
   - Run workflow with that commit SHA
   - Approve the rollback deployment

## Security Notes

### Required Configuration

⚠️ **WARNING**: Without environment protection rules configured, the workflow will auto-deploy without any approval. This is a security risk.

### Access Control

- Only trusted team members should be reviewers
- Production reviewers should have senior/lead level permissions
- Regular review of who has approval permissions

### Audit Trail

- All approvals are logged in GitHub
- Check Actions → Deployments tab for full history
- Each deployment shows who approved and when

## Troubleshooting

### "Deployment waiting for approval" stuck

**Cause**: No reviewers configured for environment
**Fix**: Add at least one required reviewer in environment settings

### Can't approve deployment

**Cause**: You're not listed as a required reviewer
**Fix**: Ask a repository admin to add you to the environment's required reviewers

### Workflow fails immediately without asking for approval

**Cause**: Environment protection rules not configured
**Fix**: Follow configuration steps above to add required reviewers

## Additional Resources

- [GitHub Environments Documentation](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [Environment Protection Rules](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment#environment-protection-rules)
- [Deployment Reviews](https://docs.github.com/en/actions/managing-workflow-runs/reviewing-deployments)

## Summary

✅ **Configured Correctly**: Deployments wait for manual approval
❌ **Not Configured**: Deployments auto-execute (DANGEROUS)

To verify configuration:

1. Trigger a test deployment
2. Check if it asks for approval
3. If it deploys immediately → protection rules not configured!
