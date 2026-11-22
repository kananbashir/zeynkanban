import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { PressAnimation } from "@/components/press-animation";
import { getLocale } from "@/i18n/server";
import { DEFAULT_THEME, isTheme, THEME_COOKIE, THEME_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Zeyn Media",
  description: "Task and content planning for the Zeyn Media team.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#c9dfd8" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1215" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const saved = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(saved) ? saved : DEFAULT_THEME;
  return (
    // data-dark may be added before React starts (see THEME_SCRIPT), hence suppressHydrationWarning.
    <html lang={locale} data-theme={theme} data-dark={theme === "dark" ? "" : undefined} className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        {children}
        <PressAnimation />
      </body>
    </html>
  );
}
