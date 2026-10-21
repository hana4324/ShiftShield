import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BUSINESS } from "@shiftshield/shared";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const title = `ShiftShield | ${BUSINESS.tagline}`;
const description =
  "On-demand security staffing for Texas. Post a shift, get matched with licensed, verified security officers, track them on site with GPS, and pay only for approved hours. Now enrolling the Dallas-Fort Worth 30-day pilot.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s | ShiftShield",
  },
  description,
  applicationName: "ShiftShield",
  keywords: [
    "security staffing",
    "on-demand security officers",
    "Texas security guard",
    "Dallas security staffing",
    "shift coverage",
    "licensed security officers",
  ],
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "ShiftShield",
    title,
    description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#07111F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
