#!/bin/bash
# SessionStart hook for MarketMind AI.
# 1. Cloud sessions only: install JS dependencies and the code-review-graph CLI.
# 2. Build or update the code-review-graph knowledge graph whenever the CLI is available.
# 3. Print the session context: graph-first navigation, plus the Superpowers and Impeccable workflow.
#
# Every step is fail-soft. A blocked registry (npm or PyPI) must never stop a session from starting.
# Progress goes to stderr. stdout becomes context for Claude.
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$ROOT" || exit 0
log() { echo "[session-start] $*" >&2; }

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  if [ -f package.json ] && command -v pnpm >/dev/null 2>&1; then
    timeout 900 pnpm install >&2 || log "pnpm install failed. Check that registry.npmjs.org is allowed in the environment's network settings."
  fi

  if ! command -v code-review-graph >/dev/null 2>&1; then
    if command -v uv >/dev/null 2>&1; then
      timeout 300 uv tool install code-review-graph >&2 || log "code-review-graph install failed (PyPI blocked?)."
    else
      timeout 300 pip install --user code-review-graph >&2 || log "code-review-graph install failed (PyPI blocked?)."
    fi
  fi
fi

GRAPH_STATUS="unavailable (CLI not installed). Navigate with docs/TASKS.md, docs/CONTRACTS.md and targeted Grep/Glob instead"
if command -v code-review-graph >/dev/null 2>&1; then
  if [ -f .code-review-graph/graph.db ]; then
    timeout 120 code-review-graph update --skip-flows >&2 && GRAPH_STATUS="ready (updated)"
  else
    timeout 600 code-review-graph build >&2 && GRAPH_STATUS="ready (built)"
  fi
fi

cat <<EOF
MarketMind AI session context

1. Status first. The "Status" and "Progress log" sections of CLAUDE.md (already loaded) say what is done, what is blocked, and which wave of docs/TASKS.md is next.

2. Graph-first navigation. The code-review-graph knowledge graph is ${GRAPH_STATUS}.
   Do not read the whole codebase. Start with the MCP tool get_minimal_context_tool(task="<your task>").
   Then use these tools to find exactly the files you need:
   - semantic_search_nodes_tool
   - query_graph_tool (callers_of / callees_of / imports_of / tests_for)
   - get_impact_radius_tool
   - detect_changes_tool + get_review_context_tool (for reviews)
   Then read only those files, the relevant TASKS.md card, and the CONTRACTS.md sections it cites.
   The skills explore-codebase, review-changes, review-delta, review-pr, debug-issue, refactor-safely and build-graph explain the tools.

3. Workflow skills are in .claude/skills/. Text that says "superpowers:<name>" means the project skill <name>.
   - Feature work: brainstorming → writing-plans → subagent-driven-development or executing-plans → test-driven-development → verification-before-completion → requesting-code-review.
   - Bugs: systematic-debugging.
   - Any UI or design work: the impeccable skill (with PRODUCT.md and DESIGN.md at the repo root).
EOF

if [ -f .claude/skills/using-superpowers/SKILL.md ]; then
  printf '\n<superpowers>\n'
  cat .claude/skills/using-superpowers/SKILL.md
  printf '\n</superpowers>\n'
fi
exit 0
