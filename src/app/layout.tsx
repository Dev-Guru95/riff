import type { Metadata } from "next";
import { Geist, Pirata_One } from "next/font/google";
import "./globals.css";
import { ReferralCapture } from "@/components/ReferralCapture";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
// Display face for the Riff wordmark only — see components/Wordmark.tsx.
const display = Pirata_One({ variable: "--font-display", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Riff — Learn the Business Behind the Music",
  description:
    "AI-powered education for independent artists: marketing, branding, growth, and the music business.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {/* Captures ?ref= on the landing page so attribution survives the
            browsing a learner does before reaching the signup form. */}
        <ReferralCapture />
        {children}
      </body>
    </html>
  );
}
