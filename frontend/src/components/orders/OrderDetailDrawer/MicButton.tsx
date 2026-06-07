'use client'

import { useState, useRef, useEffect } from 'react'
import type { VoiceNote } from '@/lib/api/media'
import { presignUpload, uploadToStorage, saveVoiceNote } from '@/lib/api/media'

interface Props {
  orderId: string
  onNoteAdded: (note: VoiceNote) => void
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

export default function MicButton({ orderId, onNoteAdded }: Props) {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const recorderRef      = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const durationRef      = useRef(0)
  const mountedRef       = useRef(true)
  const pendingStopRef   = useRef(false)  // true if pointerup fired before recorder was ready

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop()
      if (timerRef.current) clearInterval(timerRef.current)
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current)
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    }
  }, [])

  function showHint(msg: string, ms = 2500) {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    setHint(msg)
    hintTimerRef.current = setTimeout(() => { if (mountedRef.current) setHint(null) }, ms)
  }

  async function startRecording() {
    if (isRecording || isUploading) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      durationRef.current = 0

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        if (timerRef.current) clearInterval(timerRef.current)
        if (maxTimerRef.current) clearTimeout(maxTimerRef.current)

        const finalDuration = durationRef.current
        if (!mountedRef.current) return

        setIsRecording(false)
        setDuration(0)

        if (finalDuration < 1) {
          showHint('Hold longer to record')
          return
        }

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        doUpload(blob, finalDuration)
      }

      recorder.start()
      recorderRef.current = recorder
      if (mountedRef.current) { setIsRecording(true); setDuration(0) }

      // Pointer was released while getUserMedia was still pending — stop immediately
      if (pendingStopRef.current) { recorder.stop(); return }

      timerRef.current = setInterval(() => {
        durationRef.current += 1
        if (mountedRef.current) setDuration((d) => d + 1)
      }, 1000)

      // Auto-stop at 5 minutes
      maxTimerRef.current = setTimeout(() => stopRecording(), 300_000)
    } catch {
      if (mountedRef.current) showHint('Microphone access denied', 3000)
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }

  async function doUpload(blob: Blob, durationSecs: number) {
    if (!mountedRef.current) return
    setIsUploading(true)
    try {
      const ext = blob.type.includes('ogg') ? '.ogg' : '.webm'
      const { upload_url, public_url, s3_key, content_type } = await presignUpload(
        'voice-notes',
        `recording${ext}`,
        blob.type || 'audio/webm',
        blob.size,
      )
      await uploadToStorage(upload_url, new File([blob], `recording${ext}`, { type: blob.type }), content_type)
      const note = await saveVoiceNote(orderId, s3_key, public_url, Math.round(durationSecs))
      if (mountedRef.current) { onNoteAdded(note); setIsUploading(false) }
    } catch {
      if (mountedRef.current) { setIsUploading(false); showHint('Upload failed — try again', 3000) }
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault()
    pendingStopRef.current = false
    startRecording()
    window.addEventListener('pointerup', () => {
      pendingStopRef.current = true
      stopRecording()
    }, { once: true })
  }

  return (
    <div className="flex flex-col items-center mb-4">
      <button
        onPointerDown={handlePointerDown}
        disabled={isUploading}
        aria-label={isRecording ? 'Stop recording' : 'Record voice note'}
        className={[
          'relative w-14 h-14 rounded-full flex items-center justify-center select-none touch-none transition-all duration-150',
          isRecording
            ? 'bg-red-500 shadow-[0_0_0_6px_rgba(239,68,68,0.2)]'
            : 'bg-[#C8952A] hover:bg-[#A87820]',
          isUploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
        ].join(' ')}
      >
        {isUploading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : isRecording ? (
          <div className="flex items-end gap-px h-5">
            {([0, 0.15, 0.3, 0.15, 0] as number[]).map((delay, i) => (
              <div
                key={i}
                className="w-1 bg-white rounded-full origin-bottom"
                style={{ height: 14, animation: `voiceBar 0.5s ease-in-out ${delay}s infinite alternate` }}
              />
            ))}
          </div>
        ) : (
          <MicIcon />
        )}
      </button>

      <p className="mt-2 text-[11px] text-[#A0A09C]">
        {isUploading ? 'Saving…' : isRecording ? formatTime(duration) : 'Hold to record'}
      </p>

      {hint && <p className="mt-0.5 text-[10px] text-[#A0A09C]">{hint}</p>}
    </div>
  )
}
