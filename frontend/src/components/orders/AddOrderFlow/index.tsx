'use client'

import { useState, useEffect } from 'react'
import type { Customer } from '@/lib/api/customers'
import type { Order } from '@/lib/api/orders'
import { createOrder } from '@/lib/api/orders'
import { uploadPhoto, presignUpload, uploadToStorage, saveVoiceNote } from '@/lib/api/media'
import StepCustomer from './StepCustomer'
import StepPhotos from './StepPhotos'
import StepDelivery from './StepDelivery'
import StepBilling from './StepBilling'
import StepAdditional from './StepAdditional'
import StepReview from './StepReview'
import type { DraftInstallment } from './DraftInstallments'

const STEP_LABELS = ['Customer', 'Photos', 'Delivery', 'Billing', 'Notes', 'Review']

interface Draft {
  customer: Customer | null
  deliveryDate: string
  totalAmount: string
  priority: boolean
  remarks: string
  pendingGarmentPhotos: File[]
  pendingNotesPhotos: File[]
  pendingVoice: { blob: Blob; duration: number } | null
  pendingInstallments: DraftInstallment[]
  // Durable flag: the user has taken manual control of the installment schedule. Held here (not
  // in StepBilling) so deleting the auto-seeded row sticks across leaving/returning to the step.
  installmentsTouched: boolean
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
    pendingGarmentPhotos: [],
    pendingNotesPhotos: [],
    pendingVoice: null,
    pendingInstallments: [],
    installmentsTouched: false,
  })

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

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
      // VS-27.4 — order + its full schedule are created in ONE atomic request (the server
      // validates Σ installments == bill). `source` is a client-only marker, stripped here.
      // No more separate post-create installment POSTs → no partial/orphaned schedules.
      const order = await createOrder({
        customer: draft.customer.id,
        delivery_date: draft.deliveryDate,
        total_amount: parseFloat(draft.totalAmount),
        priority: draft.priority,
        remarks: draft.remarks,
        installments: draft.pendingInstallments.map((inst) => ({
          amount: inst.amount,
          due_date: inst.due_date,
          ...(inst.remarks ? { remarks: inst.remarks } : {}),
          ...(inst.paid ? { paid: true } : {}),
        })),
      })
      // Upload staged photos in background — fire and forget.
      // Garment and notes buckets upload with their respective photo_type.
      const photoUploads = [
        ...draft.pendingGarmentPhotos.map((f) => uploadPhoto(order.id, f, 'garment')),
        ...draft.pendingNotesPhotos.map((f) => uploadPhoto(order.id, f, 'notes')),
      ]
      if (photoUploads.length > 0) {
        Promise.allSettled(photoUploads).catch(() => {})
      }
      // Upload staged voice note in background — fire and forget
      if (draft.pendingVoice) {
        const { blob, duration } = draft.pendingVoice
        const ext = blob.type.includes('ogg') ? '.ogg' : '.webm'
        presignUpload('voice-notes', `recording${ext}`, blob.type || 'audio/webm', blob.size)
          .then(({ upload_url, public_url, s3_key, content_type }) =>
            uploadToStorage(upload_url, new File([blob], `recording${ext}`, { type: blob.type }), content_type)
              .then(() => saveVoiceNote(order.id, s3_key, public_url, Math.round(duration)))
          )
          .catch(() => {})
      }
      onCreated(order)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create order')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center lg:p-4 bg-black/40">
      <div className="bg-white rounded-t-2xl lg:rounded-2xl shadow-xl w-full lg:max-w-lg flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#E5E5E2] flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-[#1A1A18]">New Order</h2>
            <p className="text-xs text-[#A0A09C] mt-0.5">
              Step {step} of {STEP_LABELS.length} · {STEP_LABELS[step - 1]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#A0A09C] hover:text-[#1A1A18] transition-colors p-1 -mr-1"
          >
            <XIcon />
          </button>
        </div>

        {/* Progress — one segment per step */}
        <div className="px-6 pt-3 pb-1 flex-shrink-0">
          <div className="flex gap-1">
            {STEP_LABELS.map((label, i) => (
              <div
                key={label}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  i < step ? 'bg-[#C8952A]' : 'bg-[#E5E5E2]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">
          {step === 1 && (
            <StepCustomer
              selected={draft.customer}
              onSelect={(c) => { patch({ customer: c }); next() }}
            />
          )}
          {step === 2 && (
            <StepPhotos
              garmentFiles={draft.pendingGarmentPhotos}
              onGarmentChange={(f) => patch({ pendingGarmentPhotos: f })}
              notesFiles={draft.pendingNotesPhotos}
              onNotesChange={(f) => patch({ pendingNotesPhotos: f })}
              onNext={next}
              onBack={back}
            />
          )}
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
              deliveryDate={draft.deliveryDate}
              installments={draft.pendingInstallments}
              onInstallmentsChange={(list) => patch({ pendingInstallments: list })}
              installmentsTouched={draft.installmentsTouched}
              onInstallmentsTouch={() => patch({ installmentsTouched: true })}
              onNext={next}
              onBack={back}
            />
          )}
          {step === 5 && (
            <StepAdditional
              remarks={draft.remarks}
              priority={draft.priority}
              pendingVoice={draft.pendingVoice}
              onRemarksChange={(r) => patch({ remarks: r })}
              onPriorityChange={(p) => patch({ priority: p })}
              onVoiceRecorded={(blob, duration) => patch({ pendingVoice: { blob, duration } })}
              onVoiceClear={() => patch({ pendingVoice: null })}
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
