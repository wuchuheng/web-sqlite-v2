---
description: Stage 2 Feasibility using S2:feasibilityAnalyst. Requires Stage 1 docs. Produces A/B/C options + recommendation and updates spec/status.
---

# File Tree Map

## Reference (templates)
.claude/templates/docs/
└─ 02-feasibility/
   ├─ 01-options.md         # reference template
   ├─ 02-risk-assessment.md  # reference template
   └─ 03-spike-plan.md       # reference template

## Output (final docs)
docs/
└─ 02-feasibility/
   ├─ 01-options.md          # output
   ├─ 02-risk-assessment.md  # output (optional)
   └─ 03-spike-plan.md       # output (optional)

Run Stage 2 with S2:feasibilityAnalyst.

Rules:
- Preflight: Stage 1 outputs must exist and be non-empty. If not, stop and redirect to /s1-discovery.
- Use templates under `.claude/templates/docs/**` (no heading changes).
- Produce options A/B/C + recommendation.
- Update spec + status with evidence.
