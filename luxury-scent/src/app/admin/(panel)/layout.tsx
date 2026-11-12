import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import "../admin.css";
import { requireAdmin, canManageBank, canManageFinance } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { adminLogoutAction } from "@/lib/admin-actions/auth";
import { ADMIN_ROLE_LABELS } from "@/lib/constants";

export const metadata: Metadata = { title: { default: "Administration", template: "%s — Administration" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const [settings, pendingOrders, unreadMessages, pathname] = await Promise.all([
    getSettings(),
    prisma.order.count({ where: { status: { in: ["PENDING_PAYMENT", "PAID"] } } }),
    prisma.contactMessage.count({ where: { read: false } }),
    headers().then((h) => h.get("x-pathname") ?? ""),
  ]);

  const groups: { title: string; items: { href: string; label: string; count?: number; show?: boolean }[] }[] = [
    { title: "Pilotage", items: [{ href: "/admin", label: "Tableau de bord" }, { href: "/admin/commandes", label: "Commandes", count: pendingOrders }, { href: "/admin/clients", label: "Clients" }, { href: "/admin/messages", label: "Messages", count: unreadMessages }] },
    { title: "Catalogue", items: [{ href: "/admin/produits", label: "Produits" }, { href: "/admin/categories", label: "Catégories" }, { href: "/admin/collections", label: "Collections" }, { href: "/admin/marques", label: "Marques" }] },
    { title: "Contenu", items: [{ href: "/admin/accueil", label: "Page d'accueil" }, { href: "/admin/pages", label: "Pages" }, { href: "/admin/newsletter", label: "Newsletter" }] },
    {
      title: "Finances",
      items: [
        { href: "/admin/comptabilite", label: "Comptabilité", show: canManageFinance(session.role) },
        { href: "/admin/comptabilite/depenses", label: "Dépenses", show: canManageFinance(session.role) },
        { href: "/admin/banque", label: "Coordonnées bancaires", show: canManageBank(session.role) },
      ],
    },
    { title: "Réglages", items: [{ href: "/admin/parametres", label: "Paramètres" }, { href: "/admin/livraison", label: "Livraison" }, { href: "/admin/utilisateurs", label: "Utilisateurs", show: session.role === "OWNER" }, { href: "/admin/emails", label: "E-mails envoyés" }] },
  ];

  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-side__brand">
          {settings.brandName}
          <small>Administration</small>
        </div>
        <nav className="adm-nav" aria-label="Administration">
          {groups.map((g) => (
            <div key={g.title} style={{ display: "contents" }}>
              <h5>{g.title}</h5>
              {g.items
                .filter((i) => i.show !== false)
                .map((i) => (
                  <Link key={i.href} href={i.href} aria-current={pathname === i.href || (i.href !== "/admin" && pathname.startsWith(i.href + "/")) ? "page" : undefined}>
                    {i.label}
                    {i.count ? <span className="badge-count">{i.count}</span> : null}
                  </Link>
                ))}
            </div>
          ))}
          <h5>Site</h5>
          <Link href="/" target="_blank" rel="noopener">
            Voir la boutique ↗
          </Link>
        </nav>
        <div className="adm-side__user">
          {session.name}
          <br />
          <span style={{ opacity: 0.6 }}>{ADMIN_ROLE_LABELS[session.role]}</span>
          <form action={adminLogoutAction}>
            <button type="submit">Se déconnecter</button>
          </form>
        </div>
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  );
}
