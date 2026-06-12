'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { requestPasswordReset } from '@/lib/api/auth'
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/lib/validations/auth'

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  async function onSubmit(data: ForgotPasswordFormData) {
    setServerError(null)
    try {
      await requestPasswordReset(data.email)
      // Neutral success regardless of whether the email is registered — the
      // backend never reveals it, and neither do we.
      setSent(true)
    } catch {
      setServerError('Something went wrong. Please try again.')
    }
  }

  return (
    <div className="w-full max-w-sm px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5E2] p-8">
        <h1 className="text-2xl font-bold text-[#1A1A18] mb-1">Reset password</h1>

        {sent ? (
          <>
            <p className="text-sm text-[#6B6B67] mb-6">
              If that email is registered, we&rsquo;ve sent a reset link. Check your inbox and
              follow the link to set a new password.
            </p>
            <Link
              href="/login"
              className="inline-block text-sm font-medium text-[#A87820] hover:underline"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-[#6B6B67] mb-6">
              Enter your account email and we&rsquo;ll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#1A1A18] mb-1">
                  Email
                </label>
                <input
                  {...register('email')}
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="w-full px-3 py-2 border border-[#E5E5E2] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>

              {serverError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{serverError}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 px-4 bg-[#C8952A] text-white text-sm font-medium rounded-lg hover:bg-[#A87820] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Sending…' : 'Send reset link'}
              </button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-xs font-medium text-[#6B6B67] hover:text-[#A87820] transition-colors"
                >
                  Back to sign in
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
