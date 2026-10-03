import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-navigation";
import { getPublishedThemes } from "@/lib/public-catalog";
import styles from "../../public-pages.module.css";

interface ThemePageProps {
  params: Promise<{ slug: string }>;
}

async function findTheme(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const themes = await getPublishedThemes();
  return themes.find((theme) => theme.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: ThemePageProps): Promise<Metadata> {
  const { slug } = await params;
  const theme = await findTheme(slug);
  if (!theme) return { title: "Tema tidak ditemukan" };
  return {
    title: theme.name,
    description:
      theme.description || `Bingkai photo strip bertema ${theme.name}.`,
    openGraph: theme.thumbnailUrl
      ? {
          images: [
            { url: theme.thumbnailUrl, alt: `Pratinjau tema ${theme.name}` },
          ],
        }
      : undefined,
  };
}

export default async function ThemeDetailPage({ params }: ThemePageProps) {
  const { slug } = await params;
  const theme = await findTheme(slug);
  if (!theme) notFound();

  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <article className={`${styles.content} ${styles.article}`}>
          <header className={styles.heading}>
            <p className={styles.eyebrow}>Tema photo strip</p>
            <h1>{theme.name}</h1>
            <p className={styles.lede}>
              {theme.description ||
                `Jelajahi bingkai ${theme.name} di studio foto.`}
            </p>
          </header>
          {theme.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={styles.thumbnail}
              src={theme.thumbnailUrl}
              alt={`Pratinjau tema ${theme.name}`}
            />
          ) : null}
          <div className={styles.actions}>
            <Link className={styles.primaryLink} href="/booth">
              Gunakan di studio foto
            </Link>
            <Link className={styles.secondaryLink} href="/themes">
              Jelajahi tema lain
            </Link>
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
