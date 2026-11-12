import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/auth";
import { LoginForm } from "@/components/shop/auth-forms";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ retour?: string }> }) {
  if (await getCustomerSession()) redirect("/compte");
  const { retour } = await searchParams;
  return (
    <div className="container">
      <header className="page-title">
        <p className="eyebrow">Espace client</p>
        <h1>Connexion</h1>
      </header>
      <div style={{ marginBottom: "5rem" }}>
        <LoginForm retour={retour} />
      </div>
    </div>
  );
}
