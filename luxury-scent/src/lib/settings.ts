import { prisma } from "./db";

export interface SiteSettings {
  brandName: string;
  tagline: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  contactEmail: string;
  contactPhone: string;
  address: string;
  openingHours: string;
  companyLegalName: string;
  companyForm: string;
  siret: string;
  vatNumber: string;
  shareCapital: string;
  rcs: string;
  vatRate: number;
  currency: string;
  shippingInfo: string;
  freeShippingThreshold: number | null; // centimes
  instagram: string;
  facebook: string;
  tiktok: string;
  seoTitle: string;
  seoDescription: string;
  invoiceFooter: string;
  reassurance: { icon: string; title: string; text: string }[];
  // Vente additionnelle « 2e parfum »
  upsellEnabled: boolean;
  upsellRate: number; // pourcentage de remise
  upsellMaxPrice: number; // centimes : prix unitaire maximal du parfum remisé
  upsellTitle: string;
  upsellText: string;
  // Paiement
  bankTransferEnabled: boolean;
}

/**
 * Valeurs par défaut volontairement neutres : aucune information juridique ou commerciale
 * n'est inventée. Tout se complète dans Administration → Réglages.
 */
export const DEFAULT_SETTINGS: SiteSettings = {
  brandName: "Luxury Scent",
  tagline: "Parfumerie de luxe",
  logoUrl: null,
  faviconUrl: null,
  contactEmail: "",
  contactPhone: "",
  address: "",
  openingHours: "",
  companyLegalName: "",
  companyForm: "",
  siret: "",
  vatNumber: "",
  shareCapital: "",
  rcs: "",
  vatRate: 20,
  currency: "EUR",
  shippingInfo: "",
  freeShippingThreshold: null,
  instagram: "",
  facebook: "",
  tiktok: "",
  seoTitle: "Luxury Scent — Parfumerie de luxe en ligne",
  seoDescription: "Luxury Scent : parfums de luxe en ligne.",
  invoiceFooter: "Merci de votre confiance.",
  reassurance: [],
  upsellEnabled: true,
  upsellRate: 10,
  upsellMaxPrice: 10000,
  upsellTitle: "Votre 2e parfum à -10 %",
  upsellText: "Ajoutez un second parfum de moins de 100 € : il est remisé de 10 % automatiquement.",
  bankTransferEnabled: false,
};

const KEY = "site";

export async function getSettings(): Promise<SiteSettings> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(row.value) as Partial<SiteSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
}
