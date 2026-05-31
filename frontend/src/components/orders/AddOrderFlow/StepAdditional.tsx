'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  remarks: string
  priority: boolean
  pendingVoice: { blob: Blob; duration: number } | null
  onRemarksChange: (v: string) => void
  onPriorityChange: (v: boolean) => void
  onVoiceRecorded: (blob: Blob, duration: number) => void
  onVoiceClear: () => void
  onNext: () => void
  onBack: () => void
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function VoiceRecorder({
  onRecorded,
}: {
  onRecorded: (blob: Blob, duration: number) => void
}) {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [hint, setHint] = useState<string | null>(null)

  const recorderRef    = useRef<MediaRecorder | null>(null)
  const chunksRef      = useRef<Blob[]>([])
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const durationRef    = useRef(0)
  const mountedRef     = useRef(true)
  const pendingStopRef = useRef(false)

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
    if (isRecording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
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
        if (finalDuration < 1) { showHint('Hold longer to record'); return }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        onRecorded(blob, finalDuration)
      }

      recorder.start()
      recorderRef.current = recorder
      if (mountedRef.current) { setIsRecording(true); setDuration(0) }
      if (pendingStopRef.current) { recorder.stop(); return }

      timerRef.current = setInterval(() => {
        durationRef.current += 1
        if (mountedRef.current) setDuration((d) => d + 1)
      }, 1000)
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
    <div className="flex flex-col items-center py-2">
      <button
        onPointerDown={handlePointerDown}
        aria-label={isRecording ? 'Stop recording' : 'Record voice note'}
        className={[
          'w-12 h-12 rounded-full flex items-center justify-center select-none touch-none transition-all duration-150',
          isRecording
            ? 'bg-red-500 shadow-[0_0_0_5px_rgba(239,68,68,0.2)] text-white'
            : 'bg-[#F5F5F3] border border-[#E5E5E2] text-[#6B6B67] hover:border-[#C8952A] hover:text-[#C8952A]',
        ].join(' ')}
      >
        {isRecording ? (
          <div className="flex items-end gap-px h-4">
            {([0, 0.15, 0.3, 0.15, 0] as number[]).map((delay, i) => (
              <div
                key={i}
                className="w-0.5 bg-white rounded-full origin-bottom"
                style={{ height: 10, animation: `voiceBar 0.5s ease-in-out ${delay}s infinite alternate` }}
              />
            ))}
          </div>
        ) : (
          <MicIcon />
        )}
      </button>

      <p className="mt-1.5 text-[11px] text-[#A0A09C]">
        {isRecording ? formatTime(duration) : 'Hold to record'}
      </p>
      {hint && <p className="mt-0.5 text-[10px] text-[#A0A09C]">{hint}</p>}
    </div>
  )
}

export default function StepAdditional({
  remarks,
  priority,
  pendingVoice,
  onRemarksChange,
  onPriorityChange,
  onVoiceRecorded,
  onVoiceClear,
  onNext,
  onBack,
}: Props) {
  return (
    <div>
      <div className="space-y-4">
        {/* Voice note */}
        <div>
          <label className="block text-xs font-medium text-[#1A1A18] mb-2">Voice Note</label>
          {pendingVoice ? (
            <div className="flex items-center justify-between px-3 py-2.5 border border-[#E5E5E2] rounded-lg bg-[#FAFAF9]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#C8952A]/10 flex items-center justify-center">
                  <MicIcon />
                </div>
                <span className="text-sm text-[#1A1A18]">
                  Recording · {formatTime(Math.round(pendingVoice.duration))}
                </span>
              </div>
              <button
                onClick={onVoiceClear}
                aria-label="Remove voice note"
                className="text-[#A0A09C] hover:text-red-500 transition-colors text-sm px-1"
              >
                ×
              </button>
            </div>
          ) : (
            <VoiceRecorder onRecorded={onVoiceRecorded} />
          )}
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-xs font-medium text-[#1A1A18] mb-1.5">
            Internal Remarks
          </label>
          <textarea
            value={remarks}
            onChange={(e) => onRemarksChange(e.target.value)}
            placeholder="Add any notes about this order…"
            rows={3}
            className="w-full px-3 py-2.5 border border-[#E5E5E2] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A] resize-none"
          />
        </div>

        {/* Priority */}
        <div className="flex items-center justify-between p-4 border border-[#E5E5E2] rounded-lg">
          <div>
            <p className="text-sm font-medium text-[#1A1A18]">Priority Order</p>
            <p className="text-xs text-[#A0A09C] mt-0.5">Mark for urgent attention</p>
          </div>
          <button
            onClick={() => onPriorityChange(!priority)}
            role="switch"
            aria-checked={priority}
            className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${priority ? 'bg-[#C8952A]' : 'bg-[#E5E5E2]'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${priority ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 mt-6">
        <button
          onClick={onBack}
          className="flex-1 py-2.5 text-sm font-medium text-[#6B6B67] border border-[#E5E5E2] rounded-lg hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-2.5 text-sm font-medium text-white bg-[#C8952A] rounded-lg hover:bg-[#A87820] transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}
