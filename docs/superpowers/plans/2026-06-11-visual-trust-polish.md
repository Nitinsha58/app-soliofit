# Visual Trust Polish (Unit 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align every surface with the vault-07 palette rule — neutral base + one warm gold accent (`#C8952A`), with color kept semantic (gold = brand/in-progress, red = attention, green = done, amber = partial, neutral = structure) — and tighten the Add Order wizard's presentation details.

**Architecture:** Four independent sweeps: (1) a new shared `lib/orderStatus.ts` replaces four duplicated blue/violet `STATUS_COLORS` maps; (2) the Kanban `COLUMNS` accent hexes (single source for desktop columns AND mobile FocusedColumn) drop blue/purple; (3) the three auth pages + auth layout move from slate-gray to the brand palette; (4) wizard polish — segmented step progress, larger photo thumbnails, labeled installment-add button.

**Tech Stack:** Next.js client components, Tailwind with literal hex palette. No frontend tests — verify with `tsc --noEmit` (dev Docker container) + Playwright walkthrough (controller-run).

**Palette decisions (locked):**
- Status semantics: Booked = neutral (just entered), Started = gold tint (in the workshop — the one brand-accent status), Ready = emerald (done), Partial Delivery = amber (incomplete), Delivered = quiet gray (terminal).
- Blue (`#60A5FA`, `blue-50/700`) and violet/purple (`#A78BFA`, `violet-50/700`) are eliminated entirely.
- Existing emerald/amber/red usages are semantic and stay.

---

### Task 1: Shared status pill map (kills blue/violet status pills)

**Files:**
- Create: `frontend/src/lib/orderStatus.ts`
- Modify: `frontend/src/components/orders/OrderDetailDrawer/OrderHeader.tsx:15-21`
- Modify: `frontend/src/components/orders/ScheduleView/ScheduleCard.tsx:10-16`
- Modify: `frontend/src/components/search/OrderRow.tsx:6-12`
- Modify: `frontend/src/components/customers/CustomerProfile/CustomerOrdersTab.tsx:7-13`

- [ ] **Step 1: Create `frontend/src/lib/orderStatus.ts`**

```ts
import type { Order } from '@/lib/api/orders'

// Single source for order-status pill colors (vault 07 palette rule:
// neutral base + one warm gold accent; color stays semantic).
// Booked = neutral entry, Started = gold (in progress), Ready = green (done),
// Partial Delivery = amber (incomplete), Delivered = quiet terminal gray.
export const STATUS_PILL: Record<Order['status'], string> = {
  'Booked':           'bg-[#F5F5F3] text-[#6B6B67]',
  'Started':          'bg-[#FBF3E3] text-[#A87820]',
  'Ready':            'bg-emerald-50 text-emerald-700',
  'Partial Delivery': 'bg-amber-50 text-amber-700',
  'Delivered':        'bg-gray-100 text-gray-600',
}

// Variant with a border, used by the order-detail header status dropdown.
export const STATUS_PILL_BORDERED: Record<Order['status'], string> = {
  'Booked':           'bg-[#F5F5F3] text-[#6B6B67] border-[#E5E5E2]',
  'Started':          'bg-[#FBF3E3] text-[#A87820] border-[#C8952A]/30',
  'Ready':            'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Partial Delivery': 'bg-amber-50 text-amber-700 border-amber-200',
  'Delivered':        'bg-gray-100 text-gray-600 border-gray-200',
}
```

- [ ] **Step 2: Swap the four local maps for imports**

In each file, delete the local `STATUS_COLORS` const and import from the lib instead, keeping every usage site's expression shape identical:

- `OrderHeader.tsx`: add `import { STATUS_PILL_BORDERED } from '@/lib/orderStatus'`, delete the local `STATUS_COLORS` (lines 15–21), and rename usages `STATUS_COLORS[...]` → `STATUS_PILL_BORDERED[...]`.
- `ScheduleCard.tsx`, `OrderRow.tsx`, `CustomerOrdersTab.tsx`: add `import { STATUS_PILL } from '@/lib/orderStatus'`, delete each local `STATUS_COLORS`, rename usages → `STATUS_PILL[...]`.
- `OrderRow.tsx` and `CustomerOrdersTab.tsx` typed their maps `Record<string, string>` — if indexing with a plain `string` now errors against `Record<Order['status'], string>`, keep the existing runtime behavior with `STATUS_PILL[status as Order['status']] ?? 'bg-gray-100 text-gray-600'` (import the `Order` type as needed). Do not loosen the lib's key type.

