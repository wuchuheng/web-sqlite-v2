<!--
TEMPLATE MAP (reference-only)
.claude/templates/docs/06-implementation/04-release-and-rollback.md

OUTPUT MAP (write to)
docs/06-implementation/04-release-and-rollback.md

NOTES
- Define deployment steps and rollback triggers.
-->

# 04 Release & Rollback

## 1) Versioning
- **Semantic Versioning**: v1.0.0 (Major.Minor.Patch)
- **Tagging**: Git tags trigger CI/CD deploy.

## 2) Deployment Pipeline
1. **Build**: Docker build & push to registry.
2. **Migrate**: Run DB migrations (Schema update).
3. **Deploy**: Rolling update (K8s) or Blue/Green.
4. **Health Check**: `/health` endpoint must return 200 OK.

## 3) Rollback Strategy
- **Trigger**: Error rate > 1% OR Latency p99 > 2s.
- **Action**:
  1. Revert to previous Docker tag.
  2. (If DB changed) Is the new schema backward compatible? (Yes -> Safe; No -> Manual DB rollback required).

## 4) Smoke Test
- After deploy, run a "Critical Path" script (Login + Basic Read) to verify system is up.
