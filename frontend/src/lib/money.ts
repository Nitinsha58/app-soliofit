// Shared money-input validation for the Add Order / billing flows.
//
// Mirrors the server's billing precision: Order.total_amount and Installment.amount are
// DecimalField(max_digits=10, decimal_places=2) — i.e. up to 8 integer digits + 2 decimals.
// See backend/apps/orders/serializers.py (OrderBillingSerializer / NewInstallmentSerializer).
// If that precision ever changes, MAX_MONEY must move with it.

// Largest value that fits max_digits=10, decimal_places=2 (8 integer + 2 decimal digits).
export const MAX_MONEY = 99999999.99

// A well-formed money string: digits, optionally followed by up to 2 decimal places.
const MONEY_RE = /^\d+(\.\d{1,2})?$/

// True only for a non-empty, well-formed money string whose value is within [min, MAX_MONEY].
// Empty or malformed input returns false, so callers can treat it as "not yet valid" directly.
export function isValidMoneyInput(value: string, { min = 0 }: { min?: number } = {}): boolean {
  const trimmed = value.trim()
  if (!MONEY_RE.test(trimmed)) return false
  const n = parseFloat(trimmed)
  return n >= min && n <= MAX_MONEY
}
