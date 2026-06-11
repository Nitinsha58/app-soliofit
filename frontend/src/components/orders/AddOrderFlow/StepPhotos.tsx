'use client'

import { useRef, useState } from 'react'
import CameraCapture from '../CameraCapture'

interface Props {
  files: File[]
  onFilesChange: (files: File[]) => void
  onNext: () => void
  onBack: () => void
}

function CameraIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function GalleryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export default function StepPhotos({ files, onFilesChange, onNext, onBack }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [showCamera, setShowCamera] = useState(false)

  function handleSelect(selected: FileList | null) {
    if (!selected) return
    onFilesChange([...files, ...Array.from(selected)])
  }

  function removeFile(idx: number) {
    onFilesChange(files.filter((_, i) => i !== idx))
  }

  return (
    <div className="flex flex-col py-4">
      <p className="text-sm font-semibold text-[#1A1A18] mb-1">Garment Photos</p>
      <p className="text-xs text-[#6B6B67] mb-4 leading-relaxed">
        Add photos of the garment now, or skip and add them from the order details page later.
      </p>

      {/* Thumbnails */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {files.map((file, idx) => {
            const url = URL.createObjectURL(file)
            return (
              <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden bg-[#F5F5F3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" onLoad={() => URL.revokeObjectURL(url)} />
                <button
                  onClick={() => removeFile(idx)}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/50 text-white flex items-center justify-center"
                >
                  <XIcon />
                </button>
              </div>
            )
          })}
          <button
            onClick={() => setShowSheet(true)}
            className="w-16 h-16 rounded-lg border border-dashed border-[#C8C8C4] bg-[#FAFAF9] flex items-center justify-center text-[#A0A09C] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      )}

      {/* Empty state — camera-first primary CTA */}
      {files.length === 0 && (
        <button
          onClick={() => setShowSheet(true)}
          className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border border-dashed border-[#C8952A]/50 bg-[#FBF3E3]/40 text-[#C8952A] hover:bg-[#FBF3E3] transition-colors mb-4"
        >
          <CameraIcon />
          <span className="text-sm font-semibold">Add photos</span>
          <span className="text-[11px] font-medium text-[#A87820]/70">Camera or gallery</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleSelect(e.target.files)}
        onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
      />

      <div className="flex gap-2 mt-2">
        <button
          onClick={onBack}
          className="flex-1 py-2.5 text-sm font-medium text-[#6B6B67] border border-[#E5E5E2] rounded-lg hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        {files.length > 0 ? (
          <button
            onClick={onNext}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-[#C8952A] rounded-lg hover:bg-[#A87820] transition-colors"
          >
            Continue ({files.length})
          </button>
        ) : (
          <button
            onClick={onNext}
            className="flex-1 py-2.5 text-sm font-medium text-[#6B6B67] border border-[#E5E5E2] rounded-lg hover:bg-gray-50 transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>

      {/* Action sheet — Take Photo / Choose from Gallery (z-60 over the z-50 wizard) */}
      {showSheet && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setShowSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-2xl shadow-2xl px-4 pt-4 pb-8 lg:bottom-auto lg:top-1/2 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[420px] lg:rounded-2xl lg:pb-4">
            <div className="w-10 h-1 rounded-full bg-[#E5E5E2] mx-auto mb-5 lg:hidden" />
            <p className="text-[11px] font-semibold text-[#A0A09C] uppercase tracking-widest mb-3 px-1">
              Add Garment Photo
            </p>
            <button
              onClick={() => { setShowSheet(false); setShowCamera(true) }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#F5F5F3] transition-colors text-left"
            >
              <span className="w-9 h-9 rounded-full bg-[#F5F5F3] flex items-center justify-center text-[#1A1A18]">
                <CameraIcon size={18} />
              </span>
              <div>
                <p className="text-sm font-medium text-[#1A1A18]">Take Photo</p>
                <p className="text-xs text-[#A0A09C]">Open camera</p>
              </div>
            </button>
            <button
              onClick={() => { setShowSheet(false); inputRef.current?.click() }}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#F5F5F3] transition-colors text-left"
            >
              <span className="w-9 h-9 rounded-full bg-[#F5F5F3] flex items-center justify-center text-[#1A1A18]">
                <GalleryIcon />
              </span>
              <div>
                <p className="text-sm font-medium text-[#1A1A18]">Choose from Gallery</p>
                <p className="text-xs text-[#A0A09C]">Select existing photos</p>
              </div>
            </button>
          </div>
        </>
      )}

      {/* In-app camera (z-70) */}
      {showCamera && (
        <CameraCapture
          onCapture={(file) => onFilesChange([...files, file])}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}
