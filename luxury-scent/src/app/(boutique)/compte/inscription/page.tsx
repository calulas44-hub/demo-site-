import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/auth";
import { RegisterForm } from "@/components/shop/auth-forms";

export const metadata: Metadata = { title: "Créer un compte", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ retour?: string }> }) {
  if (await getCustomerSession()) redirect("/compte");
  const { retour } = await searchParams;
  return (
    <div className="container">
      <header className="page-title">
        <p className="eyebrow">Espace client</p>
        <h1>Créer un compte</h1>
        <p className="lead">Suivez vos commandes, enregistrez vos adresses et retrouvez vos factures.</p>
      </header>
      <div style={{ marginBottom: "5rem" }}>
        <RegisterForm retour={retour} />
      </div>
    </div>
  );
}
