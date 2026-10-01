import type { Metadata } from "next";
import "./globals.css";

const description =
  "Set village objectives and watch six autonomous residents coordinate, gather and recruit. Build, battle, inspect agent decisions and explore deterministic AI experiments.";

// Vercel exposes the production hostname at build time; local builds use the dev origin.
const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:5173";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Settlement — Multi-Agent Village Game",
  description,
  openGraph: {
    type: "website",
    siteName: "Settlement",
    title: "Settlement — play the multi-agent village game",
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Settlement — play the multi-agent village game",
    description,
  },
  keywords: [
    "multi-agent systems",
    "game AI",
    "village simulation",
    "strategy game",
    "agent-based modeling",
    "Settlement",
  ],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
