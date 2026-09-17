import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Settlement — Multi-Agent Village Game",
  description:
    "Set village objectives and watch six autonomous residents coordinate, gather and recruit. Build, battle, inspect agent decisions and explore deterministic AI experiments.",
  keywords: [
    "multi-agent systems",
    "game AI",
    "village simulation",
    "strategy game",
    "agent-based modeling",
    "Settlement",
  ],
  other: {
    "codex-preview": "development",
  },
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
