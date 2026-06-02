import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import GestureBlocker from './GestureBlocker'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Soliofit',
  description: 'Professional Tailoring & Boutique Order Management',
}

// viewport-fit=cover activates env(safe-area-inset-*) on iPhone/iPad.
// maximumScale=1 / userScalable=false disables pinch-to-zoom for app-like feel.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <GestureBlocker />
        {children}
      </body>
    </html>
  )
}
