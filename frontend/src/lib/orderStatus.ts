import type { Order } from '@/lib/api/orders'

// Single source for order-status pill colors (vault 07 palette rule:
// neutral base + one warm gold accent; color stays semantic).
// Booked = neutral entry, Started = gold (in progress), Ready = green (done),
// Partial Delivery = amber (incomplete), Delivered = quiet terminal gray.
export const STATUS_PILL: Record<Order['status'], string> = {
  'Booked':           'bg-[#F5F5F3] text-[#6B6B67]',
  'Started':          'bg-[#FBF3E3] text-[#A87820]',
  'Ready':            'bg-emerald-50 text-emerald-700',
  'Partial Delivery': 'bg-amber-50 text-amber-700',
  'Delivered':        'bg-gray-100 text-gray-600',
}

// Variant with a border, used by the order-detail header status dropdown.
export const STATUS_PILL_BORDERED: Record<Order['status'], string> = {
  'Booked':           'bg-[#F5F5F3] text-[#6B6B67] border-[#E5E5E2]',
  'Started':          'bg-[#FBF3E3] text-[#A87820] border-[#C8952A]/30',
  'Ready':            'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Partial Delivery': 'bg-amber-50 text-amber-700 border-amber-200',
  'Delivered':        'bg-gray-100 text-gray-600 border-gray-200',
}
