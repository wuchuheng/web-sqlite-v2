<!--
TEMPLATE MAP (reference-only)
.claude/templates/docs/05-design/02-schema/02-migrations.md

OUTPUT MAP (write to)
docs/05-design/02-schema/02-migrations.md

NOTES
- Keep headings unchanged.
- Define migration tool and strategy.
-->

# 02 Migration Strategy

## 1) Tooling
- **Tool**: Flyway / Liquibase / TypeORM / Prisma / Goose
- **Directory**: `src/migrations` or `db/migrations`

## 2) Workflow
1. Developer creates migration file (e.g., `V1__init.sql`).
2. Local apply & test.
3. PR review (changes to `schema.prisma` or SQL).
4. CI checks (dry-run).
5. CD applies on deploy (before/during app start).

## 3) Naming Convention
- Format: `V{VERSION}__{DESCRIPTION}.sql` or `YYYYMMDDHHMM_{DESCRIPTION}`
- Example: `V1__create_users_table.sql`

## 4) Rollback Policy
- **Strategy**: Up-only (fix-forward) OR Down-migrations required?
- **Policy**: "Avoid destructive changes (DROP COLUMN) in existing tables; use deprecation phases."
