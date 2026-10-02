const steps = [
  {
    number: "01",
    title: "Pilih gaya",
    description: "Pilih bingkai dan tampilan yang cocok untuk momenmu.",
  },
  {
    number: "02",
    title: "Ambil empat foto",
    description: "Atur pose dengan hitung mundur sebelum setiap foto.",
  },
  {
    number: "03",
    title: "Simpan hasilnya",
    description: "Unduh langsung. Berbagi ke cloud selalu pilihanmu.",
  },
];

export default function HomePage() {
  return (
    <>
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Web Photobooth, beranda">
          <span className="wordmark-mark" aria-hidden="true">
            ✳
          </span>
          <span>photo booth</span>
        </a>
        <nav aria-label="Navigasi utama">
          <a href="#cara-kerja">Cara kerja</a>
          <a href="#privasi">Privasi</a>
        </nav>
      </header>

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
              Bikin foto seru bareng teman, langsung dari browser. Tanpa akun,
              tanpa aplikasi tambahan.
            </p>
            <a className="primary-link" href="#cara-kerja">
              Lihat cara kerja
              <span aria-hidden="true">→</span>
            </a>
            <p className="hero-note">Kamera hanya aktif setelah kamu mulai.</p>
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
            ◌
          </span>
          <div>
            <p className="eyebrow">Privasi dari awal</p>
            <h2 id="privacy-title">Foto tetap di perangkatmu.</h2>
            <p>
              Pemotretan dan penyusunan foto dilakukan di browser. Simpan ke
              cloud hanya tersedia jika kamu memilihnya dan menyetujui
              pengunggahan.
            </p>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="wordmark" href="/" aria-label="Web Photobooth, beranda">
          <span className="wordmark-mark" aria-hidden="true">
            ✳
          </span>
          <span>photo booth</span>
        </a>
        <p>Kenangan kecil, dibuat bersama.</p>
      </footer>
    </>
  );
}
