# CI/CD Workflow Analysis & Optimization Plan

## Current Workflows Overview

### 1. CI Pipeline (`ci.yml`)
**Trigger**: Every push, every PR
**Jobs**: 4 (quality → docker, security)
**Estimated Time**: ~8-12 minutes
**Monthly Runs**: ~100-200
**Cost Impact**: 🔴 HIGH

```
quality (build, lint, test, coverage) [~5-7 min]
  ├─> docker (api, bot) [~4-6 min parallel]
  └─> security (audit, trivy) [~2-3 min]
       └─> summary [~10 sec]
```

### 2. Deploy - Production (`deploy-production.yml`)
**Trigger**: Manual only
**Jobs**: 5 (sequential + rollback)
**Estimated Time**: ~6-8 minutes
**Monthly Runs**: ~4-10
**Cost Impact**: 🟡 MEDIUM

```
validate [~10 sec]
  └─> build (api, bot) [~4-6 min parallel]
       └─> backup [~30 sec - 2 min]
            └─> deploy [~1-2 min]
                 └─> rollback (if failure) [~1 min]
```

### 3. Deploy - Staging (`deploy-staging.yml`)
**Trigger**: Manual or workflow_call
**Jobs**: 3 (sequential)
**Estimated Time**: ~5-7 minutes
**Monthly Runs**: ~20-40
**Cost Impact**: 🟡 MEDIUM

```
validate [~10 sec]
  └─> build (api, bot) [~4-6 min parallel]
       └─> deploy [~1-2 min]
```

### 4. Run Database Migrations (`run-migrations.yml`)
**Trigger**: Manual only
**Jobs**: 3 (1 build + 2 conditional)
**Estimated Time**: ~4-6 minutes
**Monthly Runs**: ~5-15
**Cost Impact**: 🟢 LOW

```
build (migration image) [~3-4 min]
  ├─> migrate-staging (if staging) [~1-2 min]
  └─> migrate-production (if production) [~1-2 min]
```

### 5. Update SSL Certificates (`update-ssl-certificates.yml`)
**Trigger**: Manual or push to config/domains.yml
**Jobs**: 3 (1 parse + 2 conditional)
**Estimated Time**: ~2-3 minutes
**Monthly Runs**: ~2-5
**Cost Impact**: 🟢 LOW

```
parse-config [~20 sec]
  ├─> update-staging (if needed) [~1-2 min]
  └─> update-production (if needed) [~1-2 min]
```

### 6. CodeQL Security Scan (`codeql.yml`)
**Trigger**: Push to master, PRs, scheduled (weekly)
**Jobs**: 1
**Estimated Time**: ~5-8 minutes
**Monthly Runs**: ~20-30
**Cost Impact**: 🟡 MEDIUM

```
codeql (analyze) [~5-8 min]
```

### 7. Claude Code Review (`claude-code-review.yml`)
**Trigger**: PR reviews
**Jobs**: 1
**Estimated Time**: ~1-2 minutes
**Monthly Runs**: ~10-20
**Cost Impact**: 🟢 LOW

```
claude-review [~1-2 min]
```

### 8. Claude Code (`claude.yml`)
**Trigger**: PR review comments
**Jobs**: 2
**Estimated Time**: ~1-2 minutes
**Monthly Runs**: ~10-20
**Cost Impact**: 🟢 LOW

```
issues, claude [~1-2 min total]
```

---

## Total Monthly Minutes Estimate

| Workflow | Runs/Month | Avg Time | Total Minutes |
|----------|------------|----------|---------------|
| CI | 150 | 10 min | **1,500 min** |
| Deploy Production | 6 | 7 min | 42 min |
| Deploy Staging | 30 | 6 min | 180 min |
| Run Migrations | 10 | 5 min | 50 min |
| SSL Certificates | 3 | 2 min | 6 min |
| CodeQL | 25 | 6 min | 150 min |
| Claude Review | 15 | 1.5 min | 22 min |
| Claude Code | 15 | 1.5 min | 22 min |
| **TOTAL** | | | **~1,972 min** |

**Estimated Monthly Cost**: ~$8-12 (GitHub Actions free tier: 2,000 min/month)

---

## 🎯 Optimization Opportunities

### Critical (Save 40-60% time)

#### 1. Add Dependency Caching to CI
**Impact**: 🔴 HIGH - Saves 2-4 min per run
**Savings**: ~300-600 min/month
**Implementation**:
```yaml
- name: Setup pnpm cache
  uses: actions/cache@v4
  with:
    path: ~/.pnpm-store
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: ${{ runner.os }}-pnpm-
```

#### 2. Skip CI on Documentation-Only Changes
**Impact**: 🟡 MEDIUM - Saves full CI runs
**Savings**: ~150-300 min/month
**Implementation**:
```yaml
on:
  push:
    paths-ignore:
      - '**.md'
      - 'docs/**'
      - '.github/**.md'
```

