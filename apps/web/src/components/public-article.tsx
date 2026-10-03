import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "./site-navigation";
import styles from "../app/public-pages.module.css";

interface PublicArticleProps {
  eyebrow: string;
  title: string;
  lede: string;
  children: ReactNode;
}

export function PublicArticle({
  eyebrow,
  title,
  lede,
  children,
}: PublicArticleProps) {
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <article className={`${styles.content} ${styles.article}`}>
          <header className={styles.heading}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1>{title}</h1>
            <p className={styles.lede}>{lede}</p>
          </header>
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
