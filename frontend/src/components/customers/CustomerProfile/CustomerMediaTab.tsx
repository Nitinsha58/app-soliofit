'use client'

import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCustomerMedia, type CustomerPhoto, type CustomerVoiceNote } from '@/lib/api/customers'
import PhotoLightbox from '@/components/orders/OrderDetailDrawer/PhotoLightbox'
import type { OrderPhoto } from '@/lib/api/media'

function toOrderPhoto(p: CustomerPhoto): OrderPhoto {
  return { id: p.id, s3_key: '', public_url: p.public_url, photo_type: p.photo_type, display_order: 0, created_at: '' }
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function PlayIcon({ playing }: { playing: boolean }) {
  if (playing) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

function VoiceNoteCard({ note }: { note: CustomerVoiceNote }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function toggle() {
    if (!audioRef.current) {
      audioRef.current = new Audio(note.public_url)
      audioRef.current.onended = () => setPlaying(false)
    }
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      void audioRef.current.play()
      setPlaying(true)
    }
  }

  return (
    <div className="flex items-center gap-3 bg-white border border-[#E5E5E2] rounded-xl px-3.5 py-3">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        className="w-8 h-8 rounded-full bg-[#FBF3E3] flex items-center justify-center text-[#C8952A] hover:bg-[#F5E8CC] transition-colors flex-shrink-0"
      >
        <PlayIcon playing={playing} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#1A1A18]">{fmtDuration(note.duration_seconds)}</p>
        <p className="text-[10px] text-[#A0A09C] mt-0.5">
          #{String(note.order_number).padStart(4, '0')}
        </p>
      </div>
    </div>
  )
}

export default function CustomerMediaTab({ customerId }: { customerId: string }) {
  const [lightboxPhotos, setLightboxPhotos] = useState<OrderPhoto[] | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['customer-media', customerId],
    queryFn: () => getCustomerMedia(customerId),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-5 h-5 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const photos = data?.photos ?? []
  const voiceNotes = data?.voice_notes ?? []
  const garment = photos.filter((p) => p.photo_type === 'garment')
  const notes = photos.filter((p) => p.photo_type === 'notes')

  if (photos.length === 0 && voiceNotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm font-medium text-[#6B6B67]">No media yet</p>
        <p className="text-xs text-[#A0A09C] mt-1">Photos and voice notes will appear here</p>
      </div>
    )
  }

  function openLightbox(subset: CustomerPhoto[], index: number) {
    setLightboxPhotos(subset.map(toOrderPhoto))
    setLightboxIndex(index)
  }

  return (
    <div className="px-6 py-4 space-y-6">
      {garment.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[#A0A09C] uppercase tracking-wide mb-2">Garment Photos</p>
          <div className="grid grid-cols-3 gap-2">
            {garment.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openLightbox(garment, i)}
                className="relative aspect-square rounded-lg overflow-hidden bg-[#F0F0EE] group"
              >
                <img src={p.public_url} alt="" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                <span className="absolute bottom-1 right-1 text-[9px] font-semibold text-white bg-black/40 px-1 rounded">
                  #{String(p.order_number).padStart(4, '0')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[#A0A09C] uppercase tracking-wide mb-2">Measurement Notes</p>
          <div className="grid grid-cols-3 gap-2">
            {notes.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openLightbox(notes, i)}
                className="relative aspect-square rounded-lg overflow-hidden bg-[#F0F0EE] group"
              >
                <img src={p.public_url} alt="" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                <span className="absolute bottom-1 right-1 text-[9px] font-semibold text-white bg-black/40 px-1 rounded">
                  #{String(p.order_number).padStart(4, '0')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {voiceNotes.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[#A0A09C] uppercase tracking-wide mb-2">Voice Notes</p>
          <div className="space-y-2">
            {voiceNotes.map((v) => (
              <VoiceNoteCard key={v.id} note={v} />
            ))}
          </div>
        </div>
      )}

      {lightboxPhotos && (
        <PhotoLightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxPhotos(null)}
        />
      )}
    </div>
  )
}
