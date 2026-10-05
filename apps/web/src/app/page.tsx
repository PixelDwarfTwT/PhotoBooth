import Image from "next/image";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-navigation";
import { LOCAL_FRAMES } from "@/features/booth/lib/editor-options";

const reelFrames = [...LOCAL_FRAMES, ...LOCAL_FRAMES];

function PhotoReel({ direction }: { direction: "top" | "bottom" }) {
  return (
    <div className={`hero-reel hero-reel-${direction}`} aria-hidden="true">
      <div className="hero-reel-track">
        {reelFrames.map((frame, index) => (
          <div
            className="hero-reel-tile"
            key={`${frame.id}-${index}`}
            style={{
              backgroundColor: frame.layoutConfig.backgroundColor,
              borderColor: frame.layoutConfig.borderColor,
              borderWidth: Math.max(
                4,
                Math.round(frame.layoutConfig.borderWidth / 3),
              ),
            }}
          >
            <div className="hero-reel-window">
              <Image
                src="/images/photobooth-strip-unsplash.jpg"
                alt=""
                fill
                priority={direction === "top" && index === 0}
                sizes="33.333vw"
              />
            </div>
            <span>{frame.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
    <div className="landing-shell">
      <SiteHeader />
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <PhotoReel direction="top" />
          <div className="hero-stage">
            <div className="hero-stage-copy">
              <p className="eyebrow">Photobooth online, langsung di browser</p>
              <h1 id="hero-title">
                <span>PHOTO</span>
                <span>BOOTH</span>
              </h1>
              <p className="hero-description">
                Empat pose, bingkai pilihan, dan kenangan yang langsung jadi
                photo strip. Tanpa login.
              </p>
            </div>
            <Link
              className="hero-start"
              href="/booth"
              aria-label="Mulai sesi foto"
            >
              <span className="hero-camera-icon" aria-hidden="true">
                <span className="hero-camera-lens" />
                <span className="hero-camera-flash" />
              </span>
            </Link>
            <div className="hero-stage-footer">
              <span>FOTO TETAP DI PERANGKATMU</span>
              <Link href="#frame-showcase">JELAJAHI BINGKAI</Link>
              <span>GRATIS &bull; TANPA AKUN</span>
            </div>
          </div>
          <PhotoReel direction="bottom" />
          <p className="photo-credit">
            Foto strip contoh oleh{" "}
            <a
              href="https://unsplash.com/photos/hand-holding-three-black-and-white-photo-booth-strips-3L5XQoJ8xG4"
              target="_blank"
              rel="noreferrer"
            >
              Crystal Wen
            </a>{" "}
            / Unsplash
          </p>
        </section>

        <section
          className="frame-showcase"
          id="frame-showcase"
          aria-labelledby="frame-showcase-title"
        >
          <div className="frame-showcase-heading">
            <h2 id="frame-showcase-title">Mulai dengan bingkai pilihan</h2>
            <p>Preset lokal tersedia langsung di studio foto.</p>
          </div>
          <ul className="frame-showcase-list">
            {LOCAL_FRAMES.map((frame) => (
              <li className="frame-showcase-item" key={frame.id}>
                <div
                  className="frame-showcase-art"
                  aria-hidden="true"
                  style={{
                    backgroundColor: frame.layoutConfig.backgroundColor,
                    borderColor: frame.layoutConfig.borderColor,
                    borderWidth: frame.layoutConfig.borderWidth,
                  }}
                >
                  <span />
                  <span />
                  <span />
                </div>
                <div>
                  <h3>{frame.name}</h3>
                  <p>{frame.layoutConfig.caption}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="steps-section"
          id="cara-kerja"
          aria-labelledby="steps-title"
        >
          <div className="section-heading">
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
            &#9673;
          </span>
          <div>
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
    </div>
  );
}
