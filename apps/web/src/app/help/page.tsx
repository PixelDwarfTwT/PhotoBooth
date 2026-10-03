import type { Metadata } from "next";
import Link from "next/link";
import { PublicArticle } from "@/components/public-article";
import styles from "../public-pages.module.css";

export const metadata: Metadata = {
  title: "Bantuan photobooth",
  description:
    "Pemecahan masalah kamera, izin browser, ekspor, dan berbagi Web Photobooth.",
};

export default function HelpPage() {
  return (
    <PublicArticle
      eyebrow="Bantuan"
      title="Jika sesuatu tidak berjalan"
      lede="Langkah singkat untuk kamera, ekspor, klip, dan tautan berbagi."
    >
      <h2>Kamera tidak muncul</h2>
      <ul>
        <li>Gunakan browser modern pada HTTPS atau localhost.</li>
        <li>
          Periksa izin kamera pada pengaturan situs, lalu pilih kamera yang
          benar.
        </li>
        <li>
          Tutup aplikasi lain yang sedang memakai kamera dan coba aktifkan
          kembali.
        </li>
        <li>
          Jika sesi selesai atau stream terputus, aktifkan kamera lagi sebelum
          memulai ulang.
        </li>
      </ul>

      <h2>Unduhan atau klip gagal</h2>
      <p>
        Pastikan pratinjau photo strip selesai disusun dan ruang perangkat
        cukup. Jika klip loop tidak didukung, simpan hasil sebagai GIF, PNG,
        atau JPG.
      </p>

      <h2>Tautan cloud tidak tersedia</h2>
      <p>
        Berbagi sementara hanya muncul jika layanan cloud diaktifkan oleh
        pengelola. Foto lokal dan unduhan tetap berfungsi walaupun API atau
        storage cloud sedang tidak tersedia.
      </p>

      <div className={styles.actions}>
        <Link className={styles.primaryLink} href="/booth">
          Kembali ke studio
        </Link>
        <Link className={styles.secondaryLink} href="/privacy">
          Baca privasi
        </Link>
      </div>
    </PublicArticle>
  );
}
