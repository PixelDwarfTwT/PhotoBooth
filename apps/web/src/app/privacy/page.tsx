import type { Metadata } from "next";
import { PublicArticle } from "@/components/public-article";

export const metadata: Metadata = {
  title: "Privasi foto",
  description:
    "Ketahui bagaimana Web Photobooth memproses foto secara lokal dan berbagi cloud berdasarkan persetujuan.",
};

export default function PrivacyPage() {
  return (
    <PublicArticle
      eyebrow="Privasi"
      title="Kamu mengendalikan foto"
      lede="Kamera dan editor berjalan di browser. Kami tidak mengunggah foto saat kamu memotret, mengedit, atau mengunduh ke perangkat."
    >
      <h2>Pemrosesan lokal</h2>
      <p>
        Foto ditangkap dan disusun melalui Camera dan Canvas API di perangkatmu.
        Sesi disimpan sementara di memori browser dan hilang saat sesi ditutup
        atau dimulai ulang.
      </p>

      <h2>Berbagi sementara atas persetujuanmu</h2>
      <p>
        Jika kamu memilih tautan cloud, aplikasi terlebih dahulu menampilkan
        tujuan, ukuran maksimum, dan masa simpan. Foto baru dikirim setelah kamu
        mencentang kotak persetujuan lalu menekan tombol untuk membuat tautan.
      </p>
      <p>
        Salinan cloud hanya dapat dibuka oleh orang yang memegang tautan acak.
        Tautan kedaluwarsa otomatis sesuai waktu yang ditampilkan. Kamu dapat
        menghapusnya lebih awal dari dialog hasil; kredensial penghapusan
        terpisah hanya disimpan sementara di halaman pembuat.
      </p>

      <h2>Kamera dan browser</h2>
      <p>
        Izin kamera diminta setelah kamu menekan tombol aktifkan kamera. Browser
        dapat menolak atau menghentikan izin itu kapan saja. Tidak ada akun yang
        diperlukan.
      </p>

      <h2>Katalog</h2>
      <p>
        API dapat menyajikan metadata tema, bingkai, filter, serta petunjuk
        pose. Data katalog tidak menyertakan foto sesi. Aset katalog memerlukan
        teks alternatif dan informasi lisensi.
      </p>
    </PublicArticle>
  );
}
