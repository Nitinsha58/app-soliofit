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

## Phase Implementation Plans

| Phase | Plan |
|-------|------|
| Phase 0 — Foundation | [phase-0-units.md](./phase-0-units.md) |
| Phase 1 — Order Core | Planned after Phase 0 review |
| Phase 2 — Payments | Planned after Phase 1 review |
| Phase 3 — Discovery | Planned after Phase 2 review |
| Phase 4 — Polish | Planned after Phase 3 review |
