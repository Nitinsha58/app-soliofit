// VS-29 — shared customer-create prefill helpers, used by both create entry points
// (AddOrderFlow/StepCustomer and the Customers-page CreateCustomerModal).

// Keep only digits and the LAST 10 of them, so a pasted/typed "+91 9876543210"
// (or any country-code-prefixed number) normalises to "9876543210", not the first 10.
export function sanitizePhone(value: string): string {
  return value.replace(/\D/g, '').slice(-10)
}

// Decide whether the search box held a name or a phone, and seed the matching field.
// Any letter → it's a name (covers "Ravi", "Ravi 98765"); otherwise digits → phone.
export function prefillFromSearch(search: string): { name: string; phone: string } {
  const text = search.trim()
  if (!text) return { name: '', phone: '' }
  if (/[a-zA-Z]/.test(text)) return { name: text, phone: '' }
  const phone = sanitizePhone(text)
  if (phone) return { name: '', phone }
  return { name: text, phone: '' }
}
