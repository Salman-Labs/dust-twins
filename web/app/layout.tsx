import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans({ variable: "--font-geist-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const mono = IBM_Plex_Mono({ variable: "--font-geist-mono", subsets: ["latin"], weight: ["400", "500"] });
const serif = Archivo({ variable: "--font-serif", subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  title: "Dust Twins",
  description: "Where on Earth does dust behave like it does at Mars landing sites, and in which months? Built on NASA MERRA-2 and the Mars dust climatology.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
