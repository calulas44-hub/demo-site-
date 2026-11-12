import type { Metadata } from "next";
import { requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PasswordForm, ProfileForm } from "@/components/shop/auth-forms";

export const metadata: Metadata = { title: "Mes informations", robots: { index: false } };

export default async function ProfilePage() {
  const session = await requireCustomer();
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: session.id } });
  return (
    <div>
      <h2 style={{ marginBottom: "1.2rem" }}>Mes informations</h2>
      <ProfileForm customer={{ firstName: customer.firstName, lastName: customer.lastName, email: customer.email, phone: customer.phone, newsletter: customer.newsletter }} />
      <div className="divider" />
      <h3 style={{ marginBottom: "1rem" }}>Mot de passe</h3>
      <PasswordForm />
    </div>
  );
}
