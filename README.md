# Web Photobooth

Fondasi monorepo untuk photobooth berbasis browser. Kamera dan pengolahan foto akan tetap berjalan di perangkat pengguna. Foto tidak dikirim ke server kecuali pengguna memilih alur simpan cloud pada tahap berikutnya.

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

Perintah Prisma migration hanya ditujukan untuk database lokal yang dijalankan dari Compose. Ganti koneksi dan kredensial sebelum memakai database lain; jangan pernah memakai kredensial contoh ini di staging atau production.

## Workspace

- apps/web: landing page publik Next.js.
- apps/api: API Fastify.
- packages/contracts: skema validasi dan tipe API bersama.
- packages/db: skema Prisma, migrasi, dan client server-only.

## Batas tahap awal

Branch ini menyediakan fondasi Tahap 1–2. Alur kamera, hitung mundur, editor Canvas, pengelolaan katalog, upload S3, tautan berbagi, QR, dan GIF belum diimplementasikan. Jangan simpan foto pengguna di database atau unggah secara otomatis.
