import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EverMoments — Family Audio Archive",
  description:
    "Record, preserve, organize, search, and privately share family stories in the storyteller's own voice.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${lora.variable}`}>
      <body className="min-h-screen bg-warm-50 text-stone-900 antialiased">
        {children}
      </body>
    </html>
  );
}
