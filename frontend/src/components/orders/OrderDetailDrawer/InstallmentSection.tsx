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
}

function formatAmount(amount: string): string {
  const n = parseFloat(amount)
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatusBadge({ status, daysOverdue }: { status: Installment['status']; daysOverdue: number }) {
  if (status === 'Paid') {
    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">Paid</span>
  }
  if (status === 'Delayed') {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
        Delayed · {daysOverdue}d
      </span>
    )
  }
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Pending</span>
}

function InstallmentForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: { amount: string; due_date: string; remarks: string }
  onSave: (data: { amount: string; due_date: string; remarks: string }) => void
  onCancel: () => void
  saving: boolean
}) {
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '')
  const [remarks, setRemarks] = useState(initial?.remarks ?? '')
  const isValid = amount.trim() !== '' && parseFloat(amount) > 0 && dueDate !== ''

  return (
    <div className="border border-[#E5E5E2] rounded-xl p-3 space-y-2.5 bg-[#FAFAF9]">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#6B6B67]">₹</span>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            min="0"
            step="0.01"
            className="w-full pl-6 pr-3 py-2 text-sm border border-[#E5E5E2] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
          />
        </div>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-[#E5E5E2] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
        />
      </div>
      <input
        type="text"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        placeholder="Remarks (optional)"
        className="w-full px-3 py-2 text-sm border border-[#E5E5E2] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
      />
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 text-xs font-medium text-[#6B6B67] border border-[#E5E5E2] rounded-lg hover:bg-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave({ amount, due_date: dueDate, remarks })}
          disabled={!isValid || saving}
          className="flex-1 py-1.5 text-xs font-medium text-white bg-[#C8952A] rounded-lg hover:bg-[#A87820] transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : initial ? 'Save' : 'Add'}
        </button>
      </div>
    </div>
  )
}

function InstallmentCard({
  installment,
  orderId,
  onUpdated,
  onDeleted,
}: {
  installment: Installment
  orderId: string
  onUpdated: (i: Installment) => void
  onDeleted: (id: string) => void
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'confirmPaid' | 'confirmDelete'>('view')
  const [saving, setSaving] = useState(false)
  const isPaid = installment.status === 'Paid'

  async function handleSaveEdit(data: { amount: string; due_date: string; remarks: string }) {
    setSaving(true)
    try {
      const updated = await updateInstallment(orderId, installment.id, data)
      onUpdated(updated)
      setMode('view')
    } catch { /* leave in edit mode on error */ }
    finally { setSaving(false) }
  }

  async function handleMarkPaid() {
    setSaving(true)
    try {
      const updated = await markInstallmentPaid(orderId, installment.id)
      onUpdated(updated)
      setMode('view')
    } catch { /* leave confirm mode on error */ }
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
      <InstallmentForm
        initial={{ amount: installment.amount, due_date: installment.due_date, remarks: installment.remarks }}
        onSave={handleSaveEdit}
        onCancel={() => setMode('view')}
        saving={saving}
      />
    )
  }

  return (
    <div className="border border-[#E5E5E2] rounded-xl p-3 bg-white">
      {/* Amount + badge */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-[#1A1A18]">{formatAmount(installment.amount)}</span>
        <StatusBadge status={installment.status} daysOverdue={installment.days_overdue} />
      </div>

      {/* Due date */}
      <p className="text-xs text-[#6B6B67] mt-0.5">Due {formatDate(installment.due_date)}</p>

      {/* Remarks */}
      {installment.remarks && (
        <p className="text-xs text-[#A0A09C] mt-1">{installment.remarks}</p>
      )}

      {/* Actions */}
      {!isPaid && mode === 'view' && (
        <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-[#F0F0EE]">
          <button
            onClick={() => setMode('confirmPaid')}
            className="text-[11px] font-medium text-[#C8952A] hover:text-[#A87820] transition-colors"
          >
            Mark Paid
          </button>
          <span className="text-[#E5E5E2]">·</span>
          <button
            onClick={() => setMode('edit')}
            className="text-[11px] font-medium text-[#6B6B67] hover:text-[#1A1A18] transition-colors"
          >
            Edit
          </button>
          <span className="text-[#E5E5E2]">·</span>
          <button
            onClick={() => setMode('confirmDelete')}
            className="text-[11px] font-medium text-[#6B6B67] hover:text-red-500 transition-colors"
          >
            Delete
          </button>
        </div>
      )}

      {/* Mark paid confirm */}
      {mode === 'confirmPaid' && (
        <div className="flex items-center justify-end gap-2 mt-2.5 pt-2.5 border-t border-[#F0F0EE]">
          <span className="text-xs text-[#6B6B67]">Mark as paid today?</span>
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
      )}

      {/* Delete confirm */}
      {mode === 'confirmDelete' && (
        <div className="flex items-center justify-end gap-2 mt-2.5 pt-2.5 border-t border-[#F0F0EE]">
          <span className="text-xs text-[#6B6B67]">Delete this installment?</span>
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
      )}
    </div>
  )
}

export default function InstallmentSection({ orderId }: Props) {
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
      if (mountedRef.current) { setInstallments((prev) => [...prev, created]); setAdding(false) }
    } catch { /* leave form open on error */ }
    finally { if (mountedRef.current) setSavingNew(false) }
  }

  function handleUpdated(updated: Installment) {
    setInstallments((prev) => prev.map((i) => i.id === updated.id ? updated : i))
  }

  function handleDeleted(id: string) {
    setInstallments((prev) => prev.filter((i) => i.id !== id))
  }

  // Summary calculations
  const total     = installments.reduce((s, i) => s + parseFloat(i.amount), 0)
  const paid      = installments.filter((i) => i.status === 'Paid').reduce((s, i) => s + parseFloat(i.amount), 0)
  const remaining = total - paid
  const progress  = total > 0 ? (paid / total) * 100 : 0

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

      {/* Summary row — only when installments exist */}
      {installments.length > 0 && (
        <div className="mb-3 p-3 border border-[#E5E5E2] rounded-xl bg-white">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-[#6B6B67]">Total <span className="font-medium text-[#1A1A18]">{formatAmount(String(total))}</span></span>
            <span className="text-[#6B6B67]">Paid <span className="font-medium text-green-700">{formatAmount(String(paid))}</span></span>
            <span className="text-[#6B6B67]">Due <span className="font-medium text-[#C8952A]">{formatAmount(String(remaining))}</span></span>
          </div>
          <div className="h-1.5 bg-[#E5E5E2] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#C8952A] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Installment cards */}
      {installments.length === 0 && !adding && (
        <p className="text-xs text-[#A0A09C] text-center py-3">No installments yet</p>
      )}

      <div className="space-y-2">
        {installments.map((i) => (
          <InstallmentCard
            key={i.id}
            installment={i}
            orderId={orderId}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        ))}
      </div>

      {/* Add form or add button */}
      {adding ? (
        <div className="mt-2">
          <InstallmentForm
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
            saving={savingNew}
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2 w-full py-2 text-xs font-medium text-[#6B6B67] border border-dashed border-[#C8C8C4] rounded-xl hover:border-[#C8952A] hover:text-[#C8952A] transition-colors"
        >
          + Add Installment
        </button>
      )}
    </div>
  )
}
