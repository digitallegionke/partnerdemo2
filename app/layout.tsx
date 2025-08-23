import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Toaster } from "@/components/ui/toaster"
import './globals.css'
import AuthProvider from "./context/auth-context";

import GoogleMapsProvider from "./context/maps-provider";

const outfit = localFont({
  src: '../assets/fonts/Outfit-VariableFont_wght.ttf',
  variable: '--font-outfit',
})


export const metadata: Metadata = {
  title: "Roundi - Delivery Management Platform",
  description:
    "Streamline your delivery operations with smart route planning, driver management, and real-time tracking.",
  generator: "Roundi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable}`}>
      <body className={outfit.className}>
        <AuthProvider>
          <GoogleMapsProvider>
            {children}
            <Toaster />
          </GoogleMapsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
