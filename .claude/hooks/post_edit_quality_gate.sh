#!/usr/bin/env bash
set -euo pipefail

# Read payload from stdin (Claude Code passes JSON)
# We extract the file path.
# If jq is not available, we might fail or need a fallback.
# Assuming basic environment has jq.
file_path="$(cat | jq -r '.tool_input.file_path // empty')"

if [[ -z "$file_path" ]]; then
  exit 0
fi

# Skip docs/ and other non-code paths
case "$file_path" in
  docs/*|*.md|*.txt|*.json|*.yaml|*.yml) exit 0 ;;
esac

echo "Running Quality Gate for: $file_path"

# ---- JS/TS ----
if [[ "$file_path" =~ \.(ts|tsx|js|jsx)$ ]]; then
  if [[ -f package.json ]]; then
    # Try standard script names if they exist
    if grep -q '"format":' package.json; then
        npm run -s format -- "$file_path" || true
    fi
    if grep -q '"lint:fix":' package.json; then
        npm run -s lint:fix -- "$file_path" || true
    elif grep -q '"lint":' package.json; then
        # Some lint commands support --fix passed through
        npm run -s lint -- --fix "$file_path" || true
    fi
  fi
fi

# ---- Python ----
if [[ "$file_path" =~ \.py$ ]]; then
  if command -v ruff >/dev/null 2>&1; then
    ruff format "$file_path" || true
    ruff check --fix "$file_path" || true
  elif command -v black >/dev/null 2>&1; then
    black "$file_path" || true
  fi
fi

# ---- Go ----
if [[ "$file_path" =~ \.go$ ]]; then
  if command -v gofmt >/dev/null 2>&1; then
    gofmt -w "$file_path" || true
  fi
fi

exit 0
