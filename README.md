# Web Photobooth

Photobooth berbasis browser dengan alur kamera dan editor lokal di `/booth`. Foto diproses dan disimpan sementara di memori browser, lalu dapat diunduh ke perangkat. Tidak ada unggahan foto ke server.

## Stack

- Web: Next.js App Router, React, TypeScript, CSS.
- API: Fastify REST dengan TypeScript.
- Data: PostgreSQL dan Prisma ORM 7.
- Workspace: pnpm.

## Prasyarat

- Node.js 24.11 atau lebih baru.
- Docker Desktop untuk PostgreSQL lokal.
- pnpm 12.8.2. Bila Corepack tersedia, aktifkan dengan perintah corepack enable; packageManager di root akan memilih versi proyek.

## Menjalankan lokal di PowerShell

~~~powershell
Copy-Item .env.example .env
docker compose up -d postgres
corepack pnpm install
corepack pnpm db:generate
corepack pnpm db:migrate --name init
corepack pnpm dev
~~~

Web berjalan di http://localhost:3000; API berjalan di http://127.0.0.1:4000. Endpoint awal API adalah GET /api/health.

## Menggunakan photobooth

1. Buka halaman utama lalu pilih **Mulai sesi foto**.
2. Di `/booth`, pilih jumlah foto dan timer. Nilai awalnya empat foto dengan hitung mundur tiga detik.
3. Tekan **Aktifkan kamera** dan izinkan akses kamera di browser. Kamera baru diminta setelah tindakan ini.
4. Mulai sesi, tinjau atau ulangi foto, lalu atur photo strip atau kolase, filter, dan stiker.
5. Unduh hasil sebagai PNG atau JPG. Foto dan hasil edit tetap di perangkat.

Kamera memerlukan konteks aman: gunakan `https://` saat mengakses dari perangkat lain. `http://localhost` didukung untuk pengembangan lokal. Jika browser tidak memberi akses kamera atau tidak mendukung ekspor Canvas, halaman akan menampilkan petunjuk untuk mencoba kembali atau memakai browser yang mendukung.

Perintah Prisma migration hanya ditujukan untuk database lokal yang dijalankan dari Compose. Ganti koneksi dan kredensial sebelum memakai database lain; jangan pernah memakai kredensial contoh ini di staging atau production.

## Workspace

- apps/web: landing page publik Next.js dan sesi photobooth browser-only.
- apps/api: API Fastify.
- packages/contracts: skema validasi dan tipe API bersama.
- packages/db: skema Prisma, migrasi, dan client server-only.

Layanan katalog yang ditambahkan kemudian harus menormalisasi email admin ke huruf kecil, mewajibkan alt text dan catatan lisensi pada setiap aset, serta memvalidasi JSON layout bingkai dan konfigurasi filter sebelum disimpan atau dirender.

## Batas fitur saat ini

Editor menyediakan tata letak strip dan kolase dua kolom, empat filter lokal, serta stiker simbol generik. Foto tetap di memori browser dan tidak masuk ke API atau database. Penyimpanan cloud dengan persetujuan, katalog bingkai/filter dinamis, tautan berbagi, kode QR, dan GIF belum tersedia.
