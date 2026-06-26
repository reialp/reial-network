import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import { SearchProvider } from '@/context/SearchContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Reial Network – Premium Stories from Creators',
  description: 'Discover and buy exclusive films, documentaries, and series directly from creators.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0a0a0a] text-white antialiased`}>
        <SearchProvider>
          <Navbar />
          <main>{children}</main>
        </SearchProvider>
      </body>
    </html>
  )
}