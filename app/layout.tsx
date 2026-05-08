import type { Metadata } from "next";
import { AuthStateListener } from "@/components/auth/auth-state-listener";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nodi",
    template: "%s | Nodi",
  },
  description: "Mobile-first movie tracking with watched history, watchlists, and personal stats.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth">
      <body className="min-h-full bg-background text-foreground antialiased">
        <AuthStateListener />
        {children}
      </body>
    </html>
  );
}
