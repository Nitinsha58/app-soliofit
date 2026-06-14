'use client'

export type DrawerTab = 'overview' | 'work' | 'money'

const TABS: { id: DrawerTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'work', label: 'Work' },
  { id: 'money', label: 'Money' },
]

// The three top-level views of Order Detail (VS-28). Color = state: the active tab uses the
// gold accent; inactive tabs are neutral. One consistent shell at every breakpoint.
export default function DrawerTabs({
  active,
  onChange,
}: {
  active: DrawerTab
  onChange: (tab: DrawerTab) => void
}) {
  return (
    <div className="flex items-stretch border-b border-[#E5E5E2] px-2">
      {TABS.map((t) => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`relative flex-1 py-3 text-sm font-semibold transition-colors ${
              isActive ? 'text-[#C8952A]' : 'text-[#6B6B67] hover:text-[#1A1A18]'
            }`}
          >
            {t.label}
            <span
              className={`absolute left-2 right-2 -bottom-px h-0.5 rounded-full transition-colors ${
                isActive ? 'bg-[#C8952A]' : 'bg-transparent'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}
