import "@/app/globals.css"
import { Inter } from "next/font/google"
import type React from "react"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "PixSqueeze - Image Compression Tool",
  description: "Compress images offline with advanced features like HEIC support, corner rounding, and batch processing",
  generator: 'PixSqueeze PWA',
  applicationName: 'PixSqueeze',
  keywords: ['image compression', 'HEIC', 'HEIF', 'offline', 'PWA', 'batch processing'],
  authors: [{ name: 'PixSqueeze' }],
  creator: 'PixSqueeze',
  publisher: 'PixSqueeze',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('http://localhost:3000'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'PixSqueeze - Image Compression Tool',
    description: 'Compress images offline with advanced features',
    url: '/',
    siteName: 'PixSqueeze',
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '192x192',
        url: '/android-chrome-192x192.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '512x512',
        url: '/android-chrome-512x512.png',
      },
    ],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PixSqueeze',
    startupImage: [
      {
        url: '/apple-touch-icon.png',
        media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" />
        <meta name="theme-color" content="#1a1a2e" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="PixSqueeze" />
        <meta name="apple-touch-fullscreen" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#1a1a2e" />
        <meta name="msapplication-tap-highlight" content="no" />
        
        {/* iOS-specific optimizations */}
        <meta name="apple-mobile-web-app-orientations" content="portrait" />
        <meta name="supported-color-schemes" content="dark" />
        <meta name="color-scheme" content="dark" />
        
        {/* Disable iOS zoom on input focus */}
        <meta name="format-detection" content="telephone=no, date=no, email=no, address=no" />
        
        {/* HEIC support library */}
        <script src="https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js"></script>
        
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased ios-safe-area`} style={{margin: 0, padding: 0, width: '100%', overflowX: 'hidden'}}>
        {children}
      </body>
    </html>
  )
}


import './globals.css'
