import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gosol.io"),
  title: "Gosol CRM",
  description: "Gosol CRM — منصّة إدارة العملاء والمبيعات",
  openGraph: {
    title: "Gosol CRM",
    description: "Gosol CRM — منصّة إدارة العملاء والمبيعات",
    siteName: "Gosol CRM",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F4F7FB]">
        {children}
      </body>
    </html>
  );
}