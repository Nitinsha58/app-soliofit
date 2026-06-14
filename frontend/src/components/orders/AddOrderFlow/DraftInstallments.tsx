'use client'

import { useEffect } from 'react'
import QuickDateInput from '@/components/common/QuickDateInput'
import { isValidMoneyInput } from '@/lib/money'

export interface DraftInstallment {
  id: string        // client-only key, never sent to the API
  amount: string
  due_date: string
  remarks: string
  // VS-27.4 — 'auto' = the system-seeded default row (= bill, due delivery date). It mirrors
  // the bill/delivery date until the user takes control, at which point it flips to 'user' and
  // is never auto-resynced again. Client-only; stripped before the API call.
  source: 'auto' | 'user'
  // VS-29 — marked as an advance payment already collected at intake. Sent to the create API;
  // the row is created already settled (paid_date = today).
  paid: boolean
}

interface Props {
  billAmount: number    // live from the amount input above — reactive
  deliveryDate: string  // default due_date for new rows + the auto row
  installments: DraftInstallment[]
  onChange: (list: DraftInstallment[]) => void
  // Durable "the user has taken control of the schedule" flag. It lives in the wizard draft
  // (not local state) so it survives leaving and re-entering the Billing step: deleting the
  // seeded auto row is real intent, not a transient empty list, and must NOT respawn the row.
  // Once true, the auto row is never re-seeded or re-synced. Editing / deleting / adding sets it.
  touched: boolean
  onTouch: () => void
}

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function PlusIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// Stronger, clearly-tappable delete — matches the VS-28 Money-tab edit row (not the old faint icon).
function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  )
}

