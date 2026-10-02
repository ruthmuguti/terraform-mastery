import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import { auth } from "@/lib/auth";
import { AppProviders } from "@/components/providers/AppProviders";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TerraOps — Master Terraform",
  description: "An interactive gamified learning platform to master Terraform and Infrastructure as Code.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // JWT decode only — no DB hit. Seeds the session into the client tree so
  // the TopBar doesn't flash a signed-out state on first render (R1.3).
  const session = await auth();

  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="h-full bg-noir-950 text-text-primary antialiased">
        <AppProviders session={session}>{children}</AppProviders>
      </body>
    </html>
  );
}
