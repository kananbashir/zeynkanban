import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { getLocale } from "@/i18n/server";

export const metadata: Metadata = {
  title: "Zeyn Media",
  description: "Task and content planning for the Zeyn Media team.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#c9dfd8",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
