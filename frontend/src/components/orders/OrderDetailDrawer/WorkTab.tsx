'use client'

import PhotoSection from './PhotoSection'
import VoiceSection from './VoiceSection'

// VS-28.2 — Work tab. Garment photos, measurement notes, and voice notes are the tailor's
// single instruction packet, so they read as ONE "Work Instructions" card (§0.5: a card is one
// mental unit). PhotoSection/VoiceSection are mounted embedded — same tested capture/upload/
// playback behavior, only their standalone headers + margins are dropped.
export default function WorkTab({ orderId }: { orderId: string }) {
  return (
    <div className="px-5 py-4">
      <div className="rounded-xl border border-[#E5E5E2] bg-white p-4">
        <h3 className="text-[11px] font-semibold text-[#A0A09C] uppercase tracking-widest mb-3">
          Work Instructions
        </h3>

        <PhotoSection orderId={orderId} embedded />

        <div className="border-t border-[#F0F0EE] mt-4 pt-4">
          <VoiceSection orderId={orderId} embedded />
        </div>
      </div>
    </div>
  )
}
