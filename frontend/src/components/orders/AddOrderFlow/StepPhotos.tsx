'use client'

import { useRef } from 'react'

interface Props {
  files: File[]
  onFilesChange: (files: File[]) => void
  onNext: () => void
  onBack: () => void
}

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
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

  function handleSelect(selected: FileList | null) {
    if (!selected) return
    const next = [...files, ...Array.from(selected)]
    onFilesChange(next)
  }

  function removeFile(idx: number) {
    const next = files.filter((_, i) => i !== idx)
    onFilesChange(next)
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
            onClick={() => inputRef.current?.click()}
            className="w-16 h-16 rounded-lg border border-dashed border-[#C8C8C4] bg-[#FAFAF9] flex items-center justify-center text-[#A0A09C] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      )}

      {/* Empty state add button */}
      {files.length === 0 && (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border border-dashed border-[#C8C8C4] bg-[#FAFAF9] text-[#A0A09C] hover:border-[#C8952A] hover:text-[#C8952A] transition-colors mb-4"
        >
          <CameraIcon />
          <span className="text-xs font-medium">Tap to add photos</span>
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
        <button
          onClick={onNext}
          className="flex-1 py-2.5 text-sm font-medium text-white bg-[#C8952A] rounded-lg hover:bg-[#A87820] transition-colors"
        >
          {files.length > 0 ? `Continue (${files.length})` : 'Skip for now'}
        </button>
      </div>
    </div>
  )
}
