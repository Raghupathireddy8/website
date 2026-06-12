import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
})

export const metadata: Metadata = {
  title: 'MarketGreeks - Indian Stock Market Tools & Fintech Information',
  description: 'Your complete Indian market toolkit. Free tools for traders & investors including IPO tracker, options screener, virtual trading, tax calculator, and more.',
  keywords: ['Indian stock market', 'NSE', 'BSE', 'IPO', 'options trading', 'NIFTY', 'SENSEX', 'mutual funds', 'Calculators'],
}

export const viewport = {
  themeColor: '#2d4af0',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${jetbrainsMono.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