export default function DraftInstallments({
  billAmount,
  deliveryDate,
  installments,
  onChange,
  touched,
  onTouch,
}: Props) {
  const scheduled = installments.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)
  const remaining = billAmount > 0 ? billAmount - scheduled : 0
  const rowsValid = installments.every((r) => isValidMoneyInput(r.amount, { min: 0.01 }) && r.due_date !== '')

  // VS-27.4 — seed/resync the default installment, but ONLY while the user hasn't taken control.
  // The lone auto row mirrors the bill + delivery date until the first edit/delete/add; after
  // that `touched` is set and this effect is inert, so a user-managed (or deliberately emptied)
  // plan is never overwritten or respawned.
  useEffect(() => {
    if (touched) return
    if (billAmount <= 0) {
      // Bill cleared → drop a lone auto-seeded row (an unbilled order needs no schedule).
      if (installments.length === 1 && installments[0].source === 'auto') onChange([])
      return
    }
    if (installments.length === 0) {
      onChange([{ id: crypto.randomUUID(), amount: String(billAmount), due_date: deliveryDate, remarks: '', source: 'auto', paid: false }])
      return
    }
    if (installments.length === 1 && installments[0].source === 'auto') {
      const row = installments[0]
      if (parseFloat(row.amount) !== billAmount || row.due_date !== deliveryDate) {
        onChange([{ ...row, amount: String(billAmount), due_date: deliveryDate }])
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billAmount, deliveryDate, installments, touched])

  // Any inline edit takes the user out of auto mode (durably, via onTouch) and flips the row.
  function updateRow(id: string, patch: Partial<Pick<DraftInstallment, 'amount' | 'due_date' | 'remarks'>>) {
    if (!touched) onTouch()
    onChange(installments.map((i) => (i.id === id ? { ...i, ...patch, source: 'user' as const } : i)))
  }

  function removeRow(id: string) {
    if (!touched) onTouch()
    onChange(installments.filter((i) => i.id !== id))
  }

  // Add drops the remaining balance straight into a new editable row (no separate form), and
  // flips every existing row to 'user' so the schedule is no longer auto-managed.
  function addRow() {
    if (!touched) onTouch()
    const fill = remaining > 0 ? remaining.toFixed(2) : ''
    onChange([
      ...installments.map((i) => ({ ...i, source: 'user' as const })),
      { id: crypto.randomUUID(), amount: fill, due_date: deliveryDate, remarks: '', source: 'user', paid: false },
    ])
  }

  // Quiet per-row status flag — record an advance already collected at intake.
  function togglePaid(id: string) {
    if (!touched) onTouch()
    onChange(installments.map((i) => (i.id === id ? { ...i, paid: !i.paid, source: 'user' as const } : i)))
  }

  // Balance status — mirrors the Money-tab edit-mode language (no paid rows during create).
  let statusText = 'Balanced'
  let statusColor = 'text-green-600'
  if (!rowsValid) { statusText = 'Complete each installment'; statusColor = 'text-[#6B6B67]' }
  else if (remaining > 0.005) { statusText = `Remaining ${fmt(remaining)}`; statusColor = 'text-[#C8952A]' }
  else if (remaining < -0.005) { statusText = `Over by ${fmt(-remaining)}`; statusColor = 'text-red-500' }

  return (
    <div className="mt-5 border-t border-[#E5E5E2] pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold text-[#A0A09C] uppercase tracking-widest">Installments</p>
          <span className="w-5 h-5 rounded-full bg-[#F5F5F3] text-[10px] font-semibold text-[#6B6B67] flex items-center justify-center">
            {installments.length}
          </span>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#A87820] bg-[#FBF3E3] hover:bg-[#F5E8C8] transition-colors"
        >
          <PlusIcon /> Add installment
        </button>
      </div>

      {/* Balance status — strict: the schedule must equal the bill before you can continue. */}
      {billAmount > 0 && (
        <p className={`text-xs font-semibold mb-3 ${statusColor}`}>{statusText}</p>
      )}

      {/* Inline-editable rows (parallels the Money-tab edit mode) */}
      {installments.length === 0 ? (
        <p className="text-xs text-[#C8C8C4] py-1">No installments — add one to split the payment</p>
      ) : (
        <div className="space-y-2">
          {installments.map((r) => (
            <div key={r.id} className="rounded-lg border border-[#E5E5E2] bg-white p-2.5 space-y-2">
              {/* Row 1 — amount + a clearly-tappable delete */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#6B6B67]">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={r.amount}
                    onChange={(e) => updateRow(r.id, { amount: e.target.value })}
                    min="0.01"
                    step="0.01"
                    placeholder="Amount"
                    className="w-full pl-5 pr-2 py-1.5 text-sm border border-[#E5E5E2] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/20 focus:border-[#C8952A]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(r.id)}
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md border border-[#E5E5E2] text-[#A0A09C] hover:text-red-500 hover:border-red-200 transition-colors"
                  aria-label="Remove installment"
                >
                  <TrashIcon />
                </button>
              </div>
              {/* Row 2 — date controls on their own line */}
              <div>
                <QuickDateInput
                  value={r.due_date}
                  onChange={(iso) => updateRow(r.id, { due_date: iso })}
                  deliveryDate={deliveryDate}
                  ariaLabel="Installment due date"
                />
              </div>
              {/* Row 3 — note, full width */}
              <input
                type="text"
                value={r.remarks}
                onChange={(e) => updateRow(r.id, { remarks: e.target.value })}
                placeholder="Note (optional)"
                className="w-full px-2 py-1.5 text-xs border border-[#E5E5E2] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/20 focus:border-[#C8952A]"
              />
              {/* Row 4 — quiet advance-payment flag. Off by default; turns green only when set,
                  so the dominant job stays balancing the bill (§0.7/§0.8). */}
              <button
                type="button"
                onClick={() => togglePaid(r.id)}
                aria-pressed={r.paid}
                className={`flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 border transition-colors ${
                  r.paid
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'text-[#A0A09C] border-[#E5E5E2] hover:text-[#6B6B67] hover:border-[#C8C8C4]'
                }`}
              >
                {r.paid && <CheckIcon />}
                {r.paid ? 'Paid in advance' : 'Mark paid'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
