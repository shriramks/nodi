import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { AuthStateListener } from "@/components/auth/auth-state-listener";
import { PwaController } from "@/components/pwa/pwa-controller";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Nodi",
  title: {
    default: "Nodi",
    template: "%s | Nodi",
  },
  description: "Mobile-first movie tracking with watched history, watchlists, and personal stats.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Nodi",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon-1024.png", sizes: "1024x1024", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F2F7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jar = await cookies();
  const theme = jar.get("nodi-theme")?.value;

  return (
    <html
      lang="en"
      className="h-full scroll-smooth"
      {...(theme === "light" || theme === "dark" ? { "data-theme": theme } : {})}
    >
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <PwaController />
        <AuthStateListener />
        {children}
      </body>
    </html>
  );
}
