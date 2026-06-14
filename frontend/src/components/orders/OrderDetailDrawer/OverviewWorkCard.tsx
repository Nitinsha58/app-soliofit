'use client'

import { useState, useEffect, useRef } from 'react'
import type { OrderPhoto, VoiceNote } from '@/lib/api/media'
import { listPhotos, listVoiceNotes } from '@/lib/api/media'

// VS-28.2 — Overview "Today's Work" preview. Deliberately tiny: it signals "there is work
// material here, tap to inspect" (§0.2 A1), NOT a second Work tab. Read-only; fetches the same
// media APIs the Work tab uses — duplicate reads are acceptable for now and may later be
// consolidated with Work-tab data (left intentionally un-shared to avoid over-engineering 28.2).
export default function OverviewWorkCard({ orderId, onViewWork }: { orderId: string; onViewWork: () => void }) {
  const [photos, setPhotos] = useState<OrderPhoto[]>([])
  const [voiceCount, setVoiceCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    Promise.all([listPhotos(orderId), listVoiceNotes(orderId)])
      .then(([p, v]: [OrderPhoto[], VoiceNote[]]) => {
        if (!mountedRef.current) return
        setPhotos(p)
        setVoiceCount(v.length)
      })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false) })
    return () => { mountedRef.current = false }
  }, [orderId])

  const parts: string[] = []
  if (photos.length > 0) parts.push(`${photos.length} photo${photos.length === 1 ? '' : 's'}`)
  if (voiceCount > 0) parts.push(`${voiceCount} voice note${voiceCount === 1 ? '' : 's'}`)
  const hasWork = parts.length > 0
  const thumbs = photos.slice(0, 3)

  return (
    <button
      type="button"
      onClick={onViewWork}
      className="w-full flex items-center gap-3 rounded-xl border border-[#E5E5E2] bg-white p-3.5 text-left hover:bg-[#FAFAF8] transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide mb-0.5">Work instructions</p>
        <p className={`text-xs leading-relaxed ${hasWork ? 'text-[#6B6B67]' : 'text-[#C8C8C4]'}`}>
          {loading ? 'Loading…' : hasWork ? parts.join(' · ') : 'Add work instructions'}
        </p>
      </div>

      {thumbs.length > 0 && (
        <div className="flex -space-x-2 shrink-0">
          {thumbs.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.id}
              src={p.public_url}
              alt=""
              className="w-9 h-9 rounded-md object-cover border-2 border-white bg-[#F5F5F3]"
            />
          ))}
        </div>
      )}

      <span className="text-[#A0A09C] shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
    </button>
  )
}
