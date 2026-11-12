import { headers } from "next/headers";
import Link from "next/link";
import { getCustomerSession } from "@/lib/auth";
import { customerLogoutAction } from "@/lib/customer-actions";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getCustomerSession();
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (!session || pathname.startsWith("/compte/connexion") || pathname.startsWith("/compte/inscription")) return <>{children}</>;
  const links = [
    { href: "/compte", label: "Mes commandes" },
    { href: "/compte/adresses", label: "Mes adresses" },
    { href: "/compte/profil", label: "Mes informations" },
  ];
  return (
    <div className="container">
      <header className="page-title">
        <p className="eyebrow">Espace client</p>
        <h1>Bonjour {session.firstName}</h1>
      </header>
      <div className="account" style={{ marginBottom: "5rem" }}>
        <nav className="account__nav" aria-label="Mon compte">
          {links.map((l) => (
            <Link key={l.href} href={l.href} aria-current={pathname === l.href ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
          <form action={customerLogoutAction}>
            <button type="submit" className="caps" style={{ padding: ".6rem 0", color: "var(--muted)" }}>
              Se déconnecter
            </button>
          </form>
        </nav>
        <div>{children}</div>
      </div>
    </div>
  );
}
