import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-navigation";
import { getPublishedThemes } from "@/lib/public-catalog";
import styles from "../public-pages.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tema photo strip",
  description:
    "Jelajahi bingkai photo strip original yang tersedia di Web Photobooth.",
};

export default async function ThemesPage() {
  const themes = await getPublishedThemes();

  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <div className={styles.content}>
          <header className={styles.heading}>
            <p className={styles.eyebrow}>Galeri bingkai</p>
            <h1>Pilih suasana foto</h1>
            <p className={styles.lede}>
              Lihat koleksi tema yang dipublikasikan. Bingkai dan filter katalog
              dapat dipilih langsung di studio foto.
            </p>
          </header>
          {themes.length ? (
            <ul className={styles.grid} aria-label="Tema photo strip">
              {themes.map((theme) => (
                <li className={styles.card} key={theme.id}>
                  {theme.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className={styles.thumbnail}
                      src={theme.thumbnailUrl}
                      alt={`Pratinjau tema ${theme.name}`}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.thumbnail} aria-hidden="true" />
                  )}
                  <h2>{theme.name}</h2>
                  {theme.description ? <p>{theme.description}</p> : null}
                  <Link
                    className={styles.cardLink}
                    href={`/themes/${encodeURIComponent(theme.slug)}`}
                  >
                    Lihat tema
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <section className={styles.errorState} aria-live="polite">
              <h2>Katalog tema belum tersedia</h2>
              <p>
                Coba lagi beberapa saat lagi. Preset bingkai lokal tetap
                tersedia saat kamu membuka studio.
              </p>
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
