# Order Creation Media Flow (Unit 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Add Order wizard the same camera-first photo capture the Order Detail drawer already has, and make the Review step show staged photos and voice notes before the order is created.

**Architecture:** Pure frontend change, three files touched. `CameraCapture.tsx` moves from `OrderDetailDrawer/` up to `components/orders/` so both surfaces share it. `StepPhotos.tsx` gets the Take Photo / Choose from Gallery action sheet (same pattern as `PhotoSection.tsx`) and a camera-first empty-state CTA. `StepReview.tsx`'s local `Draft` interface gains `pendingPhotos`/`pendingVoice` and renders them.

**Tech Stack:** Next.js (app router, client components), Tailwind utility classes with the project's literal hex palette (`#C8952A` gold, `#1A1A18`/`#6B6B67`/`#A0A09C` neutrals, `#FBF3E3` cream). No test framework on the frontend — verification is `tsc --noEmit` (via the dev Docker container) plus a scripted Playwright browser walkthrough.

**Context for the implementer:**
- The Add Order wizard (`frontend/src/components/orders/AddOrderFlow/index.tsx`) is a 6-step modal (z-50). It stages photos as `File[]` in `draft.pendingPhotos` and voice as `{ blob: Blob; duration: number } | null` in `draft.pendingVoice`, uploading both after order creation. Step components receive narrow props.
- `CameraCapture` (currently `frontend/src/components/orders/OrderDetailDrawer/CameraCapture.tsx`) is a battle-tested full-screen overlay (z-[70]): secure-context check, permission-denial states, fake-ready guards, gallery escape hatch. Its API is `{ onCapture: (file: File) => void; onClose: () => void }` — it calls `onCapture` then `onClose` on "Use Photo". **Do not modify its internals.**
- `PhotoSection.tsx` (Order Detail drawer) is the reference for the action-sheet pattern (overlay z-[60], bottom sheet, "Take Photo" / "Choose from Gallery" rows with circular icon chips).
- UI rules: no emojis anywhere — SVG icons only. Colors stay semantic: gold = brand/primary, neutrals = structure.
- z-index layering inside the wizard: modal z-50 → action sheet z-[60] → camera z-[70].

**Files:**
- Move: `frontend/src/components/orders/OrderDetailDrawer/CameraCapture.tsx` → `frontend/src/components/orders/CameraCapture.tsx`
- Modify: `frontend/src/components/orders/OrderDetailDrawer/PhotoSection.tsx` (import path only)
- Rewrite: `frontend/src/components/orders/AddOrderFlow/StepPhotos.tsx`
- Modify: `frontend/src/components/orders/AddOrderFlow/StepReview.tsx`

---

### Task 1: Share CameraCapture + wire it into StepPhotos

**Files:**
- Move: `frontend/src/components/orders/OrderDetailDrawer/CameraCapture.tsx` → `frontend/src/components/orders/CameraCapture.tsx`
- Modify: `frontend/src/components/orders/OrderDetailDrawer/PhotoSection.tsx:7`
- Rewrite: `frontend/src/components/orders/AddOrderFlow/StepPhotos.tsx`

- [ ] **Step 1: Move CameraCapture with git mv**

```bash
cd "/Users/nitin/Test Projects/Soliofit MVP"
git mv "frontend/src/components/orders/OrderDetailDrawer/CameraCapture.tsx" "frontend/src/components/orders/CameraCapture.tsx"
```

Do not edit the file's contents.

- [ ] **Step 2: Fix the import in PhotoSection.tsx**

In `frontend/src/components/orders/OrderDetailDrawer/PhotoSection.tsx`, change line 7:

```ts
// before
import CameraCapture from './CameraCapture'
// after
import CameraCapture from '../CameraCapture'
```

- [ ] **Step 3: Rewrite StepPhotos.tsx**

Replace the entire contents of `frontend/src/components/orders/AddOrderFlow/StepPhotos.tsx` with:

