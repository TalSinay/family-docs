import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/AppShell";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

// פונט מערכת (ללא תלות ב-Google Fonts) - תומך היטב בעברית בכל מכשיר,
// טוען מהר יותר ולא דורש רשת חיצונית.

export const metadata: Metadata = {
  title: "תיק המשפחה",
  description: "ניהול מסמכי המשפחה במקום אחד",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "תיק המשפחה",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Providers>
          <ServiceWorkerRegister />
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