#### 3. Use Docker Layer Caching
**Impact**: 🟡 MEDIUM - Saves 1-3 min per build
**Savings**: ~100-200 min/month
**Already Implemented**: ✅ Using `cache-from: type=gha`

#### 4. Parallel Job Execution
**Impact**: 🟡 MEDIUM - Saves 1-2 min per workflow
**Current**: Docker builds wait for quality
**Optimization**: Run docker builds in parallel with quality
```yaml
docker:
  needs: []  # Remove dependency on quality
```

### Medium (Save 20-30% time)

#### 5. Optimize Test Execution
**Impact**: 🟡 MEDIUM
**Savings**: ~100-200 min/month
**Options**:
- Run tests only on changed packages
- Use `nx affected` properly
- Skip tests for trivial changes

#### 6. Reduce Docker Context Size
**Impact**: 🟢 LOW
**Savings**: ~30-50 min/month
**Implementation**: Add `.dockerignore`

#### 7. Combine Similar Workflows
**Impact**: 🟢 LOW
**Savings**: ~20-40 min/month
**Example**: Reusable deployment workflow

---

## 📊 Recommended Implementation Order

### Phase 1: Quick Wins (Week 1)
1. ✅ Add pnpm cache to CI
2. ✅ Add paths-ignore for docs
3. ✅ Create .dockerignore
4. ✅ Optimize parallel execution

**Expected Savings**: 400-800 min/month (40-50%)

### Phase 2: Optimization (Week 2)
5. ⚠️ Implement affected tests
6. ⚠️ Add build caching
7. ⚠️ Optimize lint/format

**Expected Savings**: 200-300 min/month (20%)

### Phase 3: Advanced (Week 3+)
8. ⚠️ Reusable workflows
9. ⚠️ Self-hosted runners (if needed)
10. ⚠️ Workflow monitoring/metrics

**Expected Savings**: 100-200 min/month (10%)

---

## 🚀 Immediate Actions

### 1. CI Workflow Optimization
```yaml
# Add before job 'quality'
- name: Get pnpm store directory
  id: pnpm-cache
  run: echo "STORE_PATH=$(pnpm store path)" >> $GITHUB_OUTPUT

- name: Setup pnpm cache
  uses: actions/cache@v4
  with:
    path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: ${{ runner.os }}-pnpm-
```

### 2. Add paths-ignore
```yaml
on:
  push:
    branches: [master]
    paths-ignore:
      - '**.md'
      - 'docs/**'
  pull_request:
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

### 3. Create .dockerignore
```
# .dockerignore
.git
.github
node_modules
dist
coverage
*.md
docs
.env*
.vscode
.idea
```

### 4. Parallelize CI Jobs
```yaml
docker:
  runs-on: ubuntu-latest
  needs: []  # Remove dependency
  if: always()  # Run even if quality fails
```

---

## 📈 Expected Results

### Before Optimization
- **Total Monthly Minutes**: ~1,972 min
- **CI Average**: ~10 min
- **Deployment Average**: ~6-7 min

### After Phase 1 Optimization
- **Total Monthly Minutes**: ~1,100-1,200 min ⬇️ 40-45%
- **CI Average**: ~5-6 min ⬇️ 40-50%
- **Deployment Average**: ~4-5 min ⬇️ 30%

### After All Phases
- **Total Monthly Minutes**: ~800-1,000 min ⬇️ 50-60%
- **CI Average**: ~4-5 min ⬇️ 50-60%
- **Deployment Average**: ~3-4 min ⬇️ 40-50%

---

## 🔍 Monitoring

### Metrics to Track
1. Average workflow duration (by workflow)
2. Cache hit rate
3. Failed workflow rate
4. Total minutes per month
5. Cost per deployment

### Tools
- GitHub Actions insights
- Custom workflow metrics
- Cost tracking dashboard

---

## 💡 Advanced Optimizations (Future)

### 1. Self-Hosted Runners
- **Cost**: $0/min but requires infrastructure
- **Speed**: 2-3x faster
- **When**: If exceeding free tier consistently

### 2. Turborepo/Nx Remote Caching
- **Impact**: 80%+ time savings on unchanged code
- **Cost**: Free for small teams
- **Complexity**: Medium

### 3. Matrix Strategy Optimization
- **Current**: Building api + bot separately
- **Optimization**: Smart matrix based on changes

---

## ✅ Quick Implementation Checklist

- [ ] Add pnpm caching to ci.yml
- [ ] Add paths-ignore to ci.yml
- [ ] Create .dockerignore file
- [ ] Remove job dependencies for parallel execution
- [ ] Test optimized CI workflow
- [ ] Monitor results for 1 week
- [ ] Implement Phase 2 optimizations
- [ ] Document learnings
