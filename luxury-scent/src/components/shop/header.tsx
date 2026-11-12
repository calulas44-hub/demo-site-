"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icon";
import { useCart } from "./cart-context";
import { SearchPanel } from "./search-panel";

export interface NavLink {
  label: string;
  href: string;
}
export interface NavColumn {
  title: string;
  links: NavLink[];
}
export interface NavVisual {
  image: string | null;
  label: string;
  href: string;
}
export interface NavItem {
  label: string;
  href: string;
  columns?: NavColumn[];
  visuals?: NavVisual[];
}

interface Props {
  brandName: string;
  logoUrl: string | null;
  nav: NavItem[];
  customerLoggedIn: boolean;
  hasHero: boolean;
}

export function Header({ brandName, logoUrl, nav, customerLoggedIn, hasHero }: Props) {
  const { cart, open } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [overlay, setOverlay] = useState(hasHero);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [desktopOpen, setDesktopOpen] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!hasHero) {
      setOverlay(false);
      return;
    }
    const onScroll = () => setOverlay(window.scrollY < 40 && !menuOpen);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasHero, menuOpen]);

  useEffect(() => {
    document.body.style.overflow = menuOpen || searchOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen, searchOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setSearchOpen(false);
        setDesktopOpen(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const isOverlay = overlay && !desktopOpen;

  return (
    <>
      <header ref={headerRef} className={`site-header${isOverlay ? " is-overlay" : ""}`}>
        <div className="container header__inner">
          <div className="header__left">
            <button type="button" className="icon-btn" aria-label="Ouvrir le menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} style={{ display: "inline-flex" }} data-mobile-only>
              <Icon name="menu" />
            </button>
            <nav className="nav" aria-label="Navigation principale">
              {nav.map((item) => {
                const hasMega = (item.columns && item.columns.length > 0) || (item.visuals && item.visuals.length > 0);
                return (
                  <div
                    key={item.label}
                    className={`nav__item${desktopOpen === item.label ? " is-open" : ""}`}
                    onMouseEnter={() => hasMega && setDesktopOpen(item.label)}
                    onMouseLeave={() => setDesktopOpen(null)}
                  >
                    {hasMega ? (
                      <button type="button" aria-expanded={desktopOpen === item.label} onClick={() => setDesktopOpen(desktopOpen === item.label ? null : item.label)}>
                        {item.label}
                      </button>
                    ) : (
                      <Link href={item.href}>{item.label}</Link>
                    )}
                    {hasMega && (
                      <div className="mega">
                        <div className="mega__inner">
                          <div className="mega__cols">
                            {item.columns?.map((col) => (
                              <div className="mega__col" key={col.title}>
                                <h4>{col.title}</h4>
                                <ul>
                                  {col.links.map((l) => (
                                    <li key={l.href + l.label}>
                                      <Link href={l.href} onClick={() => setDesktopOpen(null)}>
                                        {l.label}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                          {item.visuals && item.visuals.length > 0 && (
                            <div className="mega__visuals">
                              {item.visuals.slice(0, 2).map((v) => (
                                <Link key={v.href} href={v.href} className="mega__visual" onClick={() => setDesktopOpen(null)}>
                                  <figure>{v.image && <img src={v.image} alt="" loading="lazy" />}</figure>
                                  <figcaption>{v.label}</figcaption>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          <Link href="/" className="logo" aria-label={`${brandName} — accueil`}>
            {logoUrl ? <img className="logo-img" src={logoUrl} alt={brandName} /> : brandName}
          </Link>

          <div className="header__right">
            <button type="button" className="icon-btn" aria-label="Rechercher" onClick={() => setSearchOpen(true)}>
              <Icon name="search" />
            </button>
            <Link href={customerLoggedIn ? "/compte" : "/compte/connexion"} className="icon-btn" aria-label="Mon compte">
              <Icon name="account" />
            </Link>
            <button type="button" className="icon-btn" aria-label={`Panier, ${cart.count} article${cart.count > 1 ? "s" : ""}`} onClick={open}>
              <Icon name="cart" />
              {cart.count > 0 && <span className="cart-bubble" aria-hidden="true">{cart.count}</span>}
            </button>
          </div>
        </div>
      </header>

      {/* Menu mobile */}
      <div className={`drawer${menuOpen ? " is-open" : ""}`} aria-hidden={!menuOpen}>
        <div className="drawer__backdrop" onClick={() => setMenuOpen(false)} />
        <nav className="drawer__panel drawer__panel--left" aria-label="Menu">
          <div className="drawer__head">
            <span className="logo" style={{ fontSize: "1.1rem" }}>
              {brandName}
            </span>
            <button type="button" className="icon-btn" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu">
              <Icon name="close" />
            </button>
          </div>
          <div className="drawer__body">
            {nav.map((item) => {
              const hasSub = (item.columns && item.columns.length > 0) || false;
              const isOpen = openSub === item.label;
              return (
                <div className="mnav__item" key={item.label}>
                  {hasSub ? (
                    <button type="button" aria-expanded={isOpen} onClick={() => setOpenSub(isOpen ? null : item.label)}>
                      {item.label}
                      <Icon name={isOpen ? "minus" : "plus"} />
                    </button>
                  ) : (
                    <Link href={item.href} onClick={() => setMenuOpen(false)}>
                      {item.label}
                      <Icon name="chevron" />
                    </Link>
                  )}
                  {hasSub && isOpen && (
                    <div className="mnav__sub">
                      {item.columns?.map((col) => (
                        <div key={col.title}>
                          {item.columns && item.columns.length > 1 && <h5>{col.title}</h5>}
                          {col.links.map((l) => (
                            <Link key={l.href + l.label} href={l.href} onClick={() => setMenuOpen(false)}>
                              {l.label}
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="mnav__item">
              <Link href={customerLoggedIn ? "/compte" : "/compte/connexion"} onClick={() => setMenuOpen(false)}>
                {customerLoggedIn ? "Mon compte" : "Connexion"}
                <Icon name="account" />
              </Link>
            </div>
          </div>
        </nav>
      </div>

      {searchOpen && <SearchPanel onClose={() => setSearchOpen(false)} />}

      <style>{`@media (min-width:1024px){[data-mobile-only]{display:none!important}}`}</style>
    </>
  );
}
