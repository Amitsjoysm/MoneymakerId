# Vendored Claude Code skills

These skills were copied into the project (`.claude/skills/`, `.claude/agents/`) so that every session, local or cloud, has them without installing plugins. Each one keeps its upstream licence; the licence texts are in this folder.

| Upstream | Version (commit, date) | Licence | Copied |
|---|---|---|---|
| [obra/superpowers](https://github.com/obra/superpowers) | `8ca22db`, 2026-09-25 | MIT | 13 skills: brainstorming, dispatching-parallel-agents, executing-plans, finishing-a-development-branch, receiving-code-review, requesting-code-review, subagent-driven-development, systematic-debugging, test-driven-development, using-git-worktrees, using-superpowers, verification-before-completion, writing-plans |
| [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `cf3d2fa` (skill v4.5.0), 2026-10-06 | Apache-2.0 (with `NOTICE.md`) | the `impeccable` skill (SKILL.md, reference/, scripts/) and 4 agents |
| [tirth8205/code-review-graph](https://github.com/tirth8205/code-review-graph) | `6b12d11`, 2026-09-18 | MIT | 7 skills: build-graph, debug-issue, explore-codebase, refactor-safely, review-changes, review-delta, review-pr. The MCP server itself is installed by `.claude/hooks/session-start.sh` and configured in `.mcp.json`. |

**Local changes:**
- The `impeccable-asset-producer` agent points at `${CLAUDE_PROJECT_DIR}/.claude/skills/impeccable` instead of `${CLAUDE_PLUGIN_ROOT}/skills/impeccable`.
- Skill text that says `superpowers:<name>` means the project skill `<name>`.

**Not copied:**
- Superpowers' `writing-skills` and `diagnosing-superpowers` skills (not needed for this project).
- Impeccable's plugin hooks, which depend on the plugin root.

**Updating:** re-copy the same folders from a newer upstream commit, then update the version column.
