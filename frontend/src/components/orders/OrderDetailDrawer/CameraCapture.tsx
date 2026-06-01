'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  onCapture: (file: File) => void
  onClose: () => void
}

type Phase = 'preview' | 'captured' | 'denied' | 'unsupported'

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

export default function CameraCapture({ onCapture, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('preview')
  // True only after loadedmetadata fires with non-zero dimensions — gates the shutter button.
  const [videoReady, setVideoReady] = useState(false)
  const [denialReason, setDenialReason] = useState<'permission' | 'insecure'>('permission')
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)

  const capturedFileRef    = useRef<File | null>(null)
  const videoRef           = useRef<HTMLVideoElement>(null)
  const canvasRef          = useRef<HTMLCanvasElement>(null)
  const streamRef          = useRef<MediaStream | null>(null)
  const mountedRef         = useRef(true)
  const nativeFallbackRef  = useRef<HTMLInputElement>(null)

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
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('unsupported')
    } else {
      startStream()
    }
    return () => {
      mountedRef.current = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
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
        capturedFileRef.current = file
        setCapturedUrl(URL.createObjectURL(blob))
        setPhase('captured')
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
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

  function handleClose() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    onClose()
  }

  // Bug-8 fix: escape hatch that fires a native file/gallery picker in-context.
  function handleNativeFallback(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      onCapture(file)
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

      {/* Controls — Bug-6 fix: safe-area-inset-bottom keeps shutter clear of home bar */}
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
              ${videoReady
                ? 'active:scale-95 hover:bg-white/30 cursor-pointer'
                : 'opacity-40 cursor-not-allowed'
              }`}
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

        {/* Bug-8 fix: offer gallery escape hatch without closing the overlay. */}
        {(phase === 'denied' || phase === 'unsupported') && (
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
        )}
      </div>

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
