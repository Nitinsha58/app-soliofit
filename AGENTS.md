<!-- project-docs-structure -->
## Project Documentation Structure

```
docs/
  README.md                    — Overview and ADR index
  adr/                         — Architecture Decision Records (ADR-0001 onward; added only when required by the active slice)
  product/README.md            — Pointer to product vault
  workflow/
    development-process.md     — Incremental review-driven workflow rules
    vertical-slices.md         — 19 vertical slices (VS-00 through VS-18) with specs and review checkpoints
```

Development follows a **vertical slice approach**: each slice delivers an observable, end-to-end feature increment. Work one slice at a time, review before continuing, and keep the active work aligned with the Active Window in `docs/workflow/vertical-slices.md`.

Before starting a slice, read:
- `docs/workflow/vertical-slices.md` for the active slice spec, completion records, deferrals, and review checkpoint
- `docs/workflow/development-process.md` for ADR lifecycle, slice management, vault update rules, and post-commit checklist

ADRs are written only when the current slice requires a documented decision — never pre-planned. Accepted ADRs are immutable except for explicit supersession notes.

---

<!-- product-docs-reference -->
## Product Documentation — Centralized Reference

All product-related documentation for Soliofit is maintained in a single Obsidian vault, version-controlled with git:

**Location:** `/Users/nitin/MemoryGraph/Soliofit/Soliofit`

| File | Contents |
|------|---------|
| `00-index.md` | Master index, tech stack summary, key decisions log |
| `01-screen-definitions.md` | All 10 screens — purpose, features, user actions, nav flow, data |
| `02-feature-set.md` | Core MVP features, post-MVP, automation, notifications, AI candidates |
| `03-technical-architecture.md` | Tech stack, frontend structure, API design, DB schema, S3, auth |
| `04-system-design.md` | Entity relationships, module breakdown, scalability, security |
| `05-product-structure.md` | User roles, workflows, customer/order/payment lifecycle |
| `06-dashboard-definitions.md` | Operational & payments dashboards, KPI definitions |
| `07-ux-guidelines.md` | Design direction, layout system, color palette, typography, components |
| `08-devops-deployment.md` | Docker, CI/CD, EC2, Nginx, monitoring, backups |
| `09-mvp-scope.md` | P0/P1/P2 features, 4-phase implementation plan, timeline |

**Rules:**
- Always read from this vault before answering any product, feature, or architecture question.
- After any update to these docs, commit the changes: `cd /Users/nitin/MemoryGraph/Soliofit/Soliofit && git add -A && git commit -m "<description>"`
- Do not duplicate product context elsewhere — this vault is the single source of truth.
- Update the vault only for product-level changes: screen behavior, MVP scope, UX guidelines, or tech stack summary. Implementation details belong in code, commits, ADRs, or slice completion records.

---

<!-- root-agent-doc-sync -->
## Root Agent Document Sync

`CLAUDE.md` and `AGENTS.md` must stay functionally identical. When one is updated, apply the same project-specific instruction changes to the other.

---

<!-- docker-dev-rules -->
## Docker Development Rules

The `node_modules` and Python packages live inside Docker volumes — not on the host. Restarting a container does **not** re-run `npm install` or `pip install`.

**Install new packages into the running container whenever its dependency file changes:**

| File changed | Quick install (preferred) | Full rebuild (if quick fails) |
|---|---|---|
| `frontend/package.json` | `docker compose -f docker-compose.dev.yml exec frontend npm install` | `docker compose -f docker-compose.dev.yml rm -f frontend && docker compose -f docker-compose.dev.yml up -d --build frontend` |
| `backend/requirements.txt` | `docker compose -f docker-compose.dev.yml exec backend pip install -r requirements.txt` | `docker compose -f docker-compose.dev.yml rm -f backend && docker compose -f docker-compose.dev.yml up -d --build backend` |

`--build` alone is not reliable — the anonymous `node_modules` volume may be reused from the old container. Always use `exec … install` first; fall back to `rm -f` + rebuild if the container is not running.

Hot-reload (file edits, new source files) works without any of this. Only dependency changes need it.

---

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
