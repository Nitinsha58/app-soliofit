'use client'

import PaymentSummaryStrip from '@/components/payments/PaymentSummaryStrip'
import PaymentKanban from '@/components/payments/PaymentKanban'

export default function PaymentsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <p className="text-xs text-[#A0A09C]">Track receivables across all orders</p>
      </div>
      <PaymentSummaryStrip />
      <PaymentKanban />
    </div>
  )
}
