'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { confirmPasswordReset } from '@/lib/api/auth'
import { useUIStore } from '@/stores/useUIStore'
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations/auth'

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-sm px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5E2] p-8">{children}</div>
    </div>
  )
}

function InvalidLink() {
  return (
    <Card>
      <h1 className="text-2xl font-bold text-[#1A1A18] mb-1">Link expired</h1>
      <p className="text-sm text-[#6B6B67] mb-6">
        This reset link is invalid or has expired. Request a new one to continue.
      </p>
      <Link
        href="/forgot-password"
        className="inline-block w-full text-center py-2 px-4 bg-[#C8952A] text-white text-sm font-medium rounded-lg hover:bg-[#A87820] transition-colors"
      >
        Request a new link
      </Link>
    </Card>
  )
}

function ResetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const showToast = useUIStore((s) => s.showToast)
  const [serverError, setServerError] = useState<string | null>(null)

  const uid = params.get('uid')
  const token = params.get('token')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  })

  // No uid/token in the URL → there's nothing to confirm against.
  if (!uid || !token) return <InvalidLink />
  // Narrowed to string for the closure below.
  const resetUid = uid
  const resetToken = token

  async function onSubmit(data: ResetPasswordFormData) {
    setServerError(null)
    try {
      await confirmPasswordReset(resetUid, resetToken, data.password)
      showToast('Password reset. Sign in with your new password.')
      router.push('/login')
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Could not reset your password. Please try again.',
      )
    }
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold text-[#1A1A18] mb-1">Set a new password</h1>
      <p className="text-sm text-[#6B6B67] mb-6">Choose a new password for your account.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[#1A1A18] mb-1">
            New password
          </label>
          <input
            {...register('password')}
            id="password"
            type="password"
            autoComplete="new-password"
            className="w-full px-3 py-2 border border-[#E5E5E2] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#1A1A18] mb-1">
            Confirm password
          </label>
          <input
            {...register('confirmPassword')}
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            className="w-full px-3 py-2 border border-[#E5E5E2] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C8952A]/25 focus:border-[#C8952A]"
            placeholder="••••••••"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
          )}
        </div>

        {serverError && (
          <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            <p>{serverError}</p>
            <Link href="/forgot-password" className="mt-1 inline-block font-medium underline">
              Request a new link
            </Link>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-2 px-4 bg-[#C8952A] text-white text-sm font-medium rounded-lg hover:bg-[#A87820] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Card><p className="text-sm text-[#6B6B67]">Loading…</p></Card>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
