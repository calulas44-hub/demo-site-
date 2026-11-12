import type { Metadata } from "next";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site-url";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const appUrl = siteUrl();
  return {
    metadataBase: new URL(appUrl),
    title: { default: s.seoTitle || s.brandName, template: `%s — ${s.brandName}` },
    description: s.seoDescription,
    openGraph: { siteName: s.brandName, locale: "fr_FR", type: "website" },
    icons: s.faviconUrl ? { icon: s.faviconUrl } : undefined,
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
