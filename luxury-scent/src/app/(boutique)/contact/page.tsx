import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { ContactForm } from "@/components/shop/contact-form";

export const metadata: Metadata = { title: "Contact", description: "Une question sur un parfum, une commande ? Écrivez-nous." };

export default async function ContactPage() {
  const s = await getSettings();
  return (
    <div className="container">
      <header className="page-title">
        <p className="eyebrow">Service client</p>
        <h1>Nous contacter</h1>
        <p className="lead">
          {s.openingHours} {s.contactPhone && `Téléphone : ${s.contactPhone}.`}
        </p>
      </header>
      <div className="auth" style={{ maxWidth: "36rem", marginBottom: "5rem" }}>
        <ContactForm />
        <p className="small muted" style={{ marginTop: "2rem", whiteSpace: "pre-line", textAlign: "center" }}>
          {s.companyLegalName}
          {"\n"}
          {s.address}
        </p>
      </div>
    </div>
  );
}