```tsx
'use client'

import { useRef, useState } from 'react'
import CameraCapture from '../CameraCapture'

interface Props {
  files: File[]
  onFilesChange: (files: File[]) => void
  onNext: () => void
  onBack: () => void
}

function CameraIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function GalleryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export default function StepPhotos({ files, onFilesChange, onNext, onBack }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [showCamera, setShowCamera] = useState(false)

  function handleSelect(selected: FileList | null) {
    if (!selected) return
    onFilesChange([...files, ...Array.from(selected)])
  }

  function removeFile(idx: number) {
    onFilesChange(files.filter((_, i) => i !== idx))
  }

  return (
    <div className="flex flex-col py-4">
      <p className="text-sm font-semibold text-[#1A1A18] mb-1">Garment Photos</p>
      <p className="text-xs text-[#6B6B67] mb-4 leading-relaxed">
        Add photos of the garment now, or skip and add them from the order details page later.
      </p>

      {/* Thumbnails */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {files.map((file, idx) => {
            const url = URL.createObjectURL(file)
            return (
              <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden bg-[#F5F5F3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" onLoad={() => URL.revokeObjectURL(url)} />
                <button
                  onClick={() => removeFile(idx)}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/50 text-white flex items-center justify-center"
                >
                  <XIcon />
                </button>
              </div>
            )
          })}
          <button
            onClick={() => setShowSheet(true)}
            className="w-16 h-16 rounded-lg border border-dashed border-[#C8C8C4] bg-[#FAFAF9] flex items-center justify-center text-[#A0A09C] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      )}

      {/* Empty state — camera-first primary CTA */}
      {files.length === 0 && (
        <button
          onClick={() => setShowSheet(true)}
          className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border border-dashed border-[#C8952A]/50 bg-[#FBF3E3]/40 text-[#C8952A] hover:bg-[#FBF3E3] transition-colors mb-4"
        >
          <CameraIcon />
          <span className="text-sm font-semibold">Add photos</span>
          <span className="text-[11px] font-medium text-[#A87820]/70">Camera or gallery</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleSelect(e.target.files)}
        onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
      />

      <div className="flex gap-2 mt-2">
        <button
          onClick={onBack}
          className="flex-1 py-2.5 text-sm font-medium text-[#6B6B67] border border-[#E5E5E2] rounded-lg hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        {files.length > 0 ? (
          <button
            onClick={onNext}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-[#C8952A] rounded-lg hover:bg-[#A87820] transition-colors"
          >
            Continue ({files.length})
          </button>
        ) : (
          <button
            onClick={onNext}
            className="flex-1 py-2.5 text-sm font-medium text-[#6B6B67] border border-[#E5E5E2] rounded-lg hover:bg-gray-50 transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>

      {/* Action sheet — Take Photo / Choose from Gallery (z-60 over the z-50 wizard) */}
      {showSheet && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setShowSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-2xl shadow-2xl px-4 pt-4 pb-8 lg:bottom-auto lg:top-1/2 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[420px] lg:rounded-2xl lg:pb-4">
            <div className="w-10 h-1 rounded-full bg-[#E5E5E2] mx-auto mb-5 lg:hidden" />
            <p className="text-[11px] font-semibold text-[#A0A09C] uppercase tracking-widest mb-3 px-1">
              Add Garment Photo
            </p>
            <button
              onClick={() => { setShowSheet(false); setShowCamera(true) }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#F5F5F3] transition-colors text-left"
            >
              <span className="w-9 h-9 rounded-full bg-[#F5F5F3] flex items-center justify-center text-[#1A1A18]">
                <CameraIcon size={18} />
              </span>
              <div>
                <p className="text-sm font-medium text-[#1A1A18]">Take Photo</p>
                <p className="text-xs text-[#A0A09C]">Open camera</p>
              </div>
            </button>
            <button
              onClick={() => { setShowSheet(false); inputRef.current?.click() }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#F5F5F3] transition-colors text-left"
            >
              <span className="w-9 h-9 rounded-full bg-[#F5F5F3] flex items-center justify-center text-[#1A1A18]">
                <GalleryIcon />
              </span>
              <div>
                <p className="text-sm font-medium text-[#1A1A18]">Choose from Gallery</p>
                <p className="text-xs text-[#A0A09C]">Select existing photos</p>
              </div>
            </button>
          </div>
        </>
      )}

      {/* In-app camera (z-70) */}
      {showCamera && (
        <CameraCapture
          onCapture={(file) => onFilesChange([...files, file])}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}
```

