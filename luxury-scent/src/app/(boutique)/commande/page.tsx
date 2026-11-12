import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCartDetails } from "@/lib/cart";
import { getCustomerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isStripeConfigured } from "@/lib/stripe";
import { getSettings } from "@/lib/settings";
import { CheckoutForm } from "@/components/shop/checkout-form";

export const metadata: Metadata = { title: "Commande", robots: { index: false } };

export default async function CheckoutPage() {
  const cart = await getCartDetails();
  if (cart.lines.length === 0) redirect("/panier");
  const [session, settings] = await Promise.all([getCustomerSession(), getSettings()]);
  const [methods, addresses, customer] = await Promise.all([
    prisma.shippingMethod.findMany({ where: { active: true }, orderBy: { position: "asc" } }),
    session ? prisma.address.findMany({ where: { customerId: session.id }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    session ? prisma.customer.findUnique({ where: { id: session.id } }) : Promise.resolve(null),
  ]);

  return (
    <div className="container">
      <header className="page-title">
        <p className="eyebrow">Finaliser</p>
        <h1>Votre commande</h1>
      </header>
      <CheckoutForm
        cart={{
          lines: cart.lines.map((l) => ({ variantId: l.variantId, name: l.name, variantLabel: l.variantLabel, imageUrl: l.imageUrl, quantity: l.quantity, total: l.total })),
          subtotal: cart.subtotal,
          total: cart.total,
          discount: cart.discount ? { amount: cart.discount.amount, label: cart.discount.label } : null,
        }}
        methods={methods.map((m) => ({ id: m.id, name: m.name, description: m.description, price: m.price, freeAbove: m.freeAbove, estimatedDays: m.estimatedDays, countries: m.countries }))}
        customer={customer ? { email: customer.email, firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone } : null}
        addresses={addresses.map((a) => ({ id: a.id, label: a.label, firstName: a.firstName, lastName: a.lastName, company: a.company, line1: a.line1, line2: a.line2, postalCode: a.postalCode, city: a.city, country: a.country, phone: a.phone }))}
        cardEnabled={isStripeConfigured()}
        bankTransferEnabled={settings.bankTransferEnabled}
      />
    </div>
  );
}
