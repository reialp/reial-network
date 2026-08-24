import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import { SearchProvider } from '@/context/SearchContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Cheki – powered by Reial Production',
  description: 'Discover and buy premium films, documentaries, series and more directly from independent creators.',
  manifest: '/manifest.json',
  themeColor: '#f5c518',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Cheki',
  },
  openGraph: {
    title: 'Cheki – powered by Reial Production',
    description: 'Discover and buy premium films, documentaries, series and more directly from independent creators.',
    type: 'website',
    siteName: 'Cheki',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icons/192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png' },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Cheki" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.className} bg-[#0a0a0a] text-white antialiased`}>
        <SearchProvider>
          <Navbar />
          <main>{children}</main>
        </SearchProvider>
      </body>
    </html>
  )
}
