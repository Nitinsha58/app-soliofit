'use client'

import { useState, useEffect, useRef } from 'react'
import type { OrderPhoto } from '@/lib/api/media'
import { listPhotos, deletePhoto, uploadPhoto } from '@/lib/api/media'
import PhotoLightbox from './PhotoLightbox'
import CameraCapture from '../CameraCapture'

interface Props {
  orderId: string
  // VS-28.2 — when mounted inside the Work Instructions card, drop the standalone
  // header + outer margins so it reads as one group. Behavior is unchanged.
  embedded?: boolean
}

interface PendingUpload {
  tempId: string
  localUrl: string
  photoType: 'garment' | 'notes'
  error: boolean
  file: File
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
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

// Delete affordance (VS-28 option C): destructive, so kept low-emphasis. On hover-capable
// devices it stays hidden until hover; on touch devices (no hover) it is subtly always visible
// so mobile users have a real control. Both paths open the Delete/Cancel confirm overlay; the
// 600ms long-press remains a secondary path.
function DeleteBadge({ onDelete }: { onDelete: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onDelete}
      className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/65 transition-all opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
      aria-label="Delete photo"
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6M9 6V4h6v2" />
      </svg>
    </button>
  )
}

export default function PhotoSection({ orderId, embedded = false }: Props) {
  const [photos, setPhotos] = useState<OrderPhoto[]>([])
  const [pending, setPending] = useState<PendingUpload[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<{ type: 'garment' | 'notes'; idx: number } | null>(null)
  const [actionSheet, setActionSheet] = useState<'garment' | 'notes' | null>(null)
  const [cameraPhoto, setCameraPhoto] = useState<'garment' | 'notes' | null>(null)
  const garmentInputRef = useRef<HTMLInputElement>(null)
  const notesInputRef = useRef<HTMLInputElement>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    listPhotos(orderId)
      .then((p) => { if (mountedRef.current) setPhotos(p) })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false) })
    return () => { mountedRef.current = false }
  }, [orderId])

  async function processFiles(files: File[], photoType: 'garment' | 'notes') {
    for (const file of files) {
      const tempId = crypto.randomUUID()
      const localUrl = URL.createObjectURL(file)
      const item: PendingUpload = { tempId, localUrl, photoType, error: false, file }
      if (mountedRef.current) setPending((p) => [...p, item])
      try {
        const saved = await uploadPhoto(orderId, file, photoType)
        if (!mountedRef.current) return
        setPhotos((prev) => [...prev, saved])
        setPending((p) => p.filter((x) => x.tempId !== tempId))
        URL.revokeObjectURL(localUrl)
      } catch {
        if (mountedRef.current) setPending((p) => p.map((x) => x.tempId === tempId ? { ...x, error: true } : x))
      }
    }
  }

  function handleFileSelect(files: FileList | null, photoType: 'garment' | 'notes') {
    if (!files) return
    processFiles(Array.from(files), photoType)
  }

  async function handleRetry(item: PendingUpload) {
    setPending((p) => p.map((x) => x.tempId === item.tempId ? { ...x, error: false } : x))
    try {
      const saved = await uploadPhoto(orderId, item.file, item.photoType)
      if (!mountedRef.current) return
      setPhotos((prev) => [...prev, saved])
      setPending((p) => p.filter((x) => x.tempId !== item.tempId))
      URL.revokeObjectURL(item.localUrl)
    } catch {
      if (mountedRef.current) setPending((p) => p.map((x) => x.tempId === item.tempId ? { ...x, error: true } : x))
    }
  }

  async function handleDelete(photoId: string) {
    setConfirmDeleteId(null)
    setPhotos((p) => p.filter((x) => x.id !== photoId))
    try {
      await deletePhoto(orderId, photoId)
    } catch {
      // optimistic — silently restore on failure would need a snapshot; acceptable for MVP
    }
  }

  function startLongPress(id: string) {
    longPressTimerRef.current = setTimeout(() => setConfirmDeleteId(id), 600)
  }

  function cancelLongPress() {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
  }

  const garmentPhotos = photos.filter((p) => p.photo_type === 'garment')
  const notesPhotos   = photos.filter((p) => p.photo_type === 'notes')
  const garmentPending = pending.filter((p) => p.photoType === 'garment')
  const notesPending   = pending.filter((p) => p.photoType === 'notes')

  const allGarment = [...garmentPhotos, ...garmentPending]
  const allNotes   = [...notesPhotos, ...notesPending]

  // Build flat arrays for lightbox
  const lightboxPhotos = lightboxIndex?.type === 'garment' ? garmentPhotos : notesPhotos

  if (loading) {
    return (
      <div className={`${embedded ? '' : 'mx-5 mb-4'} py-4 flex items-center justify-center`}>
        <div className="w-4 h-4 border border-[#A0A09C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      <div className={embedded ? '' : 'mx-5 mb-4'}>
        {/* Section header — suppressed when embedded in the Work Instructions card (VS-28.2) */}
        {!embedded && (
          <p className="text-[11px] font-semibold text-[#A0A09C] uppercase tracking-widest mb-3">Photos</p>
        )}

        {/* Garment photos — horizontal strip */}
        <div className="mb-4">
          <p className="text-xs font-medium text-[#6B6B67] mb-2">Garment</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {allGarment.map((item, idx) => {
              if ('tempId' in item) {
                return (
                  <div key={item.tempId} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-[#F5F5F3] border border-[#E5E5E2]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.localUrl} alt="" className="w-full h-full object-cover opacity-50" />
                    {item.error ? (
                      <button
                        onClick={() => handleRetry(item)}
                        className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white text-[10px] font-semibold gap-1"
                      >
                        <span>Retry</span>
                      </button>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                )
              }
              const realIdx = garmentPhotos.indexOf(item as OrderPhoto)
              return (
                <div
                  key={(item as OrderPhoto).id}
                  className="group relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-[#F5F5F3] cursor-pointer select-none"
                  onPointerDown={() => startLongPress((item as OrderPhoto).id)}
                  onPointerUp={() => { cancelLongPress() }}
                  onPointerLeave={() => cancelLongPress()}
                  onClick={() => {
                    if (confirmDeleteId === (item as OrderPhoto).id) return
                    setLightboxIndex({ type: 'garment', idx: realIdx })
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={(item as OrderPhoto).public_url} alt="" className="w-full h-full object-cover" />
                  <DeleteBadge onDelete={(e) => { e.stopPropagation(); cancelLongPress(); setConfirmDeleteId((item as OrderPhoto).id) }} />
                  {confirmDeleteId === (item as OrderPhoto).id && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete((item as OrderPhoto).id) }}
                        className="flex items-center gap-1 text-[11px] font-semibold text-white bg-red-500 rounded-md px-2 py-1"
                      >
                        <TrashIcon /> Delete
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }}
                        className="text-[10px] text-white/70"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add button */}
            <button
              onClick={() => setActionSheet('garment')}
              className="flex-shrink-0 w-20 h-20 rounded-lg border border-dashed border-[#C8C8C4] bg-[#FAFAF9] flex flex-col items-center justify-center gap-1 text-[#A0A09C] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors"
            >
              <PlusIcon />
              <span className="text-[9px] font-medium">Add</span>
            </button>
          </div>
        </div>

        {/* Measurement Notes — horizontal strip, sized to match Garment (VS-28 divergence
            from the older 2-column notes spec; keeps the Work Instructions card calm). */}
        <div>
          <p className="text-xs font-medium text-[#6B6B67] mb-2">Measurement Notes</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {allNotes.map((item) => {
              if ('tempId' in item) {
                return (
                  <div key={item.tempId} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-[#F5F5F3] border border-[#E5E5E2]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.localUrl} alt="" className="w-full h-full object-cover opacity-50" />
                    {item.error ? (
                      <button
                        onClick={() => handleRetry(item)}
                        className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white text-[10px] font-semibold gap-1"
                      >
                        <span>Retry</span>
                      </button>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                )
              }
              const photo = item as OrderPhoto
              const realIdx = notesPhotos.indexOf(photo)
              return (
                <div
                  key={photo.id}
                  className="group relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-[#F5F5F3] cursor-pointer select-none"
                  onPointerDown={() => startLongPress(photo.id)}
                  onPointerUp={() => cancelLongPress()}
                  onPointerLeave={() => cancelLongPress()}
                  onClick={() => {
                    if (confirmDeleteId === photo.id) return
                    setLightboxIndex({ type: 'notes', idx: realIdx })
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.public_url} alt="" className="w-full h-full object-cover" />
                  <DeleteBadge onDelete={(e) => { e.stopPropagation(); cancelLongPress(); setConfirmDeleteId(photo.id) }} />
                  {confirmDeleteId === photo.id && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(photo.id) }}
                        className="flex items-center gap-1 text-[11px] font-semibold text-white bg-red-500 rounded-md px-2 py-1"
                      >
                        <TrashIcon /> Delete
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null) }}
                        className="text-[10px] text-white/70"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Add button */}
            <button
              onClick={() => setActionSheet('notes')}
              className="flex-shrink-0 w-20 h-20 rounded-lg border border-dashed border-[#C8C8C4] bg-[#FAFAF9] flex flex-col items-center justify-center gap-1 text-[#A0A09C] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors"
            >
              <PlusIcon />
              <span className="text-[9px] font-medium">Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={garmentInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files, 'garment')}
        onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
      />
      <input
        ref={notesInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files, 'notes')}
        onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
      />

      {/* Lightbox */}
      {lightboxIndex !== null && lightboxPhotos.length > 0 && (
        <PhotoLightbox
          photos={lightboxPhotos}
          index={lightboxIndex.idx}
          onIndexChange={(i) => setLightboxIndex({ type: lightboxIndex.type, idx: i })}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* Action sheet — Take Photo / Choose from Gallery */}
      {actionSheet !== null && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/40"
            onClick={() => setActionSheet(null)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-2xl shadow-2xl px-4 pt-4 pb-8 lg:left-auto lg:right-0 lg:w-[460px]">
            <div className="w-10 h-1 rounded-full bg-[#E5E5E2] mx-auto mb-5" />
            <p className="text-[11px] font-semibold text-[#A0A09C] uppercase tracking-widest mb-3 px-1">
              Add {actionSheet === 'garment' ? 'Garment' : 'Measurement Notes'} Photo
            </p>
            <button
              onClick={() => {
                const type = actionSheet
                setActionSheet(null)
                setCameraPhoto(type)
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#F5F5F3] transition-colors text-left"
            >
              <span className="w-9 h-9 rounded-full bg-[#F5F5F3] flex items-center justify-center text-[#1A1A18]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-medium text-[#1A1A18]">Take Photo</p>
                <p className="text-xs text-[#A0A09C]">Open camera</p>
              </div>
            </button>
            <button
              onClick={() => {
                const type = actionSheet
                setActionSheet(null)
                if (type === 'garment') garmentInputRef.current?.click()
                else notesInputRef.current?.click()
              }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#F5F5F3] transition-colors text-left"
            >
              <span className="w-9 h-9 rounded-full bg-[#F5F5F3] flex items-center justify-center text-[#1A1A18]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-medium text-[#1A1A18]">Choose from Gallery</p>
                <p className="text-xs text-[#A0A09C]">Select existing photo</p>
              </div>
            </button>
          </div>
        </>
      )}

      {/* In-app camera */}
      {cameraPhoto !== null && (
        <CameraCapture
          onCapture={(file) => processFiles([file], cameraPhoto)}
          onClose={() => setCameraPhoto(null)}
        />
      )}
    </>
  )
}
