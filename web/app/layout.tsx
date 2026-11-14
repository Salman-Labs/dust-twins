import type { Metadata } from "next";
import { Martian_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

// One interface family and one partner: Schibsted Grotesk for text, Martian Mono for figures.
const sans = Schibsted_Grotesk({ variable: "--font-sans", subsets: ["latin"] });
const mono = Martian_Mono({ variable: "--font-mono", subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  title: "Dust Twins",
  description: "Where on Earth does dust behave like it does at Mars landing sites, and in which months? Built on NASA MERRA-2 and the Mars dust climatology.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
