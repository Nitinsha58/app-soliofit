'use client'

import DraftInstallments, { type DraftInstallment } from './DraftInstallments'
import { isValidMoneyInput } from '@/lib/money'

interface Props {
  totalAmount: string
  onAmountChange: (v: string) => void
  deliveryDate: string
  installments: DraftInstallment[]
  onInstallmentsChange: (list: DraftInstallment[]) => void
  installmentsTouched: boolean
  onInstallmentsTouch: () => void
  onNext: () => void
  onBack: () => void
}

export default function StepBilling({
  totalAmount,
  onAmountChange,
  deliveryDate,
  installments,
  onInstallmentsChange,
  installmentsTouched,
  onInstallmentsTouch,
  onNext,
  onBack,
}: Props) {
  const billAmount = parseFloat(totalAmount) || 0
  const scheduled = installments.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)
  // VS-27.4 strict gate: a positive bill, within the server's DecimalField range (≤2 decimals,
  // ≤ ₹9,99,99,999.99), fully scheduled (Σ installments == bill to the paisa) before continuing.
  const billMoneyValid = isValidMoneyInput(totalAmount, { min: 0.01 })
  const billBadPrecision = totalAmount.trim() !== '' && !billMoneyValid
  const balanced = billMoneyValid && Math.abs(scheduled - billAmount) < 0.005
  // Inline-editable rows can sit in invalid intermediate states (blank amount/date), so the gate
  // now also requires every row to be valid money with a due date — the RowForm used to guarantee this.
  const rowsValid = installments.every((i) => isValidMoneyInput(i.amount, { min: 0.01 }) && i.due_date !== '')
  const isValid = balanced && rowsValid

  return (
    <div>
      <p className="text-xs text-[#6B6B67] mb-4">Enter the total bill amount</p>

      <div className="relative mb-2">
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

      {billBadPrecision && (
        <p className="text-[11px] text-red-500 mb-2">Enter an amount up to 2 decimals (max ₹9,99,99,999.99)</p>
      )}

      <DraftInstallments
        billAmount={billAmount}
        deliveryDate={deliveryDate}
        installments={installments}
        onChange={onInstallmentsChange}
        touched={installmentsTouched}
        onTouch={onInstallmentsTouch}
      />

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
