import type { Metadata } from "next";
import { requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AddressForm } from "@/components/shop/auth-forms";
import { deleteAddressAction } from "@/lib/customer-actions";

export const metadata: Metadata = { title: "Mes adresses", robots: { index: false } };

export default async function AddressesPage({ searchParams }: { searchParams: Promise<{ modifier?: string }> }) {
  const session = await requireCustomer();
  const { modifier } = await searchParams;
  const addresses = await prisma.address.findMany({ where: { customerId: session.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  const editing = modifier ? addresses.find((a) => a.id === modifier) : undefined;
  return (
    <div>
      <h2 style={{ marginBottom: "1.2rem" }}>Mes adresses</h2>
      {addresses.length > 0 && (
        <div className="cards-grid" style={{ marginBottom: "2.5rem" }}>
          {addresses.map((a) => (
            <div key={a.id} className={`address-card${a.isDefault ? " is-default" : ""}`}>
              <p className="caps">{a.label ?? "Adresse"} {a.isDefault && "· par défaut"}</p>
              {a.firstName} {a.lastName}
              <br />
              {a.line1}
              {a.line2 && (
                <>
                  <br />
                  {a.line2}
                </>
              )}
              <br />
              {a.postalCode} {a.city}, {a.country}
              <div style={{ display: "flex", gap: "1rem", marginTop: ".8rem" }}>
                <a href={`/compte/adresses?modifier=${a.id}`} className="cart-remove" style={{ color: "var(--ink)" }}>
                  Modifier
                </a>
                <form action={deleteAddressAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="cart-remove">
                    Supprimer
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
      <h3 style={{ marginBottom: "1rem" }}>{editing ? "Modifier l'adresse" : "Ajouter une adresse"}</h3>
      <AddressForm key={editing?.id ?? "new"} address={editing} />
    </div>
  );
}
