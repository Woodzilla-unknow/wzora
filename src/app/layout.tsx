import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { site } from "@/content/site";
import { themeInitScript } from "@/components/ThemeToggle";
import { BootScreen, bootInitScript } from "@/components/Boot";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: site.name,
  description: site.description,
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: bootInitScript }} />
        <noscript>
          <style>{`.reveal{opacity:1;transform:none}.boot{display:none}`}</style>
        </noscript>
      </head>
      <body>
        <BootScreen />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
