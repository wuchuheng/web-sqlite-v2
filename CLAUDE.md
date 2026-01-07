# Claude Code Rules (Key Index First)

## 🔑 Critical Index (Understanding starts here)
This index is the **single most important entry point** for understanding the project.
Always read these before making decisions or implementing changes:

1) Spec (source of truth): `docs/00-control/00-spec.md`
2) Status board (live progress): `docs/00-control/01-status.md`

Stage 1 docs:
- `docs/01-discovery/01-brief.md`
- `docs/01-discovery/02-requirements.md`
- `docs/01-discovery/03-scope.md`

Stage 2 docs:
- `docs/02-feasibility/01-options.md`

---

## Output boundary rules (non-negotiable)
- `.claude/` contains inputs for Claude: templates, agents, commands, hooks.
- `docs/` contains ONLY finalized outputs. Never store templates in `docs/`.

Templates live here:
- `.claude/templates/docs/**`

When generating docs:
- Always start from the template in `.claude/templates/docs/**`
- Do not change headings/sections; only fill in content.

---

## Documentation rule (mandatory)
When writing docs, **add Mermaid diagrams (Mermaid UML) whenever they improve clarity**.
Prefer: flowchart, sequence diagram, state diagram.

---

## Stage order
1) Discovery / Problem Framing
2) Feasibility / Options
3) HLD
4) ADR
5) LLD + Contracts
6) Implementation + Verification
(Status tracking is continuous across all stages.)

### Stage 1 stop condition
Stage 1 ends when all are explicit and confirmed:
- MVP (P0 requirements)
- Success criteria (testable)
- Non-goals
- Backlog (future ideas)

---

## Global Definition of Done (DoD)
A task is DONE only if:
- Work completed
- Evidence provided (commit/PR/test commands/results)
- Status board updated: `docs/00-control/01-status.md`
- Spec index updated if any reading order / stage outputs changed
