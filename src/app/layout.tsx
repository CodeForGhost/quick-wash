import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";

/* Manrope carries titles and body alike; the mono is kept for data columns. */
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "QuickWash",
  description: "Request a laundry pickup in Puttalam and follow it until it comes back clean.",
};

export const viewport: Viewport = {
  themeColor: "#16243f",
  width: "device-width",
  initialScale: 1,
  /*
   * Run the page edge to edge. Without this iOS letterboxes the whole document
   * inside the safe area - a fixed bottom bar then sits above the home
   * indicator with a band of background under it - and, worse, every
   * `env(safe-area-inset-*)` resolves to 0px, which silently disables the
   * inset handling in `globals.css` and the tab bar. Turning it on hands the
   * insets back to the CSS, which is where they are dealt with.
   */
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${jetbrains.variable}`}>
      <body className="min-h-svh antialiased">{children}</body>
    </html>
  );
}
