import Link from "next/link";
import { Icon } from "./icon";
import { NewsletterForm } from "./newsletter-form";
import type { SiteSettings } from "@/lib/settings";

interface Props {
  settings: SiteSettings;
  pages: { slug: string; title: string }[];
  categories: { slug: string; name: string }[];
  collections: { slug: string; name: string }[];
}

export function Footer({ settings, pages, categories, collections }: Props) {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div>
          <div className="footer__brand">{settings.brandName}</div>
          <p className="footer__about">{settings.seoDescription}</p>
          {(settings.contactEmail || settings.contactPhone || settings.openingHours) && (
            <p className="footer__about small" style={{ whiteSpace: "pre-line" }}>
              {[settings.contactEmail, settings.contactPhone, settings.openingHours].filter(Boolean).join("\n")}
            </p>
          )}
          <div className="footer__social">
            {settings.instagram && (
              <a className="icon-btn" href={settings.instagram} target="_blank" rel="noopener">
                <Icon name="instagram" />
                <span className="visually-hidden">Instagram</span>
              </a>
            )}
            {settings.facebook && (
              <a className="icon-btn" href={settings.facebook} target="_blank" rel="noopener">
                <Icon name="facebook" />
                <span className="visually-hidden">Facebook</span>
              </a>
            )}
            {settings.tiktok && (
              <a className="icon-btn" href={settings.tiktok} target="_blank" rel="noopener">
                <Icon name="tiktok" />
                <span className="visually-hidden">TikTok</span>
              </a>
            )}
          </div>
        </div>
        <div>
          <h4>Boutique</h4>
          <ul>
            <li>
              <Link href="/parfums">Tous les parfums</Link>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/categories/${c.slug}`}>{c.name}</Link>
              </li>
            ))}
            {collections.slice(0, 4).map((c) => (
              <li key={c.slug}>
                <Link href={`/collections/${c.slug}`}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Aide</h4>
          <ul>
            <li>
              <Link href="/suivi">Suivre ma commande</Link>
            </li>
            <li>
              <Link href="/contact">Nous contacter</Link>
            </li>
            <li>
              <Link href="/compte">Mon compte</Link>
            </li>
            {pages.map((p) => (
              <li key={p.slug}>
                <Link href={`/pages/${p.slug}`}>{p.title}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Newsletter</h4>
          <p className="footer__about">Nouveautés, éditions limitées et conseils, une fois par mois.</p>
          <NewsletterForm compact />
        </div>
      </div>
      <div className="container footer__bottom">
        <span>
          © {new Date().getFullYear()} {settings.brandName}. Tous droits réservés.
        </span>
        <div className="footer__payments" aria-label="Moyens de paiement">
          <span>Carte bancaire</span>
          <span>Virement</span>
        </div>
      </div>
    </footer>
  );
}
