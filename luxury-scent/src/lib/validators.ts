import { z } from "zod";
import { EXPENSE_CATEGORIES, GENDERS, HOME_SECTION_TYPES, PRODUCT_STATUSES } from "./constants";

const optionalText = z.string().trim().max(5000).optional().or(z.literal("")).transform((v) => (v ? v : null));
const optionalShort = z.string().trim().max(300).optional().or(z.literal("")).transform((v) => (v ? v : null));
const optionalUrl = z.string().trim().max(500).optional().or(z.literal("")).transform((v) => (v ? v : null));

export const emailSchema = z.email({ message: "Adresse e-mail invalide." }).trim().toLowerCase().max(200);
export const passwordSchema = z
  .string()
  .min(10, "Le mot de passe doit contenir au moins 10 caractères.")
  .max(200);

export const checkboxSchema = z.preprocess((v) => v === "on" || v === "true" || v === true || v === "1", z.boolean());

export const centsSchema = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}, z.number().int().min(0).nullable());

export const intSchema = z.preprocess((v) => (v === "" || v === null ? 0 : Number(v)), z.number().int());
export const floatSchema = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}, z.number().nullable());

// ------------------------------------------------------------------ Catalogue

export const productSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(200),
  slug: z.string().trim().max(120).optional().or(z.literal("")),
  subtitle: optionalShort,
  brandId: optionalShort,
  categoryId: optionalShort,
  collectionId: optionalShort,
  shortDescription: optionalText,
  description: optionalText,
  inspiration: optionalText,
  notesTop: optionalShort,
  notesHeart: optionalShort,
  notesBase: optionalShort,
  families: optionalShort,
  gender: z.enum(GENDERS).default("MIXTE"),
  status: z.enum(PRODUCT_STATUSES).default("DRAFT"),
  featured: checkboxSchema.default(false),
  isNew: checkboxSchema.default(false),
  isLimited: checkboxSchema.default(false),
  vatRate: floatSchema,
  position: intSchema.default(0),
  seoTitle: optionalShort,
  seoDescription: optionalShort,
});

export const variantSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1, "La contenance est obligatoire.").max(60),
  volumeMl: floatSchema,
  sku: optionalShort,
  price: centsSchema.refine((v) => v !== null && v >= 0, "Le prix est obligatoire."),
  salePrice: centsSchema,
  costPrice: centsSchema,
  stock: intSchema.default(0),
  lowStockThreshold: intSchema.default(3),
  active: checkboxSchema.default(true),
  position: intSchema.default(0),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(120).optional().or(z.literal("")),
  description: optionalText,
  parentId: optionalShort,
  position: intSchema.default(0),
  active: checkboxSchema.default(true),
  showInMenu: checkboxSchema.default(true),
  seoTitle: optionalShort,
  seoDescription: optionalShort,
});

export const brandSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(120).optional().or(z.literal("")),
  description: optionalText,
  position: intSchema.default(0),
  active: checkboxSchema.default(true),
});

export const collectionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(120).optional().or(z.literal("")),
  tagline: optionalShort,
  description: optionalText,
  position: intSchema.default(0),
  active: checkboxSchema.default(true),
});

// ------------------------------------------------------------------ Contenu

export const homeSectionSchema = z.object({
  type: z.enum(HOME_SECTION_TYPES),
  title: optionalShort,
  subtitle: optionalShort,
  text: optionalText,
  buttonLabel: optionalShort,
  buttonUrl: optionalUrl,
  position: intSchema.default(0),
  active: checkboxSchema.default(true),
  productIds: z.string().optional(), // ids séparés par des virgules
  collectionIds: z.string().optional(),
  categoryIds: z.string().optional(),
  layout: z.string().optional(),
});

export const announcementSchema = z.object({
  text: z.string().trim().min(1).max(200),
  url: optionalUrl,
  position: intSchema.default(0),
  active: checkboxSchema.default(true),
});

export const pageSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().max(120).optional().or(z.literal("")),
  content: z.string().max(200000).default(""),
  seoTitle: optionalShort,
  seoDescription: optionalShort,
  showInFooter: checkboxSchema.default(true),
  position: intSchema.default(0),
  published: checkboxSchema.default(true),
});

export const menuItemSchema = z.object({
  menu: z.enum(["main", "footer"]).default("main"),
  label: z.string().trim().min(1).max(80),
  url: z.string().trim().min(1).max(500),
  parentId: optionalShort,
  position: intSchema.default(0),
  active: checkboxSchema.default(true),
});

