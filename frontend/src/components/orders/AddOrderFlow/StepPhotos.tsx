interface Props {
  onNext: () => void
  onBack: () => void
}

function CameraIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C8C8C4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

export default function StepPhotos({ onNext, onBack }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-16 h-16 rounded-full bg-[#F5F5F3] flex items-center justify-center mb-4">
        <CameraIcon />
      </div>
      <p className="text-sm font-semibold text-[#1A1A18] mb-1.5">Garment Photos</p>
      <p className="text-xs text-[#6B6B67] max-w-xs leading-relaxed">
        Photo upload will be available in a future update. You can add garment photos from the order details page after creating the order.
      </p>
      <div className="flex gap-2 mt-8 w-full">
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
          Skip for now
        </button>
      </div>
    </div>
  )
}