- [ ] **Step 3: Type-check**

```bash
cd "/Users/nitin/Test Projects/Soliofit MVP"
docker compose -f docker-compose.dev.yml exec -T frontend npm run type-check
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/orderStatus.ts frontend/src/components
git commit -m "refactor(ui): centralize status pill colors; Booked/Started drop blue/violet for neutral/gold"
```

---

### Task 2: Kanban column accents + calendar stat box

**Files:**
- Modify: `frontend/src/components/dashboard/KanbanBoard.tsx:22-30`
- Modify: `frontend/src/app/(app)/calendar/page.tsx:217`

- [ ] **Step 1: Replace the COLUMNS accents in KanbanBoard.tsx**

```ts
const COLUMNS: { status: Order['status']; label: string; accent: string }[] = [
  { status: 'Booked',           label: 'Booked',           accent: '#A0A09C' },
  { status: 'Started',          label: 'Started',          accent: '#C8952A' },
  { status: 'Ready',            label: 'Ready',            accent: '#34D399' },
  { status: 'Partial Delivery', label: 'Partial Delivery', accent: '#FBBF24' },
  { status: 'Delivered',        label: 'Delivered',        accent: '#9CA3AF' },
]
```

(Only the `accent` values for Booked `#60A5FA`→`#A0A09C` and Started `#A78BFA`→`#C8952A` change; keep any comments/other lines between entries exactly as they are.) These accents feed `BoardColumn` (desktop top bars, money/count pills, drag ring) and `FocusedColumn`/mobile — both fixed by this one table. Confirm with `grep -rn "60A5FA\|A78BFA" frontend/src` → no hits afterwards.

- [ ] **Step 2: Calendar "To collect" stat box — violet → gold tint**

In `frontend/src/app/(app)/calendar/page.tsx` line 217:

```tsx
// before
icon={<span className="text-[15px] font-bold">₹</span>} boxClass="bg-violet-50 text-violet-600"
// after
icon={<span className="text-[15px] font-bold">₹</span>} boxClass="bg-[#FBF3E3] text-[#A87820]"
```

Confirm `grep -rn "violet\|purple\|indigo" frontend/src` → no hits.

