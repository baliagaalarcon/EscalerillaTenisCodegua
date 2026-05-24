import type { Metadata, Viewport } from 'next'
import { Manrope, Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' })
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap', axes: ['opsz'] })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', weight: ['500', '600'], display: 'swap' })

export const metadata: Metadata = {
  title: 'Escalerilla - Club Tenis Codegua',
  description: 'Escalerilla del Club Tenis Codegua',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Escalerilla Codegua' },
}

export const viewport: Viewport = { themeColor: '#0ea5e9', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body
        className={`${manrope.variable} ${bricolage.variable} ${jetbrains.variable}`}
        style={{ fontFamily: 'var(--font-manrope, system-ui, sans-serif)' }}
      >
        {children}
      </body>
    </html>
  )
}
