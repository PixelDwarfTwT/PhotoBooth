import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="wordmark" href="/" aria-label="Web Photobooth, beranda">
        <span className="wordmark-mark" aria-hidden="true">
          ✳
        </span>
        <span>photo booth</span>
      </Link>
      <nav aria-label="Navigasi utama">
        <Link href="/themes">Tema</Link>
        <Link href="/guide">Panduan</Link>
        <Link href="/privacy">Privasi</Link>
        <Link href="/help">Bantuan</Link>
        <Link className="header-cta" href="/booth">
          Mulai foto <span aria-hidden="true">↗</span>
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link className="wordmark" href="/" aria-label="Web Photobooth, beranda">
        <span className="wordmark-mark" aria-hidden="true">
          ✳
        </span>
        <span>photo booth</span>
      </Link>
      <p>Kenangan kecil, dibuat bersama.</p>
    </footer>
  );
}
