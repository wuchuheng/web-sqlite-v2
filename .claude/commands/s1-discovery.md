---
description: Stage 1 Discovery using S1:projectManager. Must follow template→output mapping and update spec/status.
---

# File Tree Map

## Reference (templates)
.claude/templates/docs/
└─ 01-discovery/
   ├─ 01-brief.md          # reference template
   ├─ 02-requirements.md    # reference template
   └─ 03-scope.md           # reference template

## Output (final docs)
docs/
└─ 01-discovery/
   ├─ 01-brief.md           # output
   ├─ 02-requirements.md     # output
   └─ 03-scope.md            # output

Run Stage 1 with S1:projectManager.

Rules:
- If output dirs missing, ask user to run:
  ```bash
  mkdir -p docs/00-control docs/01-discovery
  ```
- Always draft outputs by following templates under `.claude/templates/docs/**` (no heading changes).
- Interview in rounds until: MVP + Success criteria + Non-goals + Backlog are confirmed.
- Update:
  - docs/00-control/00-spec.md (index + stage)
  - docs/00-control/01-status.md (task states + evidence)
