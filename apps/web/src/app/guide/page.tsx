import type { Metadata } from "next";
import Link from "next/link";
import { PublicArticle } from "@/components/public-article";
import styles from "../public-pages.module.css";

export const metadata: Metadata = {
  title: "Panduan photobooth",
  description:
    "Cara memakai kamera, timer, bingkai, filter, dan stiker di Web Photobooth.",
};

export default function GuidePage() {
  return (
    <PublicArticle
      eyebrow="Panduan singkat"
      title="Dari kamera ke photo strip"
      lede="Siapkan kamera, ambil rangkaian pose, lalu susun dan simpan hasilnya di browser."
    >
      <ol>
        <li>
          Buka studio dan pilih jumlah foto, hitung mundur, kamera, serta efek
          cermin.
        </li>
        <li>
          Tekan <strong>Aktifkan kamera</strong>, lalu izinkan akses kamera di
          browser. Kamera tidak diminta sebelum tindakan ini.
        </li>
        <li>
          Mulai sesi. Setelah foto diambil, tinjau urutannya dan ulangi foto
          bila perlu.
        </li>
        <li>
          Pilih bingkai, tata letak, dan filter. Seret stiker; tombol panah dan
          Delete juga dapat digunakan.
        </li>
        <li>
          Unduh PNG, JPG, GIF loop, atau klip loop. Berbagi langsung memakai
          menu perangkat bila browser mendukungnya.
        </li>
      </ol>
      <section className={styles.notice}>
        <p>
          <strong>Berbagi cloud bersifat opsional.</strong> Hanya hasil akhir
          yang diunggah, setelah kamu mencentang persetujuan dan menekan tombol
          buat tautan.
        </p>
        <p>
          Gunakan kamera pada halaman HTTPS atau localhost. Pastikan cahaya
          cukup dan bersihkan lensa sebelum mulai.
        </p>
      </section>
      <div className={styles.actions}>
        <Link className={styles.primaryLink} href="/booth">
          Mulai sesi foto
        </Link>
        <Link className={styles.secondaryLink} href="/help">
          Buka bantuan kamera
        </Link>
      </div>
    </PublicArticle>
  );
}
