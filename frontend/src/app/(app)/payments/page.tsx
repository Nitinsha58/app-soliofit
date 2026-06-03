'use client'

import PaymentSummaryStrip from '@/components/payments/PaymentSummaryStrip'
import PaymentKanban from '@/components/payments/PaymentKanban'

export default function PaymentsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#1A1A18]">Payments</h1>
        <p className="text-xs text-[#A0A09C] mt-0.5">Track receivables across all orders</p>
      </div>
      <PaymentSummaryStrip />
      <PaymentKanban />
    </div>
  )
}
