import { z } from 'zod'

export const customerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  // Creation-only rule (this schema is used solely by CreateCustomerModal; the inline edit flow
  // does not use it). Trim first so surrounding spaces don't fail the digit check.
  phone: z.string().trim().regex(/^\d{10}$/, 'Enter a 10-digit phone number'),
  address: z.string().max(500).default(''),
})

export type CustomerFormData = z.infer<typeof customerSchema>
