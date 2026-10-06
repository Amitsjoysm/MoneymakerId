# MarketMind AI: project memory

MarketMind AI is a Pune local decision engine built as an Astro 7 monorepo on Cloudflare Workers, with Supabase and Groq/Exa/Firecrawl behind it. It runs on three public hosts plus an admin:
- `marketmindai.com`: brand, trust and locality guides
- `food.marketmindai.com`: dish × locality recommendations
- `construction.marketmindai.com`: cost guides, calculator and quote leads
- `admin.marketmindai.com`: private admin

The goal is local search traffic, turned into revenue: construction leads first, then featured listings and sponsorship, then ads.

**Source of truth.** Read only the parts you need.
- [`docs/PLAN.md`](docs/PLAN.md): the approved plan. §1 holds the owner's decisions; never re-litigate them.
- [`docs/CONTRACTS.md`](docs/CONTRACTS.md): shared names, IDs, shapes, database functions, HTTP bodies and env vars. Only the orchestrator edits it.
- [`docs/TASKS.md`](docs/TASKS.md): the wave-by-wave task graph. One card per sub-agent; each card lists the paths it owns.
- `Makemoney.txt` (the owner's original spec) is cited as "spec §N".

## How to work in a new session
1. **Check status first** (below). Pick up the next wave or task; don't redo finished work.
2. **Use the graph; don't read the whole codebase.** Use the code-review-graph MCP tools (section below), starting with `get_minimal_context_tool(task=...)`. Then read only the files the graph points to, the relevant TASKS.md card, and the CONTRACTS.md sections it cites. If the graph is unavailable (the session-start hook reports this), use TASKS.md + CONTRACTS.md + targeted Grep/Glob.
3. **Use the skills in `.claude/skills/`.** "superpowers:<name>" means the project skill `<name>`.
   - Features: `brainstorming` → `writing-plans` → `subagent-driven-development` / `executing-plans` → `test-driven-development` → `verification-before-completion` → `requesting-code-review`.
   - Bugs: `systematic-debugging`.
   - **All UI and design work:** `impeccable`. Run `/impeccable init` once so `PRODUCT.md` and `DESIGN.md` exist at the repo root, then use `shape`, `critique`, `audit` and `polish`. Design direction comes from plan §15.
4. **Parallel sub-agents.** Run one TASKS.md card per agent. Agents edit only the paths their card owns, install no dependencies, and never edit the contracts. The orchestrator re-runs acceptance checks, then commits and pushes after each wave.
5. **Before claiming done,** run the card's acceptance commands, then update the Status and Progress log below.

## Non-negotiable product rules
- **No fabricated data.** No invented businesses, prices, ratings, reviews, sources or search volumes. Every rendered claim shows its source and the date it was checked.
- **Pages pass the quality gate** (plan §5) or are not built. Thin pages are never padded.
- **Paid placement is always labelled** and never changes organic ranking.
- **The WhatsApp number** `919834346179` appears only on MarketMind AI contact/CTA surfaces, never in business data or business JSON-LD.
- **Page views never call AI or crawlers.** Only `/api/ask` does live lookups, within the daily cap.
- **Secrets never go in code, logs or chat.** The Supabase secret key is used only by the admin Worker and GitHub Actions.

## Environment notes
- Node 22 and pnpm 10 are installed. Python 3.13 and `uv` are available.
- This environment's network policy currently **blocks `registry.npmjs.org` and PyPI**. The owner must allow them under Settings → Network access. Until then, no package installs or builds are possible, and code-review-graph cannot be installed.
- **GitHub push works** (fixed by the owner on 2026-10-06). Push with `git push -u origin claude/relaxed-sagan-uipz8o`.
- `.claude/hooks/session-start.sh` installs dependencies and code-review-graph and builds the graph. It is fail-soft.

## Status (update after every wave)

| Wave | Milestone | State |
|---|---|---|
| Plan, contracts, task graph | — | ✅ done (plan approved by owner 6 Oct 2026) |
| 1: data and docs (D01–D06, DOC1) | M1 data | 🔄 partial (waterproofing, configs, CSV, docs done); research retries batched per turn |
| 2–7: scaffold → M1 construction launch | M0/M1 | ⛔ blocked on npm access |
| 8–12: admin, food, pipeline + Ask, hardening, Marathi/Hindi | M2–M6 | ⏳ not started |

**Owner inputs pending:**
- npm/PyPI network access
- legal placeholders (`{{LEGAL_NAME}}`, `{{CONTACT_EMAIL}}`, `{{GRIEVANCE_OFFICER}}`, `{{POSTAL_ADDRESS}}`)
- review of AI-drafted prose (cost guides, locality guides)
- accounts and keys, listed in `docs/DEPLOY.md`

## Progress log (newest first; one line per meaningful change)
- 2026-10-06: Wave 1 first pass. Done: waterproofing pack (16 cited models, citations verified against search transcripts), D04 configs, D05 CSV templates, DOC1 deploy/policy/legal drafts. Not done: painting (timeout), bathroom/kitchen/house-construction (0 models), D01a/D01b/D02 (API overload), D06a/b (no search budget). **Lesson: WebSearch is capped at 200 calls per turn, shared by all agents. Research now runs in batches across turns with per-agent search budgets; verifiers check citations against the builder's transcript.** Contract: parent services aggregate their sub-services' models; unsourced durations and presets are null.
- 2026-10-06: Task-graph audit (40 findings) applied. CONTRACTS v2 adds `admin_api`, derived shapes (§6a), the build manifest, literal spec values (§8a) and DOM attributes (§7a). TASKS v2 adds sub-waves, splits large cards, gives every card acceptance criteria, and adds gap-fill tasks D01c and D03f. The original spec is now in `docs/Makemoney.txt`. GitHub push now works.
- 2026-10-06: Skills installed into `.claude/` (Superpowers, Impeccable, code-review-graph); SessionStart hook and `.mcp.json` added; this CLAUDE.md created.
- 2026-10-06: Wave 1 started: two parallel workflows (5 construction service packs; localities, dishes, configs, CSV templates, locality guides, docs), each research task followed by an adversarial verifier.
- 2026-10-06: CONTRACTS.md and TASKS.md written; the task graph sent for independent audit.
- 2026-10-06: Plan v2 approved. Key decisions: subdomains; Cloudflare Workers; free tiers only, with multi-account key rotation (owner accepted the risk, plan §10); admin behind Cloudflare Access; auto-publish when ≥ 2 independent sources agree; English first, then Marathi/Hindi; alerts via Telegram + email; live Ask capped at 50/day; all AI bots allowed.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**This project has a knowledge graph. ALWAYS use the code-review-graph MCP tools BEFORE Grep/Glob/Read to explore the codebase.** The graph is faster and cheaper (fewer tokens), and it gives you structural context (callers, dependents, test coverage) that file scanning cannot.

### When to use graph tools FIRST
- **Exploring code:** `semantic_search_nodes_tool` or `query_graph_tool` instead of Grep
- **Understanding impact:** `get_impact_radius_tool` instead of manually tracing imports
- **Code review:** `detect_changes_tool` + `get_review_context_tool` instead of reading entire files
- **Finding relationships:** `query_graph_tool` with `callers_of` / `callees_of` / `imports_of` / `tests_for`
- **Architecture questions:** `get_architecture_overview_tool` + `list_communities_tool`

Fall back to Grep/Glob/Read only when the graph doesn't cover what you need. Call `get_minimal_context_tool(task=...)` first, pass `detail_level="minimal"` where possible, and budget about 5 graph calls per task. Always read a function's implementation and tests before changing it.

### Workflow
1. The graph auto-updates after Write/Edit (via the PostToolUse hook in `.claude/settings.json`).
2. Use `detect_changes_tool` for code review.
3. Use `get_affected_flows_tool` to understand impact.
4. Use `query_graph_tool` with `pattern="tests_for"` to check coverage.
<!-- /code-review-graph MCP tools -->
