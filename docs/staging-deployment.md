# Staging dengan Vercel, Render, dan Supabase

## Keputusan hosting

- **Vercel Hobby** untuk Next.js, untuk preview pribadi/nonkomersial. Persyaratan penggunaan Hobby adalah personal/nonkomersial; bila aplikasi dipakai secara komersial, pilih plan yang sesuai sebelum peluncuran.
- **Render Free** untuk API Fastify staging. Layanan gratis tidur setelah 15 menit tanpa trafik dan dapat memerlukan sekitar satu menit untuk bangun kembali. Render menyatakan Free ditujukan untuk eksperimen/staging, bukan produksi.
- **Supabase PostgreSQL** tetap menjadi database. Buat project staging terpisah agar tes migrasi tidak mengubah data project lain.

Lihat [batas Render Free](https://render.com/docs/free) dan [ketentuan plan Vercel](https://vercel.com/pricing).

## 1. Siapkan Supabase staging

1. Buat atau pilih project Supabase khusus staging.
2. Ambil connection string PostgreSQL dari **Connect**. Ikuti README bila perlu memakai Session Pooler pada port `5432`.
3. Dari PowerShell di root repo, tetapkan URL itu sementara pada sesi terminal, lalu terapkan migrasi:

   ```powershell
   $env:DATABASE_URL = "<connection-string-staging>"
   corepack pnpm --filter @photobooth/db exec prisma migrate deploy
   Remove-Item Env:DATABASE_URL
   ```

   Jalankan perintah hanya setelah memeriksa bahwa URL tersebut menunjuk ke project staging. Jangan menaruh URL itu di Git atau variabel `NEXT_PUBLIC_*`.

## 2. Deploy API ke Render

Konfigurasi Blueprint ada di [render.yaml](../render.yaml). Blueprint membuat satu Node web service di region Singapore dengan health check `/api/health`. Render menerima trafik publik bila proses mengikat `HOST=0.0.0.0` dan `PORT` yang disediakan platform.

1. Setelah perubahan ini tersedia di GitHub, buka Render Dashboard → **New** → **Blueprint** dan hubungkan repo `photobooth`.
2. Pilih `render.yaml`; saat diminta, isi `DATABASE_URL` dengan URL Supabase staging.
3. Isi `WEB_ORIGIN` sementara dengan origin HTTPS Vercel yang akan digunakan. Setelah domain Vercel diketahui, perbarui nilai ini agar sama persis dengan origin web.
4. Biarkan seluruh variabel S3 tidak disetel supaya cloud sharing tetap nonaktif.
5. Pastikan deploy sehat di `https://<layanan-api>.onrender.com/api/health`.

Render Free dapat lambat pada request pertama setelah idle. Batas dan perilakunya dapat berubah; periksa [dokumentasi Free Render](https://render.com/docs/free) sebelum mengandalkannya.

Pairing kamera ponsel menyimpan signaling sementara di memori API. Jalankan API sebagai satu instance agar permintaan QR yang sama selalu mencapai instance yang sama. Jangan menambah replica di belakang load balancer sebelum signaling dipindahkan ke penyimpanan bersama; WebRTC saat ini memakai STUN dan jaringan tertentu mungkin memerlukan TURN.

## 3. Deploy web ke Vercel

Konfigurasi build ada di [apps/web/vercel.json](../apps/web/vercel.json). Saat membuat Project Vercel dari repo `photobooth`:

1. Pilih root directory `apps/web` dan framework Next.js.
2. Gunakan install command default pnpm; build command proyek sudah menyiapkan package workspace lalu membangun Next.js.
3. Atur environment untuk Preview dan Production:

   ```text
   NEXT_PUBLIC_SITE_URL=https://<domain-web-staging>
   NEXT_PUBLIC_API_ORIGIN=https://<layanan-api>.onrender.com
   ```

   Nilai `NEXT_PUBLIC_*` disematkan saat build. Perubahan nilainya memerlukan build/deploy ulang.

4. Setelah Vercel memberi domain final, perbarui `WEB_ORIGIN` di Render ke origin itu dan deploy ulang API.
5. Gunakan [dokumentasi monorepo Vercel](https://vercel.com/docs/monorepos) bila pengaturan workspace perlu disesuaikan.

## 4. Verifikasi staging

1. `https://<layanan-api>.onrender.com/api/health` harus merespons `ok: true`.
2. `https://<layanan-api>.onrender.com/api/capabilities` harus menunjukkan sharing cloud nonaktif selama S3 belum diisi.
3. Buka `https://<domain-web-staging>/booth`, pindai QR dari ponsel, izinkan kamera di kedua perangkat, lalu ambil tepat tiga foto. Periksa hasil frame, filter video, ekspor Story 9:16, unduh PNG/JPG/GIF, dan buka dialog cetak.
4. Pastikan frame Supabase Storage dapat dibaca Canvas dari origin Vercel. Bucket aset publik harus memberi header CORS yang mengizinkan domain staging.

## 5. Setelah staging

- Untuk produksi, gunakan compute API yang selalu aktif dan plan hosting yang sesuai dengan penggunaan aplikasi.
- Sebelum mengaktifkan cloud sharing di Render, konfigurasi dan verifikasi Fastify `trustProxy` agar rate limit berbasis IP melihat alamat klien melalui reverse proxy dengan benar. Jangan mengaktifkan trust proxy secara luas tanpa memastikan header proxy hanya dipercaya dari platform.
- Aktifkan cloud sharing hanya setelah bucket S3 kompatibel privat siap. Masukkan kredensialnya ke environment API saja.
- Jika cloud sharing aktif, jadwalkan `corepack pnpm cleanup:shares` setidaknya sekali per jam pada worker tepercaya.

Tidak ada kredensial hosting atau database di file konfigurasi ini. Secret diisi melalui dashboard hosting atau sesi terminal lokal dan tidak boleh di-commit.
