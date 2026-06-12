# VS-25 — Batch Camera Capture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Add Order intake camera capture **many** photos in one session (WhatsApp-style): stay open after each shutter, show an in-session thumbnail strip, and commit the whole batch to the active bucket only on **Done (n)**. The Order Detail drawer camera stays single-shot, unchanged.

**Architecture:** Extend the shared `CameraCapture` with an **opt-in** `batch` mode (additive props, default off) rather than forking a new component. In batch mode the shutter appends to an in-session `shots` array and keeps the stream live; **Done** hands `File[]` to a new `onCaptureMany` callback then closes; closing / Escape before Done discards the uncommitted shots (their object URLs are revoked on unmount). `StepPhotos`'s `PhotoBucket` opts into batch and appends the returned files to its bucket. The drawer's `PhotoSection` call site is untouched, so it keeps the proven single-shot confirm flow.

**Tech Stack:** Next.js client component, Tailwind literal-hex palette. No frontend test framework — verify with `tsc --noEmit` (dev Docker container) + a controller-run Playwright pass with a fake camera device.

**Context for the implementer:**
- `CameraCapture.tsx` is a battle-tested full-screen overlay (z-70) with 8 documented bug-fixes (secure-context check, permission-denial states, zero-dimension guards, gallery fallback, safe-area insets). **Preserve all single-shot behavior exactly** — the change must be purely additive behind `batch`.
- It is used in **two** places: `OrderDetailDrawer/PhotoSection.tsx` (single-shot — must NOT change) and `AddOrderFlow/StepPhotos.tsx`'s `PhotoBucket` (this slice switches it to batch).
- `PhotoBucket` already unmounts `CameraCapture` on Escape via a capture-phase handler (`setShowCamera(false)`), and on the camera's own close button (`onClose`). Both must drop uncommitted batch shots — handled by revoking the shots' object URLs in the component's unmount cleanup and in `handleClose`.
- Commit semantics (locked with the product owner): batch commits **only** on Done; close/back/Escape before Done discards only the in-session shots; existing staged wizard photos (held in the parent bucket) are never touched.
- In-camera thumbnail **remove** is **not required** for this slice — only include it if it falls out naturally; otherwise defer to VS-26.
- UI rules: no emojis; SVG icons only.

**Files:**
- Rewrite: `frontend/src/components/orders/CameraCapture.tsx` (add batch mode)
- Modify: `frontend/src/components/orders/AddOrderFlow/StepPhotos.tsx` (opt `PhotoBucket` into batch)
- Reference only, unchanged: `frontend/src/components/orders/OrderDetailDrawer/PhotoSection.tsx`

---

### Task 1: Add opt-in batch mode to `CameraCapture`

**Files:**
- Rewrite: `frontend/src/components/orders/CameraCapture.tsx`

- [ ] **Step 1: Replace the entire file** with the following. The single-shot path (props `onCapture`/`onClose`, `phase` state machine, denial/unsupported handling, the controls container for non-batch) is preserved **byte-for-byte**; batch is a parallel branch gated on the new `batch` prop.

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  onCapture: (file: File) => void
  onClose: () => void
  /** Batch mode (Add Order intake): stay open after each shot; commit all on Done. */
  batch?: boolean
  /** Required when `batch` — receives every captured photo when the user taps Done. */
  onCaptureMany?: (files: File[]) => void
}

type Phase = 'preview' | 'captured' | 'denied' | 'unsupported'

