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
}

export const DEFAULT_SETTINGS: SiteSettings = {
  brandName: "Luxury Scent",
  tagline: "Parfumerie de luxe",
  logoUrl: null,
  faviconUrl: null,
  contactEmail: "contact@luxury-scent.fr",
  contactPhone: "+33 1 00 00 00 00",
  address: "1 rue de la Paix\n75002 Paris\nFrance",
  openingHours: "Service client du lundi au samedi, de 10h à 19h.",
  companyLegalName: "Luxury Scent",
  companyForm: "SAS",
  siret: "",
  vatNumber: "",
  shareCapital: "",
  rcs: "",
  vatRate: 20,
  currency: "EUR",
  shippingInfo:
    "Expédition sous 24 à 48 h ouvrées en colis suivi. Livraison offerte en France métropolitaine dès 150 €.",
  freeShippingThreshold: 15000,
  instagram: "",
  facebook: "",
  tiktok: "",
  seoTitle: "Luxury Scent — Parfumerie de luxe en ligne",
  seoDescription:
    "Luxury Scent sélectionne des parfums d'exception : eaux de parfum, extraits et coffrets, livrés avec soin.",
  invoiceFooter: "Merci de votre confiance.",
  reassurance: [
    { icon: "truck", title: "Livraison offerte", text: "dès 150 € en France métropolitaine" },
    { icon: "gift", title: "Écrin offert", text: "chaque commande est préparée avec soin" },
    { icon: "shield", title: "Paiement sécurisé", text: "carte bancaire ou virement" },
    { icon: "chat", title: "Un conseiller à votre écoute", text: "du lundi au samedi, de 10h à 19h" },
  ],
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
