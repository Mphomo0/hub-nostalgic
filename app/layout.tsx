import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import { appUrl, PLATFORM_NAME } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-display", subsets: ["latin"], axes: ["opsz"] });

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: { default: `${PLATFORM_NAME}: simple tools to win and keep customers`, template: `%s · ${PLATFORM_NAME}` },
  description: "Simple tools for South African small businesses, set up and supported by Nostalgic Studio. Start with Google review automation and add more as you grow.",
};

export const viewport: Viewport = { themeColor: "#f6f7f3" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-ZA" className={`${geistSans.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
