# Product Documentation Reference

All product documentation is maintained in the Obsidian vault at:

```
/Users/nitin/MemoryGraph/Soliofit/Soliofit
```

This vault is version-controlled with git. Do not duplicate content here — always reference the vault as the single source of truth.

---

## Document Index

| File | Contents | Audience |
|------|---------|---------|
| `00-index.md` | Master index, tech stack summary, key decisions log | All |
| `01-screen-definitions.md` | All 10 screens — purpose, features, actions, nav flow, data | Designers, Frontend |
| `02-feature-set.md` | Core MVP features, post-MVP, automation, notifications | PM, All Devs |
| `03-technical-architecture.md` | Tech stack, directory structures, API design, DB schema, auth | All Devs |
| `04-system-design.md` | Entity relationships, module breakdown, scalability, security | Backend, Architects |
| `05-product-structure.md` | User roles, workflows, customer/order/payment lifecycle | PM, All Devs |
| `06-dashboard-definitions.md` | Operational & payments dashboards, KPI definitions | Designers, Frontend, PM |
| `07-ux-guidelines.md` | Design direction, layout, color palette, typography, components | Designers, Frontend |
| `08-devops-deployment.md` | Docker, CI/CD, EC2, Nginx, monitoring, backups | DevOps, Backend |
| `09-mvp-scope.md` | P0/P1/P2 priorities, 4-phase plan, implementation sequence | PM, All Devs |

---

## Reading Order for Developers

If you are new to the project, read in this order:
1. `00-index.md` — understand the product and stack in 5 minutes
2. `09-mvp-scope.md` — understand what we're building and why
3. `03-technical-architecture.md` — understand how it's built
4. `01-screen-definitions.md` — understand what each screen does

---

## Updating Documentation

When a feature, screen, or technical decision changes:
1. Update the relevant file in the vault
2. Bump the document version in the file header
3. Commit: `cd /Users/nitin/MemoryGraph/Soliofit/Soliofit && git add -A && git commit -m "docs: <what changed and why>"`
