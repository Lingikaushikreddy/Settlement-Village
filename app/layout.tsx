import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Settlement — Build. Battle. Belong.",
  description:
    "Build Willowmere, train your army, and lead raids beyond the treeline. An original village strategy game.",
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
