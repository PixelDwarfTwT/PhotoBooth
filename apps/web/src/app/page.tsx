import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-navigation";

const steps = [
  {
    number: "01",
    title: "Siapkan sesi",
    description: "Pilih jumlah foto, timer, dan kamera sebelum mulai.",
  },
  {
    number: "02",
    title: "Ambil pose berurutan",
    description:
      "Empat foto dan hitung mundur tiga detik menjadi pilihan awal.",
  },
  {
    number: "03",
    title: "Hias dan simpan",
    description: "Pilih bingkai, tata letak, filter, dan stiker lalu ekspor.",
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">Studio foto kecil di browsermu</p>
            <h1 id="hero-title">
              Empat pose.
              <br />
              Satu strip foto.
            </h1>
            <p className="hero-description">
              Bikin foto seru bareng teman, langsung dari browser. Tanpa akun
              dan tanpa aplikasi tambahan.
            </p>
            <div className="hero-actions">
              <Link className="primary-link" href="/booth">
                Mulai sesi foto <span aria-hidden="true">→</span>
              </Link>
              <Link className="secondary-home-link" href="/themes">
                Jelajahi tema
              </Link>
            </div>
            <p className="hero-note">
              Kamera hanya aktif setelah kamu menekan tombol mulai.
            </p>
          </div>

          <div className="preview-card" aria-hidden="true">
            <div
              className="preview-sticker preview-sticker-top"
              aria-hidden="true"
            >
              ✿
            </div>
            <div className="photo-strip" aria-hidden="true">
              <div className="photo-frame photo-frame-one">
                <span>✦</span>
              </div>
              <div className="photo-frame photo-frame-two">
                <span>♡</span>
              </div>
              <div className="photo-frame photo-frame-three">
                <span>☼</span>
              </div>
              <p>good times</p>
            </div>
            <div
              className="preview-sticker preview-sticker-bottom"
              aria-hidden="true"
            >
              ♥
            </div>
          </div>
        </section>

        <section
          className="steps-section"
          id="cara-kerja"
          aria-labelledby="steps-title"
        >
          <div className="section-heading">
            <p className="eyebrow">Mudah dimulai</p>
            <h2 id="steps-title">Dari pose sampai photo strip</h2>
          </div>
          <ol className="steps-list">
            {steps.map((step) => (
              <li className="step-card" key={step.number}>
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="privacy-section"
          id="privasi"
          aria-labelledby="privacy-title"
        >
          <span className="privacy-icon" aria-hidden="true">
            ◉
          </span>
          <div>
            <p className="eyebrow">Privasi dari awal</p>
            <h2 id="privacy-title">Foto tetap di perangkatmu.</h2>
            <p>
              Memotret, mengedit, dan mengunduh dilakukan di browser. Tautan
              cloud bersifat opsional dan hanya mengirim hasil akhir setelah
              kamu memberikan persetujuan.
            </p>
            <Link className="privacy-link" href="/privacy">
              Baca cara kerja privasi
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
