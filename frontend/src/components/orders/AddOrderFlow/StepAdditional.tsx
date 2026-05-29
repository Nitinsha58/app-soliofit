interface Props {
  remarks: string
  priority: boolean
  onRemarksChange: (v: string) => void
  onPriorityChange: (v: boolean) => void
  onNext: () => void
  onBack: () => void
}

export default function StepAdditional({
  remarks,
  priority,
  onRemarksChange,
  onPriorityChange,
  onNext,
  onBack,
}: Props) {
  return (
    <div>
      <p className="text-xs text-[#6B6B67] mb-4">
        Optional — voice notes and photos can be added from order details later
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#1A1A18] mb-1.5">
            Internal Remarks
          </label>
          <textarea
            value={remarks}
            onChange={(e) => onRemarksChange(e.target.value)}
            placeholder="Add any notes about this order…"
            rows={4}
            className="w-full px-3 py-2.5 border border-[#E5E5E2] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A] resize-none"
          />
        </div>

        <div className="flex items-center justify-between p-4 border border-[#E5E5E2] rounded-lg">
          <div>
            <p className="text-sm font-medium text-[#1A1A18]">Priority Order</p>
            <p className="text-xs text-[#A0A09C] mt-0.5">Mark for urgent attention</p>
          </div>
          <button
            onClick={() => onPriorityChange(!priority)}
            className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${priority ? 'bg-[#C8952A]' : 'bg-[#E5E5E2]'}`}
            role="switch"
            aria-checked={priority}
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
