import { z } from 'zod'

export const customerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  phone: z.string().min(1, 'Phone is required').max(20),
  address: z.string().max(500).default(''),
})

export type CustomerFormData = z.infer<typeof customerSchema>
