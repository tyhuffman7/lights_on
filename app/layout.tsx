import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lights On — Arbitrage Lab",
  description: "Kalshi and Polymarket US arbitrage research and a $100 paper trading challenge.",
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