export const settingsSchema = z.object({
  brandName: z.string().trim().min(1).max(100),
  tagline: z.string().trim().max(200).default(""),
  contactEmail: emailSchema,
  contactPhone: z.string().trim().max(50).default(""),
  address: z.string().trim().max(500).default(""),
  openingHours: z.string().trim().max(500).default(""),
  companyLegalName: z.string().trim().max(200).default(""),
  companyForm: z.string().trim().max(50).default(""),
  siret: z.string().trim().max(50).default(""),
  vatNumber: z.string().trim().max(50).default(""),
  shareCapital: z.string().trim().max(50).default(""),
  rcs: z.string().trim().max(100).default(""),
  vatRate: floatSchema.refine((v) => v !== null && v >= 0 && v <= 100, "Taux de TVA invalide."),
  shippingInfo: z.string().trim().max(2000).default(""),
  freeShippingThreshold: centsSchema,
  instagram: z.string().trim().max(300).default(""),
  facebook: z.string().trim().max(300).default(""),
  tiktok: z.string().trim().max(300).default(""),
  seoTitle: z.string().trim().max(200).default(""),
  seoDescription: z.string().trim().max(400).default(""),
  invoiceFooter: z.string().trim().max(1000).default(""),
});

export const shippingMethodSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: optionalShort,
  price: centsSchema.refine((v) => v !== null, "Le prix est obligatoire."),
  freeAbove: centsSchema,
  estimatedDays: optionalShort,
  countries: z.string().trim().max(500).default("FR"),
  position: intSchema.default(0),
  active: checkboxSchema.default(true),
});

// ------------------------------------------------------------------ Finances

export const expenseSchema = z.object({
  date: z.string().min(1, "La date est obligatoire."),
  label: z.string().trim().min(1, "Le libellé est obligatoire.").max(200),
  supplier: optionalShort,
  category: z.enum(EXPENSE_CATEGORIES).default("AUTRE"),
  amountHt: centsSchema.refine((v) => v !== null, "Le montant HT est obligatoire."),
  vatRate: floatSchema.refine((v) => v !== null && v >= 0 && v <= 100, "Taux de TVA invalide."),
  paymentMethod: optionalShort,
  invoiceNumber: optionalShort,
  notes: optionalText,
});

export const bankAccountSchema = z.object({
  label: z.string().trim().min(1, "Le libellé est obligatoire.").max(100),
  holderName: z.string().trim().min(1, "Le titulaire est obligatoire.").max(150),
  bankName: optionalShort,
  iban: z.string().trim().min(15, "IBAN invalide.").max(40),
  bic: z.string().trim().max(11).optional().or(z.literal("")),
  showOnInvoice: checkboxSchema.default(true),
  confirmPassword: z.string().min(1, "Confirmez votre mot de passe."),
});

// ------------------------------------------------------------------ Boutique

export const addressSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom obligatoire.").max(80),
  lastName: z.string().trim().min(1, "Nom obligatoire.").max(80),
  company: optionalShort,
  line1: z.string().trim().min(1, "Adresse obligatoire.").max(200),
  line2: optionalShort,
  postalCode: z.string().trim().min(3, "Code postal obligatoire.").max(20),
  city: z.string().trim().min(1, "Ville obligatoire.").max(100),
  country: z.string().trim().length(2).default("FR"),
  phone: optionalShort,
});

export const checkoutSchema = z.object({
  email: emailSchema,
  shipping: addressSchema,
  billingSame: checkboxSchema.default(true),
  billing: addressSchema.optional(),
  shippingMethodId: z.string().min(1, "Choisissez un mode de livraison."),
  paymentMethod: z.enum(["BANK_TRANSFER", "CARD"]),
  customerNote: optionalText,
  acceptTerms: checkboxSchema.refine((v) => v === true, "Vous devez accepter les conditions générales de vente."),
  createAccount: checkboxSchema.default(false),
  password: z.string().optional(),
});

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom obligatoire.").max(80),
  lastName: z.string().trim().min(1, "Nom obligatoire.").max(80),
  email: emailSchema,
  password: passwordSchema,
  newsletter: checkboxSchema.default(false),
});

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Votre nom est obligatoire.").max(120),
  email: emailSchema,
  subject: optionalShort,
  message: z.string().trim().min(10, "Votre message est trop court.").max(5000),
});

export function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") obj[key] = value;
  }
  return obj;
}

export function firstError(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? issue.message : "Données invalides.";
}
