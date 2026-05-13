import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mercure Hotels — Operations',
  description: 'Système de gestion opérationnelle — Mercure & Ibis Lyon',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  )
}
