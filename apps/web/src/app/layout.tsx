import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE_ORIGIN } from "@/lib/public-catalog";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
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
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Web Photobooth",
    title: "Web Photobooth — Photo strip langsung dari browser",
    description:
      "Ambil empat pose, pilih bingkai, dan simpan hasil secara lokal.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fffaf6",
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
