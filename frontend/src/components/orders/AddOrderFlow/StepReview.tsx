import type { Customer } from '@/lib/api/customers'
import type { DraftInstallment } from './DraftInstallments'

interface Draft {
  customer: Customer | null
  deliveryDate: string
  totalAmount: string
  priority: boolean
  remarks: string
  pendingInstallments: DraftInstallment[]
}

interface Props {
  draft: Draft
  submitting: boolean
  error: string
  onCreate: () => void
  onBack: () => void
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function StepReview({ draft, submitting, error, onCreate, onBack }: Props) {
  const scheduledTotal = draft.pendingInstallments.reduce(
    (sum, i) => sum + (parseFloat(i.amount) || 0), 0
  )

  return (
    <div>
      <p className="text-xs text-[#6B6B67] mb-4">Review your order before creating</p>

      <div className="bg-[#FAFAF8] rounded-xl border border-[#E5E5E2] p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#FBF3E3] flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-[#C8952A]">
              {draft.customer?.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#1A1A18] truncate">{draft.customer?.name}</p>
            <p className="text-xs text-[#6B6B67]">{draft.customer?.phone}</p>
          </div>
          {draft.priority && (
            <span className="flex-shrink-0 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-semibold rounded-full uppercase tracking-wide">
              Priority
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E5E5E2]">
          <div>
            <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide">Delivery Date</p>
            <p className="text-sm font-medium text-[#1A1A18] mt-0.5">
              {draft.deliveryDate ? formatDate(draft.deliveryDate) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide">Bill Amount</p>
            <p className="text-sm font-semibold text-[#1A1A18] mt-0.5 tabular-nums">
              ₹{Number(draft.totalAmount).toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {draft.pendingInstallments.length > 0 && (
          <div className="pt-3 border-t border-[#E5E5E2]">
            <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide mb-1">Installments</p>
            <p className="text-sm font-medium text-[#1A1A18]">
              {draft.pendingInstallments.length} installment{draft.pendingInstallments.length > 1 ? 's' : ''}{' '}
              · ₹{scheduledTotal.toLocaleString('en-IN')} scheduled
            </p>
          </div>
        )}

        {draft.remarks && (
          <div className="pt-3 border-t border-[#E5E5E2]">
            <p className="text-[10px] font-medium text-[#A0A09C] uppercase tracking-wide mb-1">Remarks</p>
            <p className="text-xs text-[#6B6B67] leading-relaxed">{draft.remarks}</p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-600 text-center">{error}</p>
      )}

      <div className="flex gap-2 mt-5">
        <button
          onClick={onBack}
          disabled={submitting}
          className="flex-1 py-2.5 text-sm font-medium text-[#6B6B67] border border-[#E5E5E2] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={onCreate}
          disabled={submitting}
          className="flex-1 py-2.5 text-sm font-medium text-white bg-[#C8952A] rounded-lg hover:bg-[#A87820] transition-colors disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create Order'}
        </button>
      </div>
    </div>
  )
}
