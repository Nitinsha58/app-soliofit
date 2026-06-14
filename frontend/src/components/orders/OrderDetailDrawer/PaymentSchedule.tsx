'use client'

import { useState, useEffect, useRef } from 'react'
import type { Order } from '@/lib/api/orders'
import type { Installment } from '@/lib/api/installments'
import { listInstallments, replaceSchedule, markInstallmentPaid } from '@/lib/api/installments'
import { isValidMoneyInput } from '@/lib/money'
import QuickDateInput from '@/components/common/QuickDateInput'

interface Props {
  order: Order
  onOrderChange: (updated: Partial<Order>) => void
  onUpdated: () => void
}

// A staged unpaid installment in the editor. Paid rows are never staged — they are shown
// locked and preserved server-side by PUT /orders/{id}/billing/.
interface DraftRow {
  key: string
  amount: string
  due_date: string
  remarks: string
}

function fmt(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function fmtDate(s: string): string {
  if (!s) return ''
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Canonical string for dirty detection — only the fields that get sent on save.
function serialize(bill: string, rows: DraftRow[]): string {
  return JSON.stringify({
    bill: bill.trim(),
    rows: rows.map((r) => ({ a: r.amount.trim(), d: r.due_date, r: r.remarks.trim() })),
  })
}

function PlusIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function StatusBadge({ status, daysOverdue }: { status: Installment['status']; daysOverdue: number }) {
  if (status === 'Paid')
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 whitespace-nowrap">Paid</span>
  if (status === 'Delayed')
    return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 whitespace-nowrap">Delayed · {daysOverdue}d</span>
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 whitespace-nowrap">Pending</span>
}

export default function PaymentSchedule({ order, onOrderChange, onUpdated }: Props) {
  const [installments, setInstallments] = useState<Installment[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draftBill, setDraftBill] = useState(order.total_amount)
  const [rows, setRows] = useState<DraftRow[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmPaidId, setConfirmPaidId] = useState<string | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const snapshotRef = useRef('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    listInstallments(order.id)
      .then((data) => { if (mountedRef.current) setInstallments(data) })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false) })
    return () => { mountedRef.current = false }
  }, [order.id])

  const paidRows = installments.filter((i) => i.status === 'Paid')
  const paidTotal = paidRows.reduce((s, i) => s + parseFloat(i.amount), 0)

  // ── View-mode money summary (read-only) ──────────────────────────────────────
  const billNum = parseFloat(order.total_amount) || 0
  const outstanding = billNum - paidTotal
  const progress = billNum > 0 ? Math.min(100, (paidTotal / billNum) * 100) : 0

  // ── Edit-mode balance math (strict: paid + staged unpaid must equal the bill) ─
  const draftScheduled = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const totalNum = parseFloat(draftBill) || 0
  const billValid = isValidMoneyInput(draftBill, { min: 0 })
  const rowsValid = rows.every((r) => isValidMoneyInput(r.amount, { min: 0.01 }) && r.due_date !== '')
  const belowPaid = billValid && totalNum < paidTotal - 0.005
  const planTotal = paidTotal + draftScheduled
  const remaining = totalNum - planTotal
  const balanced = billValid && !belowPaid && Math.abs(remaining) < 0.005
  const dirty = editing && serialize(draftBill, rows) !== snapshotRef.current
  const canSave = editing && dirty && balanced && rowsValid && !saving

  let statusText = 'Balanced'
  let statusColor = 'text-green-600'
  if (!billValid) { statusText = 'Enter a valid bill'; statusColor = 'text-[#6B6B67]' }
  else if (belowPaid) { statusText = `Bill below paid (${fmt(paidTotal)} already paid)`; statusColor = 'text-red-500' }
  else if (!rowsValid) { statusText = 'Complete each installment'; statusColor = 'text-[#6B6B67]' }
  else if (remaining > 0.005) { statusText = `Remaining ${fmt(remaining)}`; statusColor = 'text-[#C8952A]' }
  else if (remaining < -0.005) { statusText = `Over by ${fmt(-remaining)}`; statusColor = 'text-red-500' }

  function startEdit() {
    const seeded = installments
      .filter((i) => i.status !== 'Paid')
      .map((i) => ({ key: i.id, amount: i.amount, due_date: i.due_date, remarks: i.remarks }))
    setDraftBill(order.total_amount)
    setRows(seeded)
    snapshotRef.current = serialize(order.total_amount, seeded)
    setError('')
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setError('')
  }

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function removeRow(key: string) {
    setRows((rs) => rs.filter((r) => r.key !== key))
  }

  function addRow() {
    const fill = remaining > 0 ? remaining.toFixed(2) : ''
    setRows((rs) => [
      ...rs,
      { key: crypto.randomUUID(), amount: fill, due_date: order.delivery_date, remarks: '' },
    ])
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const updated = await replaceSchedule(order.id, {
        total_amount: draftBill.trim(),
        installments: rows.map((r) => ({
          amount: r.amount.trim(),
          due_date: r.due_date,
          ...(r.remarks.trim() ? { remarks: r.remarks.trim() } : {}),
        })),
      })
      if (!mountedRef.current) return
      onOrderChange({ total_amount: updated.total_amount })
      const fresh = await listInstallments(order.id)
      if (!mountedRef.current) return
      setInstallments(fresh)
      setEditing(false)
      onUpdated()
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Could not save the plan')
    } finally {
      if (mountedRef.current) setSaving(false)
    }
  }

  async function handleMarkPaid(id: string) {
    setMarkingId(id)
    try {
      await markInstallmentPaid(order.id, id)
      const fresh = await listInstallments(order.id)
      if (mountedRef.current) setInstallments(fresh)
      onUpdated()
    } catch {
      // keep the confirm open on failure; user can retry or cancel
    } finally {
      if (mountedRef.current) { setMarkingId(null); setConfirmPaidId(null) }
    }
  }

  if (loading) {
    return (
      <div className="py-2 flex items-center gap-1.5 text-xs text-[#A0A09C]">
        <span className="w-3 h-3 border border-[#A0A09C] border-t-transparent rounded-full animate-spin block shrink-0" />
        Loading…
      </div>
    )
  }

  // ── Edit mode ────────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-[#1A1A18]">Edit bill &amp; plan</span>
          <button onClick={cancelEdit} className="text-xs text-[#6B6B67] hover:text-[#1A1A18] transition-colors">Cancel</button>
        </div>

        {/* Bill */}
        <label className="block text-[11px] font-medium text-[#6B6B67] mb-1">Bill amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#A0A09C] font-medium select-none">₹</span>
          <input
            type="number"
            inputMode="decimal"
            value={draftBill}
            onChange={(e) => setDraftBill(e.target.value)}
            min="0"
            step="0.01"
            className="w-full pl-7 pr-3 py-2 text-sm text-[#1A1A18] border border-[#E5E5E2] rounded-lg bg-white focus:outline-none focus:border-[#C8952A] focus:ring-1 focus:ring-[#C8952A]/30 transition-colors"
          />
        </div>
        {draftBill.trim() !== '' && !billValid && (
          <p className="text-[11px] text-red-500 mt-1">Enter an amount up to 2 decimals (max ₹9,99,99,999.99)</p>
        )}

        {/* Paid rows — locked, preserved server-side */}
        {paidRows.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-semibold text-[#A0A09C] uppercase tracking-wide mb-1.5">Paid · locked</p>
            <div className="space-y-1.5">
              {paidRows.map((i) => (
                <div key={i.id} className="flex items-center gap-2 px-2 py-2 rounded-lg bg-[#F5F5F3] border border-[#EDEDE9]">
                  <span className="text-[#A0A09C]"><LockIcon /></span>
                  <span className="text-sm font-semibold text-[#1A1A18] w-[68px] shrink-0">{fmt(parseFloat(i.amount))}</span>
                  <span className="text-xs text-[#6B6B67] shrink-0">{fmtDate(i.due_date)}</span>
                  <span className="ml-auto shrink-0"><StatusBadge status={i.status} daysOverdue={i.days_overdue} /></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unpaid editable rows */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold text-[#A0A09C] uppercase tracking-wide">Unpaid plan</p>
            <button
              onClick={addRow}
              className="flex items-center gap-1 text-[11px] font-semibold text-[#A87820] hover:text-[#C8952A] transition-colors"
            >
              <PlusIcon /> Add
            </button>
          </div>

          {rows.length === 0 ? (
            <p className="text-xs text-[#A0A09C]">No unpaid installments. Add one to schedule the balance.</p>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.key} className="rounded-lg border border-[#E5E5E2] bg-white p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="relative w-28 shrink-0">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#6B6B67]">₹</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={r.amount}
                        onChange={(e) => updateRow(r.key, { amount: e.target.value })}
                        min="0.01"
                        step="0.01"
                        placeholder="Amount"
                        className="w-full pl-5 pr-2 py-1.5 text-sm border border-[#E5E5E2] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/20 focus:border-[#C8952A]"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <QuickDateInput
                        value={r.due_date}
                        onChange={(iso) => updateRow(r.key, { due_date: iso })}
                        deliveryDate={order.delivery_date}
                        ariaLabel="Installment due date"
                      />
                    </div>
                    <button
                      onClick={() => removeRow(r.key)}
                      className="text-[#D0D0CC] hover:text-red-400 transition-colors p-1 shrink-0"
                      aria-label="Remove installment"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={r.remarks}
                    onChange={(e) => updateRow(r.key, { remarks: e.target.value })}
                    placeholder="Note (optional)"
                    className="w-full px-2 py-1.5 text-xs border border-[#E5E5E2] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#C8952A]/20 focus:border-[#C8952A]"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-[11px] text-red-500 mt-2">{error}</p>}

        {/* Sticky save bar — only when there are unsaved changes (atomicity exception to autosave) */}
        {dirty && (
          <div className="sticky bottom-0 mt-3 bg-white border-t border-[#E5E5E2] pt-2 pb-1">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[11px] font-medium ${statusColor}`}>{statusText}</span>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="text-xs font-semibold text-white bg-[#C8952A] rounded-lg px-3 py-1.5 hover:bg-[#A87820] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save plan'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── View mode (read-only by default) ─────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-[#6B6B67]">Bill</span>
          <span className="text-sm font-semibold text-[#1A1A18] tabular-nums">{fmt(billNum)}</span>
        </div>
        <span className="text-[10px] font-semibold bg-[#EDEDE9] text-[#6B6B67] rounded-full px-1.5 py-0.5 leading-none tabular-nums">
          {installments.length}
        </span>
      </div>

      {billNum > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6B6B67] mb-1.5">
            <span>Paid <span className="font-medium text-green-700">{fmt(paidTotal)}</span></span>
            <span className="text-[#D0D0CC]">·</span>
            <span>
              Outstanding{' '}
              <span className={`font-medium ${outstanding > 0.005 ? 'text-[#C8952A]' : 'text-green-700'}`}>
                {fmt(Math.max(0, outstanding))}
              </span>
            </span>
          </div>
          {installments.length > 0 && (
            <div className="h-1 bg-[#EDEDE9] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-green-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}

      {installments.length > 0 ? (
        <div className="space-y-1.5">
          {installments.map((i) => {
            const isPaid = i.status === 'Paid'
            const confirming = confirmPaidId === i.id
            return (
              <div key={i.id} className="flex items-center gap-2 px-2 py-2 rounded-lg border border-[#E5E5E2] bg-white">
                <span className="text-sm font-semibold text-[#1A1A18] w-[68px] shrink-0">{fmt(parseFloat(i.amount))}</span>
                <span className="text-xs text-[#6B6B67] shrink-0">{fmtDate(i.due_date)}</span>
                {i.remarks && (
                  <span className="text-[11px] text-[#A0A09C] truncate hidden sm:block flex-1">{i.remarks}</span>
                )}
                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  {confirming ? (
                    <>
                      <span className="text-[11px] text-[#6B6B67]">Paid today?</span>
                      <button
                        onClick={() => handleMarkPaid(i.id)}
                        disabled={markingId === i.id}
                        className="text-[11px] font-semibold text-white bg-green-600 rounded px-2 py-0.5 disabled:opacity-50"
                      >
                        {markingId === i.id ? '…' : 'Yes'}
                      </button>
                      <button onClick={() => setConfirmPaidId(null)} className="text-[11px] text-[#6B6B67] hover:text-[#1A1A18]">No</button>
                    </>
                  ) : isPaid ? (
                    <StatusBadge status={i.status} daysOverdue={i.days_overdue} />
                  ) : (
                    <button onClick={() => setConfirmPaidId(i.id)} aria-label="Mark as paid">
                      <StatusBadge status={i.status} daysOverdue={i.days_overdue} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs text-[#A0A09C]">No payment plan yet</p>
      )}

      <button
        onClick={startEdit}
        className="mt-3 w-full py-2 text-xs font-semibold text-[#A87820] bg-[#FBF3E3] hover:bg-[#F5E8C8] rounded-lg transition-colors"
      >
        Edit bill &amp; plan
      </button>
    </div>
  )
}
