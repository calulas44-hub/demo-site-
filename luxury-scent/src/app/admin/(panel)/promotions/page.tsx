import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { isStripeConfigured } from "@/lib/stripe";
import { effectivePrice } from "@/lib/catalog";
import { PromotionsForm } from "@/components/admin/promotions-form";

export default async function PromotionsPage() {
  await requireAdmin(["OWNER", "ADMIN"]);
  const [settings, products] = await Promise.all([
    getSettings(),
    prisma.product.findMany({ where: { status: { not: "ARCHIVED" } }, include: { variants: { where: { active: true } } }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
  ]);
  return (
    <>
      <div className="adm-head">
        <div>
          <h1>Promotions et paiement</h1>
          <p>Offre automatique « 2e parfum » et moyens de paiement proposés à la commande.</p>
        </div>
      </div>
      <PromotionsForm
        settings={settings}
        stripeReady={isStripeConfigured() && Boolean(process.env.STRIPE_WEBHOOK_SECRET)}
        products={products.map((p) => ({ id: p.id, name: p.name, subtitle: p.subtitle, status: p.status, upsellEligible: p.upsellEligible, minPrice: p.variants.length ? Math.min(...p.variants.map(effectivePrice)) : 0 }))}
      />
    </>
  );
}
