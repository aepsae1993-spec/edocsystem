import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'E-Document System',
  description: 'ระบบสารบรรณอิเล็กทรอนิกส์',
  viewport: 'width=device-width, initial-scale=1.0, maximum-scale=1.0',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&family=Sarabun:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-slate-50 h-screen flex flex-col overflow-hidden text-slate-800 text-base font-sans">
        {children}
      </body>
    </html>
  )
}
