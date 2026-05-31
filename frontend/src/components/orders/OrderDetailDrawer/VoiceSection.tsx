'use client'

import { useState, useEffect, useRef } from 'react'
import type { VoiceNote } from '@/lib/api/media'
import { listVoiceNotes, deleteVoiceNote } from '@/lib/api/media'
import MicButton from './MicButton'

interface Props {
  orderId: string
}

// Stable pseudo-random waveform seeded from note ID
function getWaveformBars(id: string, count = 30): number[] {
  return Array.from({ length: count }, (_, i) => {
    const c = id.charCodeAt(i % id.length)
    return 15 + (((c * 13 + i * 7) ^ (i * 31)) % 65)
  })
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatAge(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const SPEEDS = [1, 1.5, 2] as const
type Speed = (typeof SPEEDS)[number]

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
  )
}

function VoiceNoteCard({ note, onDelete }: { note: VoiceNote; onDelete: (id: string) => void }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(note.duration_seconds)
  const [speed, setSpeed] = useState<Speed>(1)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const bars = getWaveformBars(note.id)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onEnded = () => { setPlaying(false); setCurrentTime(0) }
    const onLoaded = () => { if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration) }
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('loadedmetadata', onLoaded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('loadedmetadata', onLoaded)
    }
  }, [])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { audio.play(); setPlaying(true) }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current
    if (!audio) return
    const t = parseFloat(e.target.value)
    audio.currentTime = t
    setCurrentTime(t)
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
    setSpeed(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  const progress = duration > 0 ? currentTime / duration : 0

  return (
    <div className="border border-[#E5E5E2] rounded-xl p-3 bg-white">
      <audio ref={audioRef} src={note.public_url} preload="metadata" />

      {/* Play + waveform + speed + trash */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={togglePlay}
          className="flex-shrink-0 w-8 h-8 rounded-full bg-[#C8952A] flex items-center justify-center text-white hover:bg-[#A87820] transition-colors pl-0.5"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        {/* Waveform bars — seek input overlaid invisibly */}
        <div className="relative flex-1 h-8 flex items-end gap-px">
          {bars.map((h, i) => {
            const active = i / bars.length <= progress
            return (
              <div
                key={i}
                className={`flex-1 rounded-sm ${active ? 'bg-[#C8952A]' : 'bg-[#E5E5E2]'}`}
                style={{ height: `${h}%` }}
              />
            )
          })}
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        </div>

        <button
          onClick={cycleSpeed}
          className="flex-shrink-0 w-7 text-center text-[11px] font-semibold text-[#6B6B67] hover:text-[#C8952A] transition-colors"
        >
          {speed}×
        </button>

        <button
          onClick={() => setConfirmDelete(true)}
          className="flex-shrink-0 text-[#A0A09C] hover:text-red-500 transition-colors p-0.5"
        >
          <TrashIcon />
        </button>
      </div>

      {/* Time + timestamp */}
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-[#A0A09C] tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <span className="text-[10px] text-[#A0A09C]">{formatAge(note.created_at)}</span>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="mt-2 flex items-center justify-end gap-2">
          <span className="text-xs text-[#6B6B67]">Delete this recording?</span>
          <button
            onClick={() => { setConfirmDelete(false); onDelete(note.id) }}
            className="text-xs font-semibold text-white bg-red-500 rounded-md px-2.5 py-1"
          >
            Delete
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-xs text-[#6B6B67] hover:text-[#1A1A18]"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

export default function VoiceSection({ orderId }: Props) {
  const [notes, setNotes] = useState<VoiceNote[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    listVoiceNotes(orderId)
      .then((n) => { if (mountedRef.current) setNotes(n) })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false) })
    return () => { mountedRef.current = false }
  }, [orderId])

  async function handleDelete(noteId: string) {
    setNotes((n) => n.filter((x) => x.id !== noteId))
    try { await deleteVoiceNote(orderId, noteId) } catch { /* optimistic */ }
  }

  // Called by MicButton (Unit 3) after a successful upload
  function handleNoteAdded(note: VoiceNote) {
    setNotes((n) => [...n, note])
  }

  if (loading) {
    return (
      <div className="mx-5 mb-4 py-4 flex items-center justify-center">
        <div className="w-4 h-4 border border-[#A0A09C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-5 mb-4">
      <p className="text-[11px] font-semibold text-[#A0A09C] uppercase tracking-widest mb-3">Voice Notes</p>

      <MicButton orderId={orderId} onNoteAdded={handleNoteAdded} />

      {notes.length === 0 ? (
        <p className="text-xs text-[#A0A09C] text-center py-3">No voice notes yet</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <VoiceNoteCard key={note.id} note={note} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
