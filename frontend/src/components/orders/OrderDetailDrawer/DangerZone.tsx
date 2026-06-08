'use client'

import { useState } from 'react'
import { deleteOrder, type Order } from '@/lib/api/orders'
import { useUIStore } from '@/stores/useUIStore'

interface Props {
  order: Order
  onUpdated: () => void
  onClose: () => void
}

// Two-step delete (no one-tap): the destructive button only appears after the
// owner expands the confirmation, which names the order and its side effects.
export default function DangerZone({ order, onUpdated, onClose }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const showToast = useUIStore((s) => s.showToast)
  const num = `#${String(order.order_number).padStart(4, '0')}`

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await deleteOrder(order.id)
      showToast(`Order ${num} deleted`)
      onUpdated()  // board + all surfaces refetch; the card disappears
      onClose()
    } catch {
      setError('Could not delete this order. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <div className="px-5 pt-2 pb-8">
      <div className="rounded-xl border border-red-200 bg-red-50/40 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">Danger zone</p>

        {!confirming ? (
          <>
            <p className="mt-1 text-[12px] text-[#6B6B67]">
              Remove this order from your boards and reports.
            </p>
            <button
              onClick={() => setConfirming(true)}
              className="mt-3 rounded-lg border border-red-300 px-3 py-1.5 text-[13px] font-semibold text-red-600 transition-colors hover:bg-red-50"
            >
              Delete order
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 text-[13px] font-medium text-[#1A1A18]">Delete order {num}?</p>
            <p className="mt-1 text-[12px] text-[#6B6B67]">
              This also removes its installments and photos. This can&rsquo;t be undone.
            </p>
            {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
            <div className="mt-3 flex items-center gap-2">
              <button
                disabled={deleting}
                onClick={handleDelete}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : `Delete ${num}`}
              </button>
              <button
                disabled={deleting}
                onClick={() => { setConfirming(false); setError(null) }}
                className="px-3 py-1.5 text-[13px] font-semibold text-[#6B6B67] transition-colors hover:text-[#1A1A18] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