Notes on intent:
- The empty-state CTA is now the visually primary element (gold text on cream tint) and opens the **action sheet**, not the bare file input. The footer "Skip for now" drops to the same neutral outline style as "Back" so skipping is available but not emphasized.
- With photos present, the footer button stays gold "Continue (n)" exactly as before.
- The "+" thumbnail tile also opens the action sheet so camera stays reachable after the first photo.
- `CameraCapture` calls `onCapture(file)` then `onClose()` itself — no extra wiring needed.

- [ ] **Step 4: Type-check via the dev container**

```bash
cd "/Users/nitin/Test Projects/Soliofit MVP"
docker compose -f docker-compose.dev.yml exec -T frontend npm run type-check
```

Expected: exits 0 with no output errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(orders): camera-first photo capture in Add Order wizard

CameraCapture moves to components/orders/ and is now shared by the
order-detail drawer and StepPhotos. StepPhotos gains the Take Photo /
Choose from Gallery action sheet; empty-state CTA is camera-first and
Skip drops to a neutral secondary button."
```

---

### Task 2: Show staged photos + voice note on the Review step

**Files:**
- Modify: `frontend/src/components/orders/AddOrderFlow/StepReview.tsx`

- [ ] **Step 1: Extend the local Draft interface**

In `StepReview.tsx`, replace the `Draft` interface (lines 4–11) with:

```ts
interface Draft {
  customer: Customer | null
  deliveryDate: string
  totalAmount: string
  priority: boolean
  remarks: string
  pendingPhotos: File[]
  pendingVoice: { blob: Blob; duration: number } | null
  pendingInstallments: DraftInstallment[]
}
```

(`AddOrderFlow/index.tsx` already passes the full draft — this just stops narrowing it away.)

- [ ] **Step 2: Add helpers above the component**

Below `formatDate`, add:

```tsx
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function MicIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  )
}

function ReviewThumb({ file }: { file: File }) {
  const url = URL.createObjectURL(file)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      onLoad={() => URL.revokeObjectURL(url)}
      className="w-12 h-12 rounded-lg object-cover bg-[#F5F5F3]"
    />
  )
}
```

(The create-then-revoke-onLoad object-URL pattern matches `StepPhotos`.)

- [ ] **Step 3: Render photos and voice sections in the summary card**

Inside the summary card `div`, between the installments block and the remarks block, add:

```tsx
{draft.pendingPhotos.length > 0 && (
  <div className="pt-3 border-t border-[#E5E5E2]">
    <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide mb-1.5">Photos</p>
    <div className="flex flex-wrap gap-1.5">
      {draft.pendingPhotos.map((file, idx) => (
        <ReviewThumb key={idx} file={file} />
      ))}
    </div>
  </div>
)}

{draft.pendingVoice && (
  <div className="pt-3 border-t border-[#E5E5E2]">
    <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide mb-1">Voice Note</p>
    <p className="text-sm font-medium text-[#1A1A18] flex items-center gap-1.5">
      <MicIcon /> {formatDuration(draft.pendingVoice.duration)}
    </p>
  </div>
)}
```

- [ ] **Step 4: Type-check via the dev container**

```bash
cd "/Users/nitin/Test Projects/Soliofit MVP"
docker compose -f docker-compose.dev.yml exec -T frontend npm run type-check
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/orders/AddOrderFlow/StepReview.tsx
git commit -m "feat(orders): show staged photos and voice note on wizard Review step"
```

---

### Task 3: Browser verification (controller-run)

- [ ] Playwright walkthrough on the dev server (mobile 390×844, fake camera device): wizard step 2 shows the new CTA + action sheet; "Take Photo" opens CameraCapture and the shutter captures into the thumbnail strip; review step shows photo thumbnails; desktop action sheet renders centered; order-detail drawer camera still works after the file move. Zero console errors.
