'use client'

import { useQuery } from '@tanstack/react-query'
import { getCustomerPayments, type CustomerInstallment } from '@/lib/api/customers'

function fmtAmount(s: string) {
  const n = parseFloat(s) || 0
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_BADGE: Record<CustomerInstallment['status'], string> = {
  Paid:    'bg-emerald-50 text-emerald-700',
  Delayed: 'bg-red-50 text-red-600',
  Pending: 'bg-gray-100 text-gray-500',
}

export default function CustomerPaymentsTab({ customerId }: { customerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['customer-payments', customerId],
    queryFn: () => getCustomerPayments(customerId),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-5 h-5 border-2 border-[#C8952A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!data?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm font-medium text-[#6B6B67]">No payment records</p>
        <p className="text-xs text-[#A0A09C] mt-1">Installments will appear here once added</p>
      </div>
    )
  }

  // Compute overall outstanding
  let totalBilled = 0
  let totalPaid = 0
  for (const group of data) {
    totalBilled += parseFloat(group.total_amount) || 0
    for (const i of group.installments) {
      if (i.paid_date) totalPaid += parseFloat(i.amount) || 0
    }
  }
  const outstanding = totalBilled - totalPaid

  return (
    <div>
      {outstanding > 0 && (
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-100">
          <p className="text-xs text-amber-700">
            Outstanding: <span className="font-bold">{fmtAmount(String(outstanding))}</span>
          </p>
        </div>
      )}

      {data.map((group) => (
        <div key={group.order_id} className="border-b border-[#F0F0EE] last:border-0">
          {/* Order header */}
          <div className="flex items-center justify-between px-6 py-3 bg-[#FAFAF8]">
            <span className="text-xs font-semibold text-[#6B6B67]">
              #{String(group.order_number).padStart(4, '0')} · {fmtDate(group.delivery_date)}
            </span>
            <span className="text-xs font-semibold text-[#1A1A18]">{fmtAmount(group.total_amount)}</span>
          </div>

          {/* Installments */}
          {group.installments.length === 0 ? (
            <p className="px-6 py-3 text-xs text-[#C8C8C4]">No installments</p>
          ) : (
            <div className="divide-y divide-[#F5F5F3]">
              {group.installments.map((inst) => (
                <div key={inst.id} className="flex items-center justify-between px-6 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-[#1A1A18]">{fmtAmount(inst.amount)}</p>
                    <p className="text-[11px] text-[#A0A09C] mt-0.5">
                      {inst.paid_date ? `Paid ${fmtDate(inst.paid_date)}` : `Due ${fmtDate(inst.due_date)}`}
                      {inst.days_overdue > 0 && ` · ${inst.days_overdue}d late`}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[inst.status]}`}>
                    {inst.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
