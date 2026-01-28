import './globals.css'
import GuardLayout from './guard'
import { SpeedInsights } from '@vercel/speed-insights/next'

export const metadata = {
  title: 'CPBL Fantasy',
  description: 'Fantasy baseball game for CPBL',
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">
        <GuardLayout>
          {children}
        </GuardLayout>
        <SpeedInsights />
      </body>
    </html>
  )
}
