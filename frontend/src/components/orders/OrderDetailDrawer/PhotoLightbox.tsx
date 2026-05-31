'use client'

import { useEffect, useRef } from 'react'
import type { OrderPhoto } from '@/lib/api/media'

interface Props {
  photos: OrderPhoto[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
}

export default function PhotoLightbox({ photos, index, onIndexChange, onClose }: Props) {
  const swipeStartX = useRef<number | null>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1)
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndexChange(index + 1)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [index, photos.length, onIndexChange, onClose])

  const photo = photos[index]
  if (!photo) return null

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
      onPointerDown={(e) => { swipeStartX.current = e.clientX }}
      onPointerUp={(e) => {
        if (swipeStartX.current === null) return
        const dx = e.clientX - swipeStartX.current
        swipeStartX.current = null
        if (dx < -50 && index < photos.length - 1) onIndexChange(index + 1)
        if (dx > 50 && index > 0) onIndexChange(index - 1)
      }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 z-10"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Counter */}
      {photos.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm font-medium">
          {index + 1} / {photos.length}
        </div>
      )}

      {/* Prev */}
      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onIndexChange(index - 1) }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 hidden sm:block"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
      )}

      {/* Next */}
      {index < photos.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onIndexChange(index + 1) }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 hidden sm:block"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      )}

      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.public_url}
        alt=""
        className="max-w-full max-h-full object-contain select-none"
        draggable={false}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}
