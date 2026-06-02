'use client'

import { useState } from 'react'

export interface DraftInstallment {
  id: string        // client-only key, never sent to the API
  amount: string
  due_date: string
  remarks: string
}

interface Props {
  billAmount: number    // live from the amount input above — reactive
  deliveryDate: string  // default due_date for new rows
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
  maxAmount,
  billAmount,
  onSave,
  onCancel,
}: {
  initial: RowFormState
  maxAmount: number      // Infinity when no bill set
  billAmount: number
  onSave: (s: RowFormState) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<RowFormState>(initial)
  const amount = parseFloat(form.amount) || 0
  const excess = billAmount > 0 && amount > maxAmount ? amount - maxAmount : 0
  const canSave = form.amount.trim() !== '' && amount > 0 && form.due_date !== '' && excess === 0

  return (
    <div className="space-y-2 bg-[#FAFAF8] rounded-xl p-3 border border-[#E5E5E2]">
      <div className="flex gap-2">
        <div className="relative flex-1">
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
        <input
          type="date"
          value={form.due_date}
          onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
          className="flex-1 px-2 py-2 text-sm border border-[#E5E5E2] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
        />
      </div>

      {excess > 0 && (
        <p className="text-[11px] text-red-500">Exceeds bill by {fmt(excess)}</p>
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

  function maxForNew() {
    return billAmount > 0 ? Math.max(0, billAmount - scheduled) : Infinity
  }

  function maxForEdit(id: string) {
    const othersSum = installments
      .filter((i) => i.id !== id)
      .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)
    return billAmount > 0 ? Math.max(0, billAmount - othersSum) : Infinity
  }

  function handleAdd(form: RowFormState) {
    onChange([
      ...installments,
      { id: crypto.randomUUID(), amount: form.amount, due_date: form.due_date, remarks: form.remarks },
    ])
    setAdding(false)
  }

  function handleEdit(id: string, form: RowFormState) {
    onChange(installments.map((i) =>
      i.id === id ? { ...i, amount: form.amount, due_date: form.due_date, remarks: form.remarks } : i
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
          className="w-6 h-6 rounded-full bg-[#FBF3E3] text-[#C8952A] flex items-center justify-center disabled:opacity-40 hover:bg-[#F5E8C8] transition-colors"
          aria-label="Add installment"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Summary */}
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
                <span className="font-semibold text-red-500">Exceeds by {fmt(scheduled - billAmount)}</span>
              ) : (
                <span className="text-[#6B6B67]">
                  Remaining{' '}
                  <span className="font-semibold text-[#1A1A18]">{fmt(remaining)}</span>
                </span>
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
              maxAmount={maxForEdit(inst.id)}
              billAmount={billAmount}
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
            maxAmount={maxForNew()}
            billAmount={billAmount}
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
          />
        )}

        {installments.length === 0 && !adding && (
          <p className="text-xs text-[#C8C8C4] py-1">No installments — tap + to split the payment</p>
        )}
      </div>
    </div>
  )
}