interface Shot { file: File; url: string }

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function CameraOffIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export default function CameraCapture({ onCapture, onClose, batch = false, onCaptureMany }: Props) {
  const [phase, setPhase] = useState<Phase>('preview')
  // True only after loadedmetadata fires with non-zero dimensions — gates the shutter button.
  const [videoReady, setVideoReady] = useState(false)
  const [denialReason, setDenialReason] = useState<'permission' | 'insecure'>('permission')
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  // Batch mode: photos captured this session, committed only on Done.
  const [shots, setShots] = useState<Shot[]>([])

  const capturedFileRef    = useRef<File | null>(null)
  const shotsRef           = useRef<Shot[]>([])
  const videoRef           = useRef<HTMLVideoElement>(null)
  const canvasRef          = useRef<HTMLCanvasElement>(null)
  const streamRef          = useRef<MediaStream | null>(null)
  const mountedRef         = useRef(true)
  const nativeFallbackRef  = useRef<HTMLInputElement>(null)

  // Mirror shots into a ref so the unmount cleanup can revoke their object URLs
  // when the session is dropped (close / Escape) before Done.
  useEffect(() => { shotsRef.current = shots }, [shots])

  // Bug-5 fix: stable applyStream that guards against unmounted use and stream leaks.
  const applyStream = useCallback((stream: MediaStream) => {
    if (!mountedRef.current) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }
    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      // play() is a belt-and-suspenders call; readiness is detected via onLoadedMetadata.
      videoRef.current.play().catch(() => {})
    }
  }, [])

  // Bug-1 fix: ideal (soft) facingMode constraint so OverconstrainedError never fires.
  // Bug-5 fix: mounted guard before any state update or stream reference assignment.
  // Bug-7 fix: SecurityError detected separately with the correct message.
  const startStream = useCallback(async () => {
    setVideoReady(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      applyStream(stream)
    } catch (err) {
      if (!mountedRef.current) return
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setDenialReason('permission')
        setPhase('denied')
      } else if (name === 'SecurityError') {
        setDenialReason('insecure')
        setPhase('denied')
      } else {
        // OverconstrainedError, NotFoundError, NotReadableError, or unknown —
        // retry once without any facingMode constraint before giving up.
        try {
          const fallback = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          applyStream(fallback)
        } catch {
          if (mountedRef.current) setPhase('unsupported')
        }
      }
    }
  }, [applyStream])

  useEffect(() => {
    mountedRef.current = true
    // getUserMedia is only available on secure contexts (HTTPS or localhost).
    if (!window.isSecureContext) {
      setDenialReason('insecure')
      setPhase('denied')
    } else if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('unsupported')
    } else {
      startStream()
    }
    return () => {
      mountedRef.current = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      // Discard any uncommitted batch shots (close / Escape before Done).
      shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url))
    }
  }, [startStream])

  // Bug-2/3 fix: only mark ready when dimensions are confirmed non-zero.
  // Bug-4 fix: onCanPlay is a secondary guard in case loadedmetadata fires with zero dims.
  function handleVideoReady() {
    const video = videoRef.current
    if (video && video.videoWidth > 0 && mountedRef.current) {
      setVideoReady(true)
    }
  }

  function handleShutter() {
    const video = videoRef.current
    const canvas = canvasRef.current
    // Bug-2 fix: hard guard — never proceed with zero dimensions.
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob || !mountedRef.current) return
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
        if (batch) {
          // Stay live; append to the in-session strip. Commit happens on Done.
          setShots((prev) => [...prev, { file, url: URL.createObjectURL(blob) }])
        } else {
          capturedFileRef.current = file
          setCapturedUrl(URL.createObjectURL(blob))
          setPhase('captured')
          streamRef.current?.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
      },
      'image/jpeg',
      0.92,
    )
  }

  async function handleRetake() {
    if (capturedUrl) {
      URL.revokeObjectURL(capturedUrl)
      setCapturedUrl(null)
    }
    capturedFileRef.current = null
    setPhase('preview')
    await startStream()
  }

  function handleUse() {
    const file = capturedFileRef.current
    if (!file) return
    onCapture(file)
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    onClose()
  }

  // Batch commit: hand all captured photos to the parent, then close.
  function handleDone() {
    onCaptureMany?.(shots.map((s) => s.file))
    shots.forEach((s) => URL.revokeObjectURL(s.url))
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    onClose()
  }

  function handleClose() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    // Discard uncommitted batch shots.
    shots.forEach((s) => URL.revokeObjectURL(s.url))
    onClose()
  }

  // Bug-8 fix: escape hatch that fires a native file/gallery picker in-context.
  function handleNativeFallback(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      if (batch) onCaptureMany?.([file])
      else onCapture(file)
      onClose()
    }
  }

  const denialMessages = {
    permission: {
      title: 'Camera access denied',
      body: 'To use the camera, go to your browser settings and allow camera access, then try again.',
    },
    insecure: {
      title: 'Camera requires HTTPS',
      body: 'Camera capture is only available over a secure connection. Use your gallery to add a photo.',
    },
  }

  // Shared denied/unsupported fallback (identical in both single-shot and batch).
  const galleryFallback = (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={() => nativeFallbackRef.current?.click()}
        className="text-black text-sm font-semibold px-6 py-2.5 rounded-full bg-white hover:bg-white/90 transition-colors"
      >
        Choose from Gallery
      </button>
      <button
        onClick={handleClose}
        className="text-white/50 text-sm hover:text-white/80 transition-colors"
      >
        Cancel
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      {/* Bug-6 fix: respect iOS dynamic island / status bar with safe-area-inset-top */}
      <button
        onClick={handleClose}
        style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
        className="absolute left-4 z-10 text-white/80 hover:text-white p-2 transition-colors"
        aria-label="Close camera"
      >
        <XIcon />
      </button>

      {/* Viewfinder */}
      <div className="flex-1 relative overflow-hidden bg-black">
        {/* Video always rendered — hidden when not in preview phase to preserve srcObject ref. */}
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover ${phase !== 'preview' ? 'hidden' : ''}`}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={handleVideoReady}
          onCanPlay={handleVideoReady}
        />

        {/* Bug-3 fix: spinner while stream hasn't delivered its first frame */}
        {phase === 'preview' && !videoReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {phase === 'captured' && capturedUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capturedUrl} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
        )}

        {(phase === 'denied' || phase === 'unsupported') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-10 gap-5 text-white/70">
            <CameraOffIcon />
            <div className="space-y-1.5">
              <p className="text-white font-medium text-base">
                {phase === 'denied' ? denialMessages[denialReason].title : 'Camera unavailable'}
              </p>
              <p className="text-sm leading-relaxed">
                {phase === 'denied'
                  ? denialMessages[denialReason].body
                  : 'This browser or device does not support in-app camera capture.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controls — batch and single-shot use separate containers so single-shot
          layout is byte-identical to the proven version. Bug-6 safe-area inset kept. */}
      {batch ? (
        <div
          className="flex flex-col items-center gap-3 pt-6 pb-10 bg-black"
          style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
        >
          {phase === 'preview' && (
            <>
              {shots.length > 0 && (
                <div className="w-full flex gap-2 overflow-x-auto px-4 pb-1">
                  {shots.map((s, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={s.url}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-white/30"
                    />
                  ))}
                </div>
              )}
              <div className="w-full relative flex items-center justify-center">
                {/* Bug-3 fix: shutter disabled and dimmed until video dimensions are ready. */}
                <button
                  onClick={handleShutter}
                  disabled={!videoReady}
                  className={`w-16 h-16 rounded-full border-4 border-white bg-white/20 transition-all
                    ${videoReady ? 'active:scale-95 hover:bg-white/30 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
                  aria-label="Take photo"
                />
                <button
                  onClick={handleDone}
                  className="absolute right-6 text-black text-sm font-semibold px-5 py-2.5 rounded-full bg-white hover:bg-white/90 active:scale-95 transition-all"
                >
                  Done{shots.length > 0 ? ` (${shots.length})` : ''}
                </button>
              </div>
            </>
          )}
          {(phase === 'denied' || phase === 'unsupported') && galleryFallback}
        </div>
      ) : (
        <div
          className="flex items-center justify-center gap-10 pt-8 pb-10 bg-black"
          style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
        >
          {phase === 'preview' && (
            // Bug-3 fix: shutter disabled and visually dimmed until video dimensions are ready.
            <button
              onClick={handleShutter}
              disabled={!videoReady}
              className={`w-16 h-16 rounded-full border-4 border-white bg-white/20 transition-all
                ${videoReady ? 'active:scale-95 hover:bg-white/30 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
              aria-label="Take photo"
            />
          )}

          {phase === 'captured' && (
            <>
              <button
                onClick={handleRetake}
                className="text-white text-sm font-medium px-5 py-2.5 rounded-full border border-white/40 hover:bg-white/10 transition-colors"
              >
                Retake
              </button>
              <button
                onClick={handleUse}
                className="text-black text-sm font-semibold px-6 py-2.5 rounded-full bg-white hover:bg-white/90 active:scale-95 transition-all"
              >
                Use Photo
              </button>
            </>
          )}

          {(phase === 'denied' || phase === 'unsupported') && galleryFallback}
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {/* Bug-8 fix: hidden native file input as the fallback path. */}
      <input
        ref={nativeFallbackRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleNativeFallback}
        onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Type-check via the dev container**

```bash
cd "/Users/nitin/Test Projects/Soliofit MVP"
docker compose -f docker-compose.dev.yml exec -T frontend npm run type-check
```
Expected: exit 0. (`onCaptureMany` is optional, so existing single-shot call sites still type-check.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/orders/CameraCapture.tsx
git commit -m "feat(camera): opt-in batch mode for CameraCapture

Adds a batch prop + onCaptureMany callback: in batch mode the shutter
stays live and appends to an in-session shots strip, committing the
whole batch only on Done (n); close/Escape before Done discards the
uncommitted shots (object URLs revoked on unmount). Single-shot path
(onCapture/onClose, used by the Order Detail drawer) is unchanged.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Opt `StepPhotos`'s `PhotoBucket` into batch

**Files:**
- Modify: `frontend/src/components/orders/AddOrderFlow/StepPhotos.tsx`

- [ ] **Step 1: Pass `batch` + `onCaptureMany`** at the `CameraCapture` mount inside `PhotoBucket`.

Replace:

```tsx
      {/* In-app camera (z-70) */}
      {showCamera && (
        <CameraCapture
          onCapture={(file) => onFilesChange([...files, file])}
          onClose={() => setShowCamera(false)}
        />
      )}
```

with:

```tsx
      {/* In-app camera (z-70) — batch mode: capture many, commit all on Done. */}
      {showCamera && (
        <CameraCapture
          batch
          onCapture={(file) => onFilesChange([...files, file])}
          onCaptureMany={(captured) => onFilesChange([...files, ...captured])}
          onClose={() => setShowCamera(false)}
        />
      )}
```

(`onCapture` is still passed to satisfy the required prop and to cover the denied-state single-file gallery fallback path; the live batch path uses `onCaptureMany`.)

- [ ] **Step 2: Type-check** (same command as Task 1 Step 2). Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/orders/AddOrderFlow/StepPhotos.tsx
git commit -m "feat(orders): Add Order camera uses batch mode (capture many, commit on Done)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Camera verification (controller-run, then hard checkpoint)

- [ ] Restart the frontend dev container (clean bundle), then a Playwright pass with a fake camera device (`--use-fake-device-for-media-stream`) at 375–390px:
  - In Add Order Step 2, open the Garment bucket camera: take **3** shots → the in-camera thumbnail strip shows 3 → **Done (3)** → all 3 land in the Garment bucket.
  - Open the Notes bucket camera: take **2** shots → **Done (2)** → 2 land in Notes (not Garment).
  - Open the camera, take **2** shots, then **Escape** (and separately, the X close button) → no photos added to the bucket (uncommitted discard), and the wizard stays alive.
  - Confirm the **Order Detail drawer** camera is still single-shot: open it, take one shot → Retake / Use Photo confirm flow appears (no Done(n) strip).
  - 375px ergonomics: shutter, strip, and Done are all reachable; no clipping; safe-area respected.
  - Zero console errors; no MediaStream left running after close (tracks stopped).
- [ ] Report results + screenshots to the product owner as the **hard checkpoint**. Do not push. Await approval before VS-26 or any push.