- [ ] **Step 3: Type-check (same command as Task 1). Expected: exit 0.**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/dashboard/KanbanBoard.tsx "frontend/src/app/(app)/calendar/page.tsx"
git commit -m "style(dashboard): Kanban accents on-palette — Booked neutral, Started gold; calendar collect box gold"
```

---

### Task 3: Auth pages on-brand (login, forgot-password, reset-password, layout)

**Files:**
- Modify: `frontend/src/app/(auth)/layout.tsx`
- Modify: `frontend/src/app/(auth)/login/page.tsx`
- Modify: `frontend/src/app/(auth)/forgot-password/page.tsx`
- Modify: `frontend/src/app/(auth)/reset-password/page.tsx`

Apply these exact substitutions consistently across all three pages (and the layout). Do not restructure the forms or touch react-hook-form/zod logic.

- [ ] **Step 1: Warm background in `layout.tsx`**

`bg-gray-50` → `bg-[#F7F5F0]` (warm near-white, vault 07 base).

- [ ] **Step 2: Brand wordmark on the login card**

In `login/page.tsx`, replace the `h1` (line 39):

```tsx
// before
<h1 className="text-2xl font-bold text-gray-900 mb-1">Soliofit</h1>
// after
<h1 className="text-2xl font-bold text-[#1A1A18] mb-1 tracking-tight">
  Soliofit<span className="text-[#C8952A]">.</span>
</h1>
```

`forgot-password` ("Reset password") and `reset-password` ("Set a new password" / "Link expired") keep their functional `h1` titles — just recolor `text-gray-900` → `text-[#1A1A18]`.

- [ ] **Step 3: Palette substitutions on all three pages**

| Before | After |
|---|---|
| `bg-gray-900 text-white … hover:bg-gray-800` (primary buttons) | `bg-[#C8952A] text-white … hover:bg-[#A87820]` |
| `focus:ring-2 focus:ring-gray-900 focus:border-transparent` (inputs) | `focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]` |
| `border-gray-300` (inputs) | `border-[#E5E5E2]` |
| `border-gray-200` (card) | `border-[#E5E5E2]` |
| `text-gray-900` (headings/emphasis links) | `text-[#1A1A18]` |
| `text-gray-700` (labels) | `text-[#1A1A18]` |
| `text-gray-500 hover:text-gray-900` (quiet links, e.g. "Forgot password?") | `text-[#6B6B67] hover:text-[#A87820]` |
| `text-gray-500` (subtitles) | `text-[#6B6B67]` |

Red error styling stays. The reset-success "back to sign in" link (`text-gray-900 hover:underline`) becomes `text-[#A87820] hover:underline`.
Afterwards `grep -n "gray-900\|gray-800\|gray-300\|ring-gray" frontend/src/app/\(auth\)` → no hits.

- [ ] **Step 4: Type-check (same command). Expected: exit 0.**

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/app/(auth)"
git commit -m "style(auth): rebrand login/forgot/reset — gold primary, warm background, brand wordmark"
```

---

### Task 4: Wizard presentation details

**Files:**
- Modify: `frontend/src/components/orders/AddOrderFlow/index.tsx:151-159`
- Modify: `frontend/src/components/orders/AddOrderFlow/StepPhotos.tsx` (thumbnail block)
- Modify: `frontend/src/components/orders/AddOrderFlow/DraftInstallments.tsx:191-201,280-282`

- [ ] **Step 1: Segmented step progress in `index.tsx`**

Replace the progress-bar block (the `div` containing the single `h-1 bg-[#E5E5E2]` track, lines ~152–159) with one segment per step:

```tsx
{/* Progress — one segment per step */}
<div className="px-6 pt-3 pb-1 flex-shrink-0">
  <div className="flex gap-1">
    {STEP_LABELS.map((label, i) => (
      <div
        key={label}
        className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
          i < step ? 'bg-[#C8952A]' : 'bg-[#E5E5E2]'
        }`}
      />
    ))}
  </div>
</div>
```

- [ ] **Step 2: Bigger thumbnails in `StepPhotos.tsx`**

In the thumbnail map block: tile `w-16 h-16` → `w-20 h-20` (both the photo tiles and the dashed "+" tile), and the remove badge `w-4 h-4` → `w-5 h-5` with position `top-0.5 right-0.5` → `top-1 right-1`. The `XIcon` and everything else stays. (Matches the drawer PhotoSection's 80px tiles.)

- [ ] **Step 3: Labeled installment-add button in `DraftInstallments.tsx`**

Replace the icon-only add button (lines 191–201):

```tsx
<button
  type="button"
  onClick={() => { setAdding(true); setEditingId(null) }}
  disabled={busy}
  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#A87820] bg-[#FBF3E3] hover:bg-[#F5E8C8] transition-colors disabled:opacity-40"
>
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
  Add installment
</button>
```

(The `aria-label` is no longer needed — the button now has visible text.)

And update the empty-state hint (line ~281) since there is no longer a bare "+":

```tsx
// before
<p className="text-xs text-[#C8C8C4] py-1">No installments — tap + to split the payment</p>
// after
<p className="text-xs text-[#C8C8C4] py-1">No installments — add one to split the payment</p>
```

- [ ] **Step 4: Type-check (same command). Expected: exit 0.**

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/orders/AddOrderFlow
git commit -m "style(orders): wizard polish — segmented step progress, larger photo thumbnails, labeled installment add"
```

---

### Task 5: Browser verification (controller-run)

- [ ] Playwright pass (mobile 390×844 + desktop 1440×900): login page shows warm bg, wordmark, gold button + gold focus ring; dashboard mobile section header bar/pills no longer purple (Started = gold, Booked = neutral); desktop Kanban bars on-palette; status pills in order drawer/schedule/search show neutral Booked + gold-tinted Started; wizard shows segmented progress, 80px thumbnails, "Add installment" button; calendar "To collect" box gold. `grep` confirms zero `blue-50|violet|purple|indigo|#60A5FA|#A78BFA` in `frontend/src` (the semantic `blue` check scoped to status UI). Zero console errors.
