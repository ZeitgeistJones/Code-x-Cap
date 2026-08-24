import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import { AppNav } from "@/components/AppNav";
import { isAuthenticated } from "@/lib/auth";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

const display = Newsreader({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "CODE × CAP",
  description: "Builder-intelligence tracker for crypto projects",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAuthenticated();

  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        {authed ? <AppNav /> : null}
        <main className={authed ? "mx-auto max-w-[1400px] px-4 pb-16 pt-4" : ""}>{children}</main>
      </body>
    </html>
  );
}
