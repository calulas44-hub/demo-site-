import { headers } from "next/headers";
import { getActiveAnnouncements, getNavigation } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { getCustomerSession } from "@/lib/auth";
import { getClientCart } from "@/lib/cart-actions";
import { CartProvider } from "@/components/shop/cart-context";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { Header, type NavItem } from "@/components/shop/header";
import { AnnouncementBar } from "@/components/shop/announcement-bar";
import { Footer } from "@/components/shop/footer";

export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [settings, nav, announcements, customer, cart, h] = await Promise.all([
    getSettings(),
    getNavigation(),
    getActiveAnnouncements(),
    getCustomerSession(),
    getClientCart(),
    headers(),
  ]);

  const items: NavItem[] = [];
  for (const cat of nav.categories) {
    if (cat.children.length > 0) {
      items.push({
        label: cat.name,
        href: `/categories/${cat.slug}`,
        columns: [
          {
            title: cat.name,
            links: [{ label: `Tous les ${cat.name.toLowerCase()}`, href: `/categories/${cat.slug}` }, ...cat.children.map((c) => ({ label: c.name, href: `/categories/${c.slug}` }))],
          },
          ...(nav.collections.length > 0
            ? [{ title: "Collections", links: nav.collections.slice(0, 6).map((c) => ({ label: c.name, href: `/collections/${c.slug}` })) }]
            : []),
        ],
        visuals: nav.collections.slice(0, 2).map((c) => ({ image: c.imageUrl ?? c.heroImageUrl, label: c.name, href: `/collections/${c.slug}` })),
      });
    } else {
      items.push({ label: cat.name, href: `/categories/${cat.slug}` });
    }
  }
  if (nav.collections.length > 0) {
    items.splice(1, 0, {
      label: "Collections",
      href: "/collections",
      columns: [{ title: "Nos collections", links: [{ label: "Toutes les collections", href: "/collections" }, ...nav.collections.map((c) => ({ label: c.name, href: `/collections/${c.slug}` }))] }],
      visuals: nav.collections.slice(0, 2).map((c) => ({ image: c.imageUrl ?? c.heroImageUrl, label: c.tagline ?? c.name, href: `/collections/${c.slug}` })),
    });
  }
  const maisonLinks = [
    ...nav.pages.filter((p) => ["notre-maison", "faq"].includes(p.slug)).map((p) => ({ label: p.title, href: `/pages/${p.slug}` })),
    { label: "Contact", href: "/contact" },
  ];
  items.push({ label: "La Maison", href: "/pages/notre-maison", columns: [{ title: "La Maison", links: maisonLinks }] });
  for (const m of nav.menuItems.filter((m) => m.menu === "main" && !m.parentId)) {
    const children = nav.menuItems.filter((c) => c.parentId === m.id);
    items.push(children.length ? { label: m.label, href: m.url, columns: [{ title: m.label, links: children.map((c) => ({ label: c.label, href: c.url })) }] } : { label: m.label, href: m.url });
  }

  const pathname = h.get("x-pathname") ?? "";
  const hasHero = pathname === "/" || pathname === "";

  return (
    <CartProvider initialCart={cart}>
      <a href="#main" className="skip-link">
        Aller au contenu
      </a>
      <div className={hasHero ? "has-hero" : ""} data-shell>
        <AnnouncementBar items={announcements.map((a) => ({ id: a.id, text: a.text, url: a.url }))} />
        <Header brandName={settings.brandName} logoUrl={settings.logoUrl} nav={items} customerLoggedIn={Boolean(customer)} hasHero={hasHero} />
        <main id="main">{children}</main>
        <Footer
          settings={settings}
          pages={nav.pages}
          categories={nav.categories.map((c) => ({ slug: c.slug, name: c.name }))}
          collections={nav.collections.map((c) => ({ slug: c.slug, name: c.name }))}
        />
      </div>
      <CartDrawer />
    </CartProvider>
  );
}
