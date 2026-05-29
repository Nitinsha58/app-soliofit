'use client'

import { useState } from 'react'

interface Props {
  totalAmount: string
  onAmountChange: (v: string) => void
  onNext: () => void
  onBack: () => void
}

export default function StepBilling({ totalAmount, onAmountChange, onNext, onBack }: Props) {
  const [showInstallments, setShowInstallments] = useState(false)
  const isValid = totalAmount.trim() !== '' && parseFloat(totalAmount) > 0

  return (
    <div>
      <p className="text-xs text-[#6B6B67] mb-4">Enter the total bill amount</p>

      <div className="relative mb-5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#6B6B67] pointer-events-none">₹</span>
        <input
          type="number"
          inputMode="decimal"
          value={totalAmount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0.00"
          min="0"
          step="0.01"
          className="w-full pl-7 pr-4 py-3 border border-[#E5E5E2] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A] text-[#1A1A18] font-medium"
          autoFocus
        />
      </div>

      <div className="border border-[#E5E5E2] rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#1A1A18]">Add Installment Plan</p>
            <p className="text-xs text-[#A0A09C] mt-0.5">Split payment into multiple due dates</p>
          </div>
          <button
            onClick={() => setShowInstallments((v) => !v)}
            className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${showInstallments ? 'bg-[#C8952A]' : 'bg-[#E5E5E2]'}`}
            role="switch"
            aria-checked={showInstallments}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${showInstallments ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
        {showInstallments && (
          <p className="mt-3 text-xs text-[#6B6B67] bg-[#FAFAF8] rounded-lg p-3 leading-relaxed">
            Installment scheduling is available from the order details page after creating the order.
          </p>
        )}
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
          disabled={!isValid}
          className="flex-1 py-2.5 text-sm font-medium text-white bg-[#C8952A] rounded-lg hover:bg-[#A87820] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  )
}
