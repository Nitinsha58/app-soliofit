'use client'

import { useState } from 'react'
import type { Customer } from '@/lib/api/customers'
import type { Order } from '@/lib/api/orders'
import { createOrder } from '@/lib/api/orders'
import StepCustomer from './StepCustomer'
import StepPhotos from './StepPhotos'
import StepDelivery from './StepDelivery'
import StepBilling from './StepBilling'
import StepAdditional from './StepAdditional'
import StepReview from './StepReview'

const STEP_LABELS = ['Customer', 'Photos', 'Delivery', 'Billing', 'Notes', 'Review']

interface Draft {
  customer: Customer | null
  deliveryDate: string
  totalAmount: string
  priority: boolean
  remarks: string
}

interface Props {
  onClose: () => void
  onCreated: (order: Order) => void
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export default function AddOrderFlow({ onClose, onCreated }: Props) {
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Draft>({
    customer: null,
    deliveryDate: '',
    totalAmount: '',
    priority: false,
    remarks: '',
  })

  function next() { setStep((s) => Math.min(s + 1, 6)) }
  function back() { setStep((s) => Math.max(s - 1, 1)) }
  function patch(updates: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...updates }))
  }

  async function handleCreate() {
    if (!draft.customer || !draft.deliveryDate || !draft.totalAmount) return
    setSubmitting(true)
    setError('')
    try {
      const order = await createOrder({
        customer: draft.customer.id,
        delivery_date: draft.deliveryDate,
        total_amount: parseFloat(draft.totalAmount),
        priority: draft.priority,
        remarks: draft.remarks,
      })
      onCreated(order)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create order')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#E5E5E2] flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[#1A1A18]">New Order</h2>
            <p className="text-xs text-[#A0A09C] mt-0.5">{STEP_LABELS[step - 1]}</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#A0A09C] hover:text-[#1A1A18] transition-colors p-1 -mr-1"
          >
            <XIcon />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1.5 py-3 flex-shrink-0">
          {STEP_LABELS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-200 ${
                i + 1 === step
                  ? 'w-5 h-1.5 bg-[#C8952A]'
                  : i + 1 < step
                  ? 'w-1.5 h-1.5 bg-[#C8952A]/50'
                  : 'w-1.5 h-1.5 bg-[#E5E5E2]'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
          {step === 1 && (
            <StepCustomer
              selected={draft.customer}
              onSelect={(c) => { patch({ customer: c }); next() }}
            />
          )}
          {step === 2 && <StepPhotos onNext={next} onBack={back} />}
          {step === 3 && (
            <StepDelivery
              value={draft.deliveryDate}
              onChange={(d) => patch({ deliveryDate: d })}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 4 && (
            <StepBilling
              totalAmount={draft.totalAmount}
              onAmountChange={(a) => patch({ totalAmount: a })}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 5 && (
            <StepAdditional
              remarks={draft.remarks}
              priority={draft.priority}
              onRemarksChange={(r) => patch({ remarks: r })}
              onPriorityChange={(p) => patch({ priority: p })}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 6 && (
            <StepReview
              draft={draft}
              submitting={submitting}
              error={error}
              onCreate={handleCreate}
              onBack={back}
            />
          )}
        </div>
      </div>
    </div>
  )
}
