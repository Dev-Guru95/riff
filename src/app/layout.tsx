import type { Metadata, Viewport } from "next";
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

// Pinch-zoom is deliberately left enabled (no maximum-scale): disabling it is an
// accessibility regression for anyone who needs to magnify a lesson. themeColor
// matches --background so the Android status bar blends into the app shell
// instead of showing a white strip above it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0f",
  colorScheme: "dark",
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
