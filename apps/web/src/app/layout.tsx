import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Web Photobooth",
    template: "%s | Web Photobooth",
  },
  description:
    "Buat photo strip langsung dari browser. Foto tetap di perangkatmu kecuali kamu memilih untuk menyimpannya ke cloud.",
  applicationName: "Web Photobooth",
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
