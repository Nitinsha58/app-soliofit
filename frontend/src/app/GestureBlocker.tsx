'use client'

import { useEffect } from 'react'

// iOS 10+ ignores viewport user-scalable=no. The only reliable way to prevent
// pinch-to-zoom on Safari is intercepting the Safari-specific gesturestart /
// gesturechange events with a non-passive listener and calling preventDefault().
export default function GestureBlocker() {
  useEffect(() => {
    function prevent(e: Event) {
      e.preventDefault()
    }
    document.addEventListener('gesturestart', prevent, { passive: false })
    document.addEventListener('gesturechange', prevent, { passive: false })
    return () => {
      document.removeEventListener('gesturestart', prevent)
      document.removeEventListener('gesturechange', prevent)
    }
  }, [])
  return null
}
