import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Settlement — Village Observatory",
  description: "Observe a living village, investigate deception, and replay the evidence behind every decision.",
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
