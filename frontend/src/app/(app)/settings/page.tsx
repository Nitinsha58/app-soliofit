'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  updateProfile,
  changePassword,
  getOrderSettings,
  updateOrderSettings,
  getNotificationPreferences,
  updateNotificationPreferences,
  logout as logoutApi,
  type NotificationPreferences,
} from '@/lib/api/auth'
import { useAuthStore } from '@/stores/useAuthStore'

const NOTIFICATION_LABELS: { key: keyof NotificationPreferences; label: string; hint: string }[] = [
  { key: 'delivery_reminders', label: 'Delivery reminders', hint: 'When an order is due for delivery' },
  { key: 'payment_reminders', label: 'Payment reminders', hint: 'When an installment is due or overdue' },
  { key: 'daily_summary', label: 'Daily summary', hint: 'A morning digest of the day ahead' },
  { key: 'new_order_confirmations', label: 'New order confirmations', hint: 'When a new order is booked' },
]

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-[#E5E5E2] p-5 sm:p-6">
      <h2 className="text-base font-semibold text-[#1A1A18]">{title}</h2>
      {description && <p className="text-xs text-[#6B6B67] mt-0.5 mb-4">{description}</p>}
      <div className={description ? '' : 'mt-4'}>{children}</div>
    </section>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-[#1A1A18] mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full px-3 py-2 border border-[#E5E5E2] rounded-lg text-sm text-[#1A1A18] focus:outline-none focus:ring-2 focus:ring-[#C8952A] focus:border-transparent'

function SaveButton({ saving, disabled, children }: { saving: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={saving || disabled}
      className="px-4 py-2 bg-[#C8952A] text-white text-sm font-medium rounded-lg hover:bg-[#A87820] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {saving ? 'Saving…' : children}
    </button>
  )
}

function Status({ ok, msg }: { ok: boolean; msg: string | null }) {
  if (!msg) return null
  return (
    <p className={`text-xs px-3 py-2 rounded-lg ${ok ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
      {msg}
    </p>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-[#C8952A]' : 'bg-[#D8D8D4]'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, login: setUser, logout: storeLogout } = useAuthStore()

  // --- Profile ---
  const [profile, setProfile] = useState({ business_name: '', owner_name: '', phone: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    if (user) {
      setProfile({
        business_name: user.business_name ?? '',
        owner_name: user.owner_name ?? '',
        phone: user.phone ?? '',
      })
    }
  }, [user])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileMsg(null)
    try {
      const updated = await updateProfile(profile)
      setUser(updated)
      setProfileMsg({ ok: true, msg: 'Profile saved.' })
    } catch (err) {
      setProfileMsg({ ok: false, msg: err instanceof Error ? err.message : 'Could not save profile.' })
    } finally {
      setProfileSaving(false)
    }
  }

  // --- Password ---
  const [pw, setPw] = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; msg: string } | null>(null)

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg(null)
    if (pw.new_password !== pw.confirm) {
      setPwMsg({ ok: false, msg: 'New passwords do not match.' })
      return
    }
    setPwSaving(true)
    try {
      await changePassword(pw.old_password, pw.new_password)
      setPw({ old_password: '', new_password: '', confirm: '' })
      setPwMsg({ ok: true, msg: 'Password changed.' })
    } catch (err) {
      setPwMsg({ ok: false, msg: err instanceof Error ? err.message : 'Could not change password.' })
    } finally {
      setPwSaving(false)
    }
  }

  // --- Order settings ---
  // Working-hours times are held as "HH:MM" (the <input type="time"> form); the API stores
  // "HH:MM:SS". '' = unset. Pairing rule (VS-29.8): fill both or leave both empty.
  const { data: orderSettings } = useQuery({ queryKey: ['order-settings'], queryFn: getOrderSettings })
  const [os, setOs] = useState({ delivery_buffer_days: 0, daily_capacity: 6, opening_time: '', closing_time: '' })
  const [osSaving, setOsSaving] = useState(false)
  const [osMsg, setOsMsg] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    if (orderSettings) {
      setOs({
        delivery_buffer_days: orderSettings.delivery_buffer_days,
        daily_capacity: orderSettings.daily_capacity,
        opening_time: (orderSettings.opening_time ?? '').slice(0, 5), // "HH:MM:SS" → "HH:MM"
        closing_time: (orderSettings.closing_time ?? '').slice(0, 5),
      })
    }
  }, [orderSettings])

  async function saveOrderSettings(e: React.FormEvent) {
    e.preventDefault()
    // Pairing + order rules, mirrored client-side (the backend validates the pair too).
    const open = os.opening_time
    const close = os.closing_time
    if (Boolean(open) !== Boolean(close)) {
      setOsMsg({ ok: false, msg: 'Set both opening and closing time, or leave both empty.' })
      return
    }
    if (open && close && open >= close) {
      setOsMsg({ ok: false, msg: 'Opening time must be before closing time.' })
      return
    }
    setOsSaving(true)
    setOsMsg(null)
    try {
      const updated = await updateOrderSettings({
        delivery_buffer_days: os.delivery_buffer_days,
        daily_capacity: os.daily_capacity,
        opening_time: open || null,
        closing_time: close || null,
      })
      queryClient.setQueryData(['order-settings'], updated)
      // Keep the auth store's working hours in sync so the WhatsApp pickup window is accurate
      // immediately, without forcing a /me refetch (VS-29.8).
      if (user) setUser({ ...user, opening_time: updated.opening_time, closing_time: updated.closing_time })
      setOsMsg({ ok: true, msg: 'Order settings saved.' })
    } catch (err) {
      setOsMsg({ ok: false, msg: err instanceof Error ? err.message : 'Could not save settings.' })
    } finally {
      setOsSaving(false)
    }
  }

  // --- Notification preferences ---
  const { data: prefs } = useQuery({ queryKey: ['notification-preferences'], queryFn: getNotificationPreferences })
  const [notif, setNotif] = useState<NotificationPreferences | null>(null)

  useEffect(() => {
    if (prefs) setNotif(prefs)
  }, [prefs])

  async function toggleNotif(key: keyof NotificationPreferences, value: boolean) {
    if (!notif) return
    const next = { ...notif, [key]: value }
    setNotif(next) // optimistic
    try {
      const saved = await updateNotificationPreferences({ [key]: value })
      queryClient.setQueryData(['notification-preferences'], saved)
    } catch {
      setNotif(notif) // revert
    }
  }

  async function handleLogout() {
    await logoutApi().catch(() => {})
    storeLogout()
    router.push('/login')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="space-y-5">
        {/* Profile */}
        <Section title="Profile" description="Your boutique details, shown across the app.">
          <form onSubmit={saveProfile} className="space-y-4">
            <Field label="Business name" htmlFor="business_name">
              <input id="business_name" className={inputClass} value={profile.business_name}
                onChange={(e) => setProfile({ ...profile, business_name: e.target.value })} placeholder="My Boutique" />
            </Field>
            <Field label="Owner name" htmlFor="owner_name">
              <input id="owner_name" className={inputClass} value={profile.owner_name}
                onChange={(e) => setProfile({ ...profile, owner_name: e.target.value })} placeholder="Your name" />
            </Field>
            <Field label="Phone" htmlFor="phone">
              <input id="phone" className={inputClass} value={profile.phone} inputMode="tel"
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="Contact number" />
            </Field>
            <Field label="Email" htmlFor="email">
              <input id="email" className={`${inputClass} bg-[#F7F7F5] text-[#6B6B67] cursor-not-allowed`} value={user?.email ?? ''} disabled />
            </Field>
            <div className="flex items-center gap-3">
              <SaveButton saving={profileSaving}>Save profile</SaveButton>
              <Status ok={profileMsg?.ok ?? false} msg={profileMsg?.msg ?? null} />
            </div>
          </form>
        </Section>

        {/* Password */}
        <Section title="Change password">
          <form onSubmit={savePassword} className="space-y-4">
            <Field label="Current password" htmlFor="current_password">
              <input id="current_password" type="password" autoComplete="current-password" className={inputClass} value={pw.old_password}
                onChange={(e) => setPw({ ...pw, old_password: e.target.value })} />
            </Field>
            <Field label="New password" htmlFor="new_password">
              <input id="new_password" type="password" autoComplete="new-password" className={inputClass} value={pw.new_password}
                onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm_password">
              <input id="confirm_password" type="password" autoComplete="new-password" className={inputClass} value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </Field>
            <div className="flex items-center gap-3">
              <SaveButton saving={pwSaving} disabled={!pw.old_password || !pw.new_password || !pw.confirm}>
                Change password
              </SaveButton>
              <Status ok={pwMsg?.ok ?? false} msg={pwMsg?.msg ?? null} />
            </div>
          </form>
        </Section>

        {/* Order settings */}
        <Section title="Order settings" description="Defaults used when booking orders and sizing your calendar workload.">
          <form onSubmit={saveOrderSettings} className="space-y-4">
            <Field label="Default delivery buffer (days)" htmlFor="delivery_buffer_days">
              <input id="delivery_buffer_days" type="number" min={0} max={60} className={inputClass} value={os.delivery_buffer_days}
                onChange={(e) => setOs({ ...os, delivery_buffer_days: Math.max(0, Number(e.target.value) || 0) })} />
              <p className="text-xs text-[#6B6B67] mt-1">Add-Order suggests dates at least this many days out.</p>
            </Field>
            <Field label="Daily capacity (garments/day)" htmlFor="daily_capacity">
              <input id="daily_capacity" type="number" min={1} max={100} className={inputClass} value={os.daily_capacity}
                onChange={(e) => setOs({ ...os, daily_capacity: Math.max(1, Number(e.target.value) || 1) })} />
              <p className="text-xs text-[#6B6B67] mt-1">Drives the calendar workload colouring and date suggestions.</p>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Opens at" htmlFor="opening_time">
                <input id="opening_time" type="time" className={inputClass} value={os.opening_time}
                  onChange={(e) => setOs({ ...os, opening_time: e.target.value })} />
              </Field>
              <Field label="Closes at" htmlFor="closing_time">
                <input id="closing_time" type="time" className={inputClass} value={os.closing_time}
                  onChange={(e) => setOs({ ...os, closing_time: e.target.value })} />
              </Field>
            </div>
            <p className="text-xs text-[#6B6B67] -mt-2">Shown to customers as the pickup window in WhatsApp messages. Set both, or leave both empty.</p>
            <div className="flex items-center gap-3">
              <SaveButton saving={osSaving}>Save order settings</SaveButton>
              <Status ok={osMsg?.ok ?? false} msg={osMsg?.msg ?? null} />
            </div>
          </form>
        </Section>

        {/* Notifications */}
        <Section title="Notifications" description="Choose what you want to be reminded about. (Delivery channel coming soon.)">
          <div className="divide-y divide-[#F0F0EE]">
            {NOTIFICATION_LABELS.map(({ key, label, hint }) => (
              <div key={key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1A1A18]">{label}</p>
                  <p className="text-xs text-[#6B6B67]">{hint}</p>
                </div>
                <Toggle on={notif?.[key] ?? false} onChange={(v) => toggleNotif(key, v)} />
              </div>
            ))}
          </div>
        </Section>

        {/* Danger zone */}
        <Section title="Danger zone">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#1A1A18]">Delete all data</p>
              <p className="text-xs text-[#6B6B67]">Permanently remove every order, customer and payment.</p>
            </div>
            <button disabled
              className="px-4 py-2 text-sm font-medium text-[#A0A09C] border border-[#E5E5E2] rounded-lg cursor-not-allowed">
              Coming soon
            </button>
          </div>
        </Section>

        {/* Logout (mobile convenience — desktop uses sidebar) */}
        <button onClick={handleLogout}
          className="lg:hidden w-full py-2.5 text-sm font-medium text-[#6B6B67] border border-[#E5E5E2] rounded-lg hover:bg-gray-50 transition-colors">
          Log out
        </button>
      </div>
    </div>
  )
}
