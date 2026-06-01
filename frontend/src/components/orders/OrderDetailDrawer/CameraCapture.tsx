'use client'

import { useEffect, useRef, useState } from 'react'

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
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const capturedFileRef = useRef<File | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('unsupported')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
      .catch((err: unknown) => {
        const name = err instanceof Error ? err.name : ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setPhase('denied')
        } else {
          setPhase('unsupported')
        }
      })
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function handleShutter() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
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

  function handleRetake() {
    if (capturedUrl) {
      URL.revokeObjectURL(capturedUrl)
      setCapturedUrl(null)
    }
    capturedFileRef.current = null
    setPhase('preview')
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
      .catch(() => setPhase('unsupported'))
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
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      <button
        onClick={handleClose}
        className="absolute top-4 left-4 z-10 text-white/80 hover:text-white p-2 transition-colors"
        aria-label="Close camera"
      >
        <XIcon />
      </button>

      {/* Viewfinder */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover ${phase !== 'preview' ? 'hidden' : ''}`}
          autoPlay
          playsInline
          muted
        />

        {phase === 'captured' && capturedUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capturedUrl} alt="Captured" className="absolute inset-0 w-full h-full object-cover" />
        )}

        {(phase === 'denied' || phase === 'unsupported') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 gap-4 text-white/70">
            <CameraOffIcon />
            <div>
              <p className="text-white font-medium mb-1">
                {phase === 'denied' ? 'Camera access denied' : 'Camera unavailable'}
              </p>
              <p className="text-sm">
                {phase === 'denied'
                  ? 'Allow camera access in your browser settings, then try again.'
                  : 'Use "Choose from Gallery" to add a photo instead.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-10 py-10 bg-black">
        {phase === 'preview' && (
          <button
            onClick={handleShutter}
            className="w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 active:scale-95 transition-all"
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

        {(phase === 'denied' || phase === 'unsupported') && (
          <button
            onClick={handleClose}
            className="text-white text-sm font-medium px-5 py-2.5 rounded-full border border-white/40 hover:bg-white/10 transition-colors"
          >
            Close
          </button>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
