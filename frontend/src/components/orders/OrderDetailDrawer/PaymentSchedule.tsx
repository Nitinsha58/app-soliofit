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

function fmt(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  )
}

function Spinner() {
  return <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin block" />
}

function StatusBadge({ status, daysOverdue }: { status: Installment['status']; daysOverdue: number }) {
  if (status === 'Paid')
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 whitespace-nowrap">Paid</span>
  if (status === 'Delayed')
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 whitespace-nowrap">Delayed · {daysOverdue}d</span>
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 whitespace-nowrap">Pending</span>
}

// Shared edit/add row — reused for both editing an existing row and adding a new one
function EditRow({
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
  maxAmount: number
  billAmount: number
  onSave: (data: { amount: string; due_date: string; remarks: string }) => void
  onCancel: () => void
  saving: boolean
}) {
  const [amount, setAmount] = useState(initialAmount)
  const [date, setDate] = useState(initialDate)
  const [remarks, setRemarks] = useState(initialRemarks)
  const [showNote, setShowNote] = useState(!!initialRemarks)

  const n = parseFloat(amount || '0')
  const excess = billAmount > 0 && isFinite(maxAmount) && n > maxAmount ? n - maxAmount : 0
  const valid = n > 0 && date !== '' && excess === 0

  return (
    <div className="rounded-lg border border-[#C8952A]/40 bg-[#FFFDF7] p-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <div className="relative w-28 shrink-0">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#6B6B67]">₹</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0.01"
            step="0.01"
            placeholder="Amount"
            className="w-full pl-5 pr-2 py-1.5 text-sm border border-[#E5E5E2] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/20 focus:border-[#C8952A]"
          />
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 px-2 py-1.5 text-sm border border-[#E5E5E2] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/20 focus:border-[#C8952A]"
        />
        <button
          onClick={() => valid && onSave({ amount, due_date: date, remarks })}
          disabled={!valid || saving}
          className="w-7 h-7 flex items-center justify-center text-white bg-[#C8952A] rounded-md disabled:opacity-40 shrink-0"
          aria-label="Save"
        >
          {saving ? <Spinner /> : <span className="text-sm font-bold leading-none">✓</span>}
        </button>
        <button
          onClick={onCancel}
          className="w-7 h-7 flex items-center justify-center text-[#6B6B67] hover:text-[#1A1A18] shrink-0"
          aria-label="Cancel"
        >
          <span className="text-xs">✕</span>
        </button>
      </div>

      {excess > 0 && (
        <p className="text-[11px] text-red-500 pl-0.5">Exceeds bill by {fmt(excess)}</p>
      )}

      {showNote ? (
        <input
          type="text"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Note (optional)"
          className="w-full px-2 py-1.5 text-xs border border-[#E5E5E2] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/20 focus:border-[#C8952A]"
        />
      ) : (
        <button
          onClick={() => setShowNote(true)}
          className="text-[11px] text-[#A0A09C] hover:text-[#6B6B67] transition-colors pl-0.5"
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
  const maxAmount = billAmount > 0 ? billAmount - otherScheduled : Infinity

  async function handleSaveEdit(data: { amount: string; due_date: string; remarks: string }) {
    setSaving(true)
    try {
      onUpdated(await updateInstallment(orderId, installment.id, data))
      setMode('view')
    } catch { }
    finally { setSaving(false) }
  }

  async function handleMarkPaid() {
    setSaving(true)
    try {
      onUpdated(await markInstallmentPaid(orderId, installment.id))
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
      <EditRow
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
      <div className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg border border-[#E5E5E2] bg-white text-xs">
        <span className="text-[#6B6B67] min-w-0 truncate">
          Mark <strong className="text-[#1A1A18]">{fmt(parseFloat(installment.amount))}</strong> as paid today?
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleMarkPaid}
            disabled={saving}
            className="font-semibold text-white bg-green-600 rounded px-2 py-0.5 disabled:opacity-50"
          >
            {saving ? '…' : 'Confirm'}
          </button>
          <button onClick={() => setMode('view')} className="text-[#6B6B67] hover:text-[#1A1A18]">Cancel</button>
        </div>
      </div>
    )
  }

  if (mode === 'confirmDelete') {
    return (
      <div className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg border border-[#E5E5E2] bg-white text-xs">
        <span className="text-[#6B6B67] min-w-0 truncate">
          Delete <strong className="text-[#1A1A18]">{fmt(parseFloat(installment.amount))}</strong>?
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDelete}
            disabled={saving}
            className="font-semibold text-white bg-red-500 rounded px-2 py-0.5 disabled:opacity-50"
          >
            {saving ? '…' : 'Delete'}
          </button>
          <button onClick={() => setMode('view')} className="text-[#6B6B67] hover:text-[#1A1A18]">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 px-2 py-2 rounded-lg border border-[#E5E5E2] bg-white group">
      <button
        onClick={!isPaid ? () => setMode('edit') : undefined}
        tabIndex={isPaid ? -1 : 0}
        className={`flex-1 flex items-center gap-2 min-w-0 text-left ${!isPaid ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <span className="text-sm font-semibold text-[#1A1A18] w-[68px] shrink-0">{fmt(parseFloat(installment.amount))}</span>
        <span className="text-xs text-[#6B6B67] shrink-0">{fmtDate(installment.due_date)}</span>
        {installment.remarks && (
          <span className="text-[11px] text-[#A0A09C] truncate hidden sm:block">{installment.remarks}</span>
        )}
      </button>

      <div className="flex items-center gap-1 shrink-0">
        {!isPaid ? (
          <button
            onClick={() => setMode('confirmPaid')}
            aria-label="Mark as paid"
          >
            <StatusBadge status={installment.status} daysOverdue={installment.days_overdue} />
          </button>
        ) : (
          <StatusBadge status={installment.status} daysOverdue={installment.days_overdue} />
        )}
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

export default function PaymentSchedule({ orderId, billAmount }: Props) {
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
    } catch { }
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

  return (
    <div>
      {/* Header: "Installments  N  [+]" */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-[#6B6B67]">Installments</span>
          {!loading && (
            <span className="text-[10px] font-semibold bg-[#EDEDE9] text-[#6B6B67] rounded-full px-1.5 py-0.5 leading-none tabular-nums">
              {installments.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setAdding(true)}
          disabled={!canAdd || adding || loading}
          className="w-6 h-6 flex items-center justify-center text-[#6B6B67] border border-[#E5E5E2] rounded-md hover:text-[#C8952A] hover:border-[#C8952A] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Add installment"
          title={!canAdd ? 'Bill fully scheduled' : 'Add installment'}
        >
          <PlusIcon />
        </button>
      </div>

      {loading ? (
        <div className="py-2 flex items-center gap-1.5 text-xs text-[#A0A09C]">
          <span className="w-3 h-3 border border-[#A0A09C] border-t-transparent rounded-full animate-spin block shrink-0" />
          Loading…
        </div>
      ) : (
        <>
          {/* Summary — above rows, when bill is set or installments exist */}
          {(billAmount > 0 || installments.length > 0) && (
            <div className="mb-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6B6B67] mb-1.5">
                {billAmount > 0 ? (
                  <>
                    <span>
                      Scheduled{' '}
                      <span className="font-medium text-[#1A1A18]">{fmt(scheduled)}</span>
                    </span>
                    <span className="text-[#D0D0CC]">·</span>
                    <span>
                      Remaining{' '}
                      <span className={`font-medium ${overBill ? 'text-red-500' : 'text-[#C8952A]'}`}>
                        {overBill ? `−${fmt(Math.abs(remaining))}` : fmt(remaining)}
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      Scheduled{' '}
                      <span className="font-medium text-[#1A1A18]">{fmt(scheduled)}</span>
                    </span>
                    <span className="text-[#D0D0CC]">·</span>
                    <span>
                      Paid{' '}
                      <span className="font-medium text-green-700">{fmt(paid)}</span>
                    </span>
                  </>
                )}
              </div>
              {billAmount > 0 && installments.length > 0 && (
                <div className="h-1 bg-[#EDEDE9] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${overBill ? 'bg-red-500' : 'bg-[#C8952A]'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Rows */}
          {(installments.length > 0 || adding) ? (
            <div className="space-y-1.5">
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
              {adding && (
                <EditRow
                  initialAmount={remaining > 0 ? String(remaining) : ''}
                  initialDate=""
                  initialRemarks=""
                  maxAmount={remaining}
                  billAmount={billAmount}
                  onSave={handleAdd}
                  onCancel={() => setAdding(false)}
                  saving={savingNew}
                />
              )}
            </div>
          ) : (
            <p className="text-xs text-[#A0A09C]">No installments yet</p>
          )}
        </>
      )}
    </div>
  )
}
