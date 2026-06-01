'use client'

import { useState, useEffect, useRef } from 'react'
import type { Installment } from '@/lib/api/installments'
import {
  listInstallments,
  createInstallment,
  updateInstallment,
  deleteInstallment,
  markInstallmentPaid,
} from '@/lib/api/installments'

interface Props {
  orderId: string
  billAmount: number
}

function formatAmt(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function StatusBadge({ status, daysOverdue }: { status: Installment['status']; daysOverdue: number }) {
  if (status === 'Paid')
    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 whitespace-nowrap">Paid</span>
  if (status === 'Delayed')
    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 whitespace-nowrap">Delayed · {daysOverdue}d</span>
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 whitespace-nowrap">Pending</span>
}

function InlineSpinner() {
  return <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin block" />
}

function InlineEditRow({
  initialAmount,
  initialDate,
  initialRemarks,
  maxAmount,
  billAmount,
  onSave,
  onCancel,
  saving,
}: {
  initialAmount: string
  initialDate: string
  initialRemarks: string
  maxAmount: number   // max this row's amount can be (billAmount - otherScheduled)
  billAmount: number
  onSave: (data: { amount: string; due_date: string; remarks: string }) => void
  onCancel: () => void
  saving: boolean
}) {
  const [amount, setAmount] = useState(initialAmount)
  const [date, setDate] = useState(initialDate)
  const [remarks, setRemarks] = useState(initialRemarks)
  const [showNote, setShowNote] = useState(!!initialRemarks)

  const amountNum = parseFloat(amount || '0')
  const excess = billAmount > 0 && isFinite(maxAmount) && amountNum > maxAmount
    ? amountNum - maxAmount
    : 0
  const isValid = amountNum > 0 && date !== '' && excess === 0

  return (
    <div className="border border-[#C8952A]/40 rounded-xl p-2.5 bg-[#FFFDF7] space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative w-28 shrink-0">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#6B6B67]">₹</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0.01"
            step="0.01"
            placeholder="Amount"
            className="w-full pl-6 pr-2 py-1.5 text-sm border border-[#E5E5E2] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
          />
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 px-2 py-1.5 text-sm border border-[#E5E5E2] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
        />
        <button
          onClick={() => isValid && onSave({ amount, due_date: date, remarks })}
          disabled={!isValid || saving}
          className="w-7 h-7 flex items-center justify-center text-white bg-[#C8952A] rounded-lg disabled:opacity-40 shrink-0"
          aria-label="Save"
        >
          {saving ? <InlineSpinner /> : <span className="text-sm font-bold leading-none">✓</span>}
        </button>
        <button
          onClick={onCancel}
          className="w-7 h-7 flex items-center justify-center text-xs text-[#6B6B67] hover:text-[#1A1A18] shrink-0"
          aria-label="Cancel"
        >
          ✕
        </button>
      </div>

      {excess > 0 && (
        <p className="text-[11px] text-red-500">Exceeds bill by {formatAmt(excess)}</p>
      )}

      {showNote ? (
        <input
          type="text"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Note (optional)"
          className="w-full px-2.5 py-1.5 text-xs border border-[#E5E5E2] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
        />
      ) : (
        <button
          onClick={() => setShowNote(true)}
          className="text-[11px] text-[#A0A09C] hover:text-[#6B6B67] transition-colors"
        >
          + Add note
        </button>
      )}
    </div>
  )
}

function InstallmentRow({
  installment,
  orderId,
  billAmount,
  otherScheduled,
  onUpdated,
  onDeleted,
}: {
  installment: Installment
  orderId: string
  billAmount: number
  otherScheduled: number
  onUpdated: (i: Installment) => void
  onDeleted: (id: string) => void
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'confirmPaid' | 'confirmDelete'>('view')
  const [saving, setSaving] = useState(false)
  const isPaid = installment.status === 'Paid'

  // Max this installment's amount can be when editing
  const maxAmount = billAmount > 0 ? billAmount - otherScheduled : Infinity

  async function handleSaveEdit(data: { amount: string; due_date: string; remarks: string }) {
    setSaving(true)
    try {
      const updated = await updateInstallment(orderId, installment.id, data)
      onUpdated(updated)
      setMode('view')
    } catch { /* stay in edit on error */ }
    finally { setSaving(false) }
  }

  async function handleMarkPaid() {
    setSaving(true)
    try {
      const updated = await markInstallmentPaid(orderId, installment.id)
      onUpdated(updated)
      setMode('view')
    } catch { }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      await deleteInstallment(orderId, installment.id)
      onDeleted(installment.id)
    } catch { setSaving(false); setMode('view') }
  }

  if (mode === 'edit') {
    return (
      <InlineEditRow
        initialAmount={installment.amount}
        initialDate={installment.due_date}
        initialRemarks={installment.remarks}
        maxAmount={maxAmount}
        billAmount={billAmount}
        onSave={handleSaveEdit}
        onCancel={() => setMode('view')}
        saving={saving}
      />
    )
  }

  if (mode === 'confirmPaid') {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border border-[#E5E5E2] rounded-xl bg-white">
        <span className="text-xs text-[#6B6B67] min-w-0 truncate">
          Mark <strong className="text-[#1A1A18]">{formatAmt(parseFloat(installment.amount))}</strong> as paid today?
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleMarkPaid}
            disabled={saving}
            className="text-xs font-semibold text-white bg-green-600 rounded-md px-2.5 py-1 disabled:opacity-50"
          >
            {saving ? '…' : 'Confirm'}
          </button>
          <button onClick={() => setMode('view')} className="text-xs text-[#6B6B67] hover:text-[#1A1A18]">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'confirmDelete') {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border border-[#E5E5E2] rounded-xl bg-white">
        <span className="text-xs text-[#6B6B67] min-w-0 truncate">
          Delete <strong className="text-[#1A1A18]">{formatAmt(parseFloat(installment.amount))}</strong>?
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDelete}
            disabled={saving}
            className="text-xs font-semibold text-white bg-red-500 rounded-md px-2.5 py-1 disabled:opacity-50"
          >
            {saving ? '…' : 'Delete'}
          </button>
          <button onClick={() => setMode('view')} className="text-xs text-[#6B6B67] hover:text-[#1A1A18]">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // View mode
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-[#E5E5E2] bg-white group">
      <button
        onClick={!isPaid ? () => setMode('edit') : undefined}
        tabIndex={isPaid ? -1 : 0}
        className={`flex-1 flex items-center gap-2.5 min-w-0 text-left ${!isPaid ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span className="text-sm font-semibold text-[#1A1A18] w-[72px] shrink-0">
          {formatAmt(parseFloat(installment.amount))}
        </span>
        <span className="text-xs text-[#6B6B67] shrink-0">{formatDate(installment.due_date)}</span>
        {installment.remarks && (
          <span className="text-[11px] text-[#A0A09C] truncate">{installment.remarks}</span>
        )}
      </button>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={!isPaid ? () => setMode('confirmPaid') : undefined}
          tabIndex={!isPaid ? 0 : -1}
          className={!isPaid ? 'cursor-pointer' : 'cursor-default'}
          aria-label={!isPaid ? 'Mark as paid' : undefined}
        >
          <StatusBadge status={installment.status} daysOverdue={installment.days_overdue} />
        </button>
        {!isPaid && (
          <button
            onClick={() => setMode('confirmDelete')}
            className="text-[#D0D0CC] hover:text-red-400 transition-colors p-0.5 ml-0.5"
            aria-label="Delete installment"
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  )
}

export default function InstallmentSection({ orderId, billAmount }: Props) {
  const [installments, setInstallments] = useState<Installment[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [savingNew, setSavingNew] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    listInstallments(orderId)
      .then((data) => { if (mountedRef.current) setInstallments(data) })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false) })
    return () => { mountedRef.current = false }
  }, [orderId])

  async function handleAdd(data: { amount: string; due_date: string; remarks: string }) {
    setSavingNew(true)
    try {
      const created = await createInstallment(orderId, data)
      if (mountedRef.current) {
        setInstallments((prev) => [...prev, created])
        setAdding(false)
      }
    } catch { /* leave form open on error */ }
    finally { if (mountedRef.current) setSavingNew(false) }
  }

  function handleUpdated(updated: Installment) {
    setInstallments((prev) => prev.map((i) => i.id === updated.id ? updated : i))
  }

  function handleDeleted(id: string) {
    setInstallments((prev) => prev.filter((i) => i.id !== id))
  }

  const scheduled = installments.reduce((s, i) => s + parseFloat(i.amount), 0)
  const paid      = installments.filter((i) => i.status === 'Paid').reduce((s, i) => s + parseFloat(i.amount), 0)
  const remaining = billAmount > 0 ? billAmount - scheduled : 0
  const progress  = billAmount > 0 ? Math.min(100, (scheduled / billAmount) * 100) : 0
  const overBill  = billAmount > 0 && remaining < 0
  const canAdd    = billAmount <= 0 || remaining > 0

  if (loading) {
    return (
      <div className="mx-5 mb-4 py-4 flex items-center justify-center">
        <div className="w-4 h-4 border border-[#A0A09C] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-5 mb-4">
      <p className="text-[11px] font-semibold text-[#A0A09C] uppercase tracking-widest mb-3">Installments</p>

      {/* Summary — always visible when bill is set, or when installments exist */}
      {(billAmount > 0 || installments.length > 0) && (
        <div className="mb-3 p-3 border border-[#E5E5E2] rounded-xl bg-white">
          <div className="flex justify-between text-xs mb-2">
            {billAmount > 0 ? (
              <>
                <span className="text-[#6B6B67]">
                  Bill <span className="font-medium text-[#1A1A18]">{formatAmt(billAmount)}</span>
                </span>
                <span className="text-[#6B6B67]">
                  Scheduled <span className="font-medium text-[#1A1A18]">{formatAmt(scheduled)}</span>
                </span>
                <span className="text-[#6B6B67]">
                  Remaining{' '}
                  <span className={`font-medium ${overBill ? 'text-red-500' : 'text-[#C8952A]'}`}>
                    {overBill ? `−${formatAmt(Math.abs(remaining))}` : formatAmt(remaining)}
                  </span>
                </span>
              </>
            ) : (
              <>
                <span className="text-[#6B6B67]">
                  Scheduled <span className="font-medium text-[#1A1A18]">{formatAmt(scheduled)}</span>
                </span>
                <span className="text-[#6B6B67]">
                  Paid <span className="font-medium text-green-700">{formatAmt(paid)}</span>
                </span>
                <span className="text-[#6B6B67]">
                  Due <span className="font-medium text-[#C8952A]">{formatAmt(scheduled - paid)}</span>
                </span>
              </>
            )}
          </div>
          {billAmount > 0 && installments.length > 0 && (
            <div className="h-1.5 bg-[#E5E5E2] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${overBill ? 'bg-red-500' : 'bg-[#C8952A]'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {installments.length === 0 && !adding && (
        <p className="text-xs text-[#A0A09C] text-center py-2">No installments added yet</p>
      )}

      <div className="space-y-2">
        {installments.map((i) => (
          <InstallmentRow
            key={i.id}
            installment={i}
            orderId={orderId}
            billAmount={billAmount}
            otherScheduled={scheduled - parseFloat(i.amount)}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        ))}
      </div>

      {adding ? (
        <div className="mt-2">
          <InlineEditRow
            initialAmount={remaining > 0 ? String(remaining) : ''}
            initialDate=""
            initialRemarks=""
            maxAmount={remaining}
            billAmount={billAmount}
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
            saving={savingNew}
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          disabled={!canAdd}
          className="mt-2 w-full py-2 text-xs font-medium border border-dashed rounded-xl transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed
            text-[#6B6B67] border-[#C8C8C4]
            enabled:hover:border-[#C8952A] enabled:hover:text-[#C8952A]"
        >
          {!canAdd && billAmount > 0 ? 'Bill fully scheduled' : '+ Add Installment'}
        </button>
      )}
    </div>
  )
}
