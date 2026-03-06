import type { Metadata } from "next"
import { IBM_Plex_Sans } from "next/font/google"
import "./globals.css"
import HydrationGate from "@/components/hydration-gate"
import { AuthProvider } from "@/contexts/auth-context"

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "EcoTwin AI - Urban Sustainability Platform",
  description: "Digital twin technology for data-driven urban planning in Bengaluru",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="stylesheet" href="/cesium/Widgets/widgets.css" />
      </head>
      <body className={`${ibmPlexSans.className} antialiased`}>
        <HydrationGate>
          <AuthProvider>
            {children}
          </AuthProvider>
        </HydrationGate>
      </body>
    </html>
  )
}