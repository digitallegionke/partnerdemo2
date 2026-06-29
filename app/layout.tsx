import type { Metadata } from 'next'
import { Toaster } from "@/components/ui/toaster"
import './globals.css'
import AuthProvider from "./context/auth-context";
import GoogleMapsProvider from "./context/maps-provider";


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
    <html lang="en">
      <body>
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
