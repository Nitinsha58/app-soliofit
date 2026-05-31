# Development Process — Incremental Review-Driven Workflow

## Principles

1. **Small units** — each implementation unit is a single, clearly scoped change that can be reviewed in one sitting
2. **Review before continue** — after completing a unit, stop and get approval before moving to the next
3. **No silent decisions** — any architectural or product-impacting choice is discussed before implementation
4. **Documentation is code** — ADRs, product doc updates, and Mnemon memory updates are part of every unit, not optional cleanup

---

## Unit Definition

An **implementation unit** is a piece of work that:
- Can be completed in one focused session
- Has a clear, verifiable outcome ("the login endpoint returns a JWT cookie")
- Produces a single well-scoped commit
- Can be independently reviewed, tested, and rolled back

**Not a unit:** "implement auth" (too large)
**A unit:** "Django: Cookie JWT login endpoint + logout endpoint, returns HTTP-only cookie"

---

## Workflow Per Unit

```
1. I state: what the unit is, what I'll change, why, and any risks
2. You approve (or redirect)
3. I implement — one focused change
4. I verify locally (run/test the specific change)
5. I commit with a structured message
6. I update docs/memory if anything architectural changed
7. I report: what was done, what the next unit is
8. You review → approve next unit
```

---

## When I Stop and Ask

I will pause and ask before proceeding when:

- A product decision is unclear or has multiple valid directions
- A UX flow has meaningful tradeoffs
- An implementation has multiple architectural paths
- Something in the requirements is missing, ambiguous, or contradictory
- A change has significant blast radius or rollback complexity
- Manual setup, credentials, or external services are needed (AWS, EC2, DNS)

---

## Commit Message Format

```
type(scope): short imperative summary (≤72 chars)

Body: what changed and why. Include:
- What problem this solves
- Key implementation decisions made
- Anything that would surprise a reviewer

Refs: ADR-XXXX (if an ADR applies)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

**Types:** `feat` · `fix` · `refactor` · `docs` · `chore` · `test` · `infra`

**Examples:**
```
feat(auth): cookie-based JWT login and logout endpoints

Implements CookieTokenObtainPairView (sets access+refresh in HTTP-only
cookies) and LogoutView (clears both cookies). Auth cookie lifetime: 24h
access, 30d refresh with rotation. Refs: ADR-0002
```

---

## Post-Commit Checklist

After every commit:
- [ ] code-review-graph auto-updates (PostToolUse hook handles this)
- [ ] Update Mnemon if architectural/workflow context changed
- [ ] Update product vault docs if any feature, screen, or decision changed
- [ ] Commit doc changes as a follow-up: `docs(vault): update <what> after <why>`

---

## Slice Plan

Development follows a vertical slice approach. Each slice delivers an observable, end-to-end feature increment.

See [vertical-slices.md](./vertical-slices.md) for the full slice map and specifications.

---

## ADR Lifecycle

### When to write an ADR

Write an ADR when all three are true:
1. You are choosing between approaches that are **costly to reverse** (more than a few hours to undo)
2. The decision is **architecturally load-bearing** — other slices or systems depend on it
3. The reasoning would not be obvious to someone reading the code six months later

Note the decision in the **commit message body** instead when:
- It is a library or package version choice within an already-decided framework
- It is a component-level or styling choice
- It could be changed with a small, isolated refactor

**The trigger question:** "If someone reads this commit in 6 months, will they wonder why we made this choice?" If yes → ADR. If no → commit body.

### Accepted ADRs are immutable

Once an ADR reaches `Accepted` status, its body is frozen. Do not silently edit the rationale, consequences, or alternatives. The record must reflect the thinking at the time the decision was made.

### Superseding an ADR

If a later slice changes a decision that was previously documented:

1. Write a new ADR (next sequential ID) with `Accepted` status
2. At the top of the **original ADR**, add a warning line and update its status field:

```markdown
> ⚠️ Superseded by [ADR-XXXX — Title](./ADR-XXXX-title.md)

| Field | Value |
|-------|-------|
| **Status** | Superseded by ADR-XXXX |
...
```

3. Add both ADRs to the index in `adr/README.md` and `docs/README.md`
4. Never delete an ADR — superseded records are part of the project history

### ADR format (required fields)

Every ADR must contain:
- Metadata table: Status / Date / Deciders / **Slice**
- Context
- Decision
- Alternatives Considered
- Consequences
- References (links to vault docs or other ADRs)

---

## Vertical Slice Management

### The slice map is the MVP contract

All slices in `vertical-slices.md` represent the full MVP scope. Do not delete or renumber existing slices — stable IDs are referenced in commit messages and completion records.

### Adding a new slice

When scope changes require a new slice:
1. Assign the next sequential number (e.g. VS-19)
2. Add a row to the Slice Overview table with status `Backlog`
3. Write the full spec (What / Backend / Frontend / ADR / Review checkpoint) only when it enters the Active Window — not before
4. Update `docs/README.md` status table to include the new row

### Splitting a slice

If a slice grows too large to complete in one focused session:
1. Create VS-XXa and VS-XXb (or VS-XX and VS-YY if the split is major)
2. In the Slice Overview table, mark the original as `Split → VS-XXa + VS-XXb`
3. Write specs for both sub-slices
4. Do not renumber any other slices

### Merging slices

If two pending slices turn out to be trivially small:
1. Absorb the smaller one into the larger
2. Mark the absorbed slice in the table as `Merged into VS-XX`
3. Add a note in the absorbing slice's spec: "Includes work originally scoped in VS-XX"

### Completion record (required for every finished slice)

Before moving to the next slice, add one line immediately after the slice heading:

```markdown
### VS-XX — Slice Name ✓

**Completion record:** Commit `abc1234` · Deferred: [anything not done] · Follow-up: [any known issues].
```

If nothing was deferred and there are no follow-ups: `Commit \`abc1234\` · No deferrals.`

### Window reviews (every 4 slices)

After completing VS-11, VS-15, and VS-18, before starting the next batch:
1. Read the next 4 slice specs — verify field names, endpoints, and model names match what was actually built
2. Write any ADRs that were deferred during the completed batch
3. Update the Active Window table and timestamp
4. Commit: `docs(workflow): window review after VS-XX`

**Time budget:** 15–30 minutes per review.

---

## Product Vault — Source of Truth

The Obsidian vault at `/Users/nitin/MemoryGraph/Soliofit/Soliofit/` is the single source of truth for:
- What the product does (screens, features, UX flows)
- What is in and out of MVP scope
- The technology stack summary

The ADRs in `docs/adr/` are the single source of truth for:
- Why each architecture choice was made
- What alternatives were considered and rejected

**These two sources do not duplicate each other.** The vault's Key Decisions Log in `00-index.md` is a quick-scan summary only — the ADRs are the authoritative record.

### When to update the vault

Update the vault (and commit to its git repo) when:
- A screen's layout, features, or user actions change from what is specified
- A feature is added to or removed from MVP scope
- The tech stack changes (new library, replaced dependency)
- A UX guideline or component spec changes based on what was built

Do **not** update the vault for:
- Incremental implementation details (which file a component lives in, exact API path)
- Changes that are fully captured in an ADR
- Anything that is implementation-level rather than product-level

### Vault commit format

```
docs(vault): update <document name> after <reason>

Example: docs(vault): update 01-screen-definitions after VS-07 photo upload implementation
```

Vault commits are separate from code commits. Make them as a follow-up after the implementation commit, not bundled with it.
