'use client'

import { useEffect, useState } from 'react'
import QuickDateInput from '@/components/common/QuickDateInput'
import { isValidMoneyInput } from '@/lib/money'

export interface DraftInstallment {
  id: string        // client-only key, never sent to the API
  amount: string
  due_date: string
  remarks: string
  // VS-27.4 — 'auto' = the system-seeded default row (= bill, due delivery date). It mirrors
  // the bill/delivery date until the user edits or splits the plan, at which point it flips
  // to 'user' and is never auto-resynced again. Client-only; stripped before the API call.
  source: 'auto' | 'user'
}

interface Props {
  billAmount: number    // live from the amount input above — reactive
  deliveryDate: string  // default due_date for new rows + the auto row
  installments: DraftInstallment[]
  onChange: (list: DraftInstallment[]) => void
}

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtDate(s: string) {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
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

interface RowFormState {
  amount: string
  due_date: string
  remarks: string
  showRemarks: boolean
}

function RowForm({
  initial,
  deliveryDate,
  onSave,
  onCancel,
}: {
  initial: RowFormState
  deliveryDate: string
  onSave: (s: RowFormState) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<RowFormState>(initial)
  const amountStr = form.amount.trim()
  const amountValid = isValidMoneyInput(amountStr, { min: 0.01 })
  const badPrecision = amountStr !== '' && !amountValid
  // No per-row cap: a row may temporarily push the schedule over the bill. The summary
  // shows "Over by ₹X" and the strict Σ == bill gate blocks Next/Create until it balances.
  const canSave = amountValid && form.due_date !== ''

  return (
    <div className="space-y-2 bg-[#FAFAF8] rounded-xl p-3 border border-[#E5E5E2]">
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#6B6B67] pointer-events-none">₹</span>
        <input
          type="number"
          inputMode="decimal"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          placeholder="0"
          min="0"
          step="0.01"
          className="w-full pl-6 pr-2 py-2 text-sm border border-[#E5E5E2] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
          autoFocus
        />
      </div>

      <QuickDateInput
        value={form.due_date}
        onChange={(iso) => setForm((f) => ({ ...f, due_date: iso }))}
        deliveryDate={deliveryDate}
        ariaLabel="Installment due date"
      />

      {badPrecision && (
        <p className="text-[11px] text-red-500">Enter an amount up to 2 decimals (max ₹9,99,99,999.99)</p>
      )}

      {!form.showRemarks ? (
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, showRemarks: true }))}
          className="text-xs text-[#A0A09C] hover:text-[#C8952A] transition-colors"
        >
          + Add note
        </button>
      ) : (
        <input
          type="text"
          value={form.remarks}
          onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
          placeholder="Note (optional)"
          className="w-full px-3 py-2 text-sm border border-[#E5E5E2] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
        />
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={!canSave}
          className="flex-1 py-1.5 text-xs font-semibold text-white bg-[#C8952A] rounded-lg hover:bg-[#A87820] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-1.5 text-xs font-medium text-[#6B6B67] border border-[#E5E5E2] rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function DraftInstallments({ billAmount, deliveryDate, installments, onChange }: Props) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const scheduled = installments.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)
  const remaining = billAmount > 0 ? billAmount - scheduled : 0
  const overBill = billAmount > 0 && scheduled > billAmount
  const busy = adding || editingId !== null

  // VS-27.4 — seed/resync the default installment. The lone auto row mirrors the bill +
  // delivery date until the user takes over; a user edit or a split flips it to 'user' and
  // it is never auto-adjusted again, so a user-edited single-row plan is never overwritten.
  useEffect(() => {
    if (billAmount <= 0) {
      // Bill cleared → drop a lone auto-seeded row (an unbilled order needs no schedule).
      if (installments.length === 1 && installments[0].source === 'auto') onChange([])
      return
    }
    if (installments.length === 0) {
      onChange([{ id: crypto.randomUUID(), amount: String(billAmount), due_date: deliveryDate, remarks: '', source: 'auto' }])
      return
    }
    if (installments.length === 1 && installments[0].source === 'auto') {
      const row = installments[0]
      if (parseFloat(row.amount) !== billAmount || row.due_date !== deliveryDate) {
        onChange([{ ...row, amount: String(billAmount), due_date: deliveryDate }])
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billAmount, deliveryDate, installments])

  function handleAdd(form: RowFormState) {
    // Splitting = the user takes manual control: existing rows (incl. the auto default)
    // become 'user' so they are no longer auto-resynced.
    onChange([
      ...installments.map((i) => ({ ...i, source: 'user' as const })),
      { id: crypto.randomUUID(), amount: form.amount, due_date: form.due_date, remarks: form.remarks, source: 'user' },
    ])
    setAdding(false)
  }

  function handleEdit(id: string, form: RowFormState) {
    onChange(installments.map((i) =>
      i.id === id
        ? { ...i, amount: form.amount, due_date: form.due_date, remarks: form.remarks, source: 'user' as const }
        : i
    ))
    setEditingId(null)
  }

  function handleDelete(id: string) {
    onChange(installments.filter((i) => i.id !== id))
  }

  // Default amount for a new row: remaining amount (if bill set and positive), else blank.
  const newRowDefault = billAmount > 0 && remaining > 0 ? remaining.toFixed(2) : ''

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
          onClick={() => { setAdding(true); setEditingId(null) }}
          disabled={busy}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#A87820] bg-[#FBF3E3] hover:bg-[#F5E8C8] transition-colors disabled:opacity-40"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add installment
        </button>
      </div>

      {/* Summary — strict: the schedule must equal the bill before you can continue. */}
      {(billAmount > 0 || installments.length > 0) && (
        <div className="flex items-center gap-3 mb-3 text-xs">
          <span className="text-[#6B6B67]">
            Scheduled{' '}
            <span className={`font-semibold ${overBill ? 'text-red-500' : 'text-[#1A1A18]'}`}>
              {fmt(scheduled)}
            </span>
          </span>
          {billAmount > 0 && (
            <>
              <span className="text-[#D5D5D2]">·</span>
              {overBill ? (
                <span className="font-semibold text-red-500">Over by {fmt(scheduled - billAmount)}</span>
              ) : remaining > 0 ? (
                <span className="font-semibold text-[#C8952A]">Add {fmt(remaining)} to match bill</span>
              ) : (
                <span className="font-semibold text-green-600">Matches bill</span>
              )}
            </>
          )}
        </div>
      )}

      {/* Rows */}
      <div className="space-y-1.5">
        {installments.map((inst) =>
          editingId === inst.id ? (
            <RowForm
              key={inst.id}
              initial={{ amount: inst.amount, due_date: inst.due_date, remarks: inst.remarks, showRemarks: !!inst.remarks }}
              deliveryDate={deliveryDate}
              onSave={(form) => handleEdit(inst.id, form)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div key={inst.id} className="flex items-center gap-2 py-2 border-b border-[#F0F0EE]">
              <span className="flex-1 text-sm font-semibold text-[#1A1A18] tabular-nums">
                {fmt(parseFloat(inst.amount) || 0)}
              </span>
              <span className="text-xs text-[#A0A09C]">{fmtDate(inst.due_date)}</span>
              {inst.remarks && (
                <span className="text-xs text-[#A0A09C] truncate max-w-[80px]">{inst.remarks}</span>
              )}
              <button
                type="button"
                onClick={() => { setEditingId(inst.id); setAdding(false) }}
                className="text-[#C8C8C4] hover:text-[#C8952A] transition-colors p-0.5"
                aria-label="Edit installment"
              >
                <PencilIcon />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(inst.id)}
                className="text-[#C8C8C4] hover:text-red-500 transition-colors p-0.5"
                aria-label="Delete installment"
              >
                <TrashIcon />
              </button>
            </div>
          )
        )}

        {adding && (
          <RowForm
            initial={{ amount: newRowDefault, due_date: deliveryDate, remarks: '', showRemarks: false }}
            deliveryDate={deliveryDate}
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
          />
        )}

        {installments.length === 0 && !adding && (
          <p className="text-xs text-[#C8C8C4] py-1">No installments — add one to split the payment</p>
        )}
      </div>
    </div>
  )
}
