// Valeurs de référence partagées entre le site, l'administration et la base.

export const ADMIN_ROLES = ["OWNER", "ADMIN", "STAFF"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  STAFF: "Collaborateur",
};

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "En ligne",
  ARCHIVED: "Archivé",
};

export const GENDERS = ["FEMME", "HOMME", "MIXTE"] as const;
export const GENDER_LABELS: Record<(typeof GENDERS)[number], string> = {
  FEMME: "Femme",
  HOMME: "Homme",
  MIXTE: "Mixte",
};

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "En attente de paiement",
  PAID: "Payée",
  PREPARING: "En préparation",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

export const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"] as const;
export const PAYMENT_STATUS_LABELS: Record<(typeof PAYMENT_STATUSES)[number], string> = {
  PENDING: "En attente",
  PAID: "Payé",
  FAILED: "Échoué",
  REFUNDED: "Remboursé",
  PARTIALLY_REFUNDED: "Partiellement remboursé",
};

export const PAYMENT_METHODS = ["BANK_TRANSFER", "CARD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Virement bancaire",
  CARD: "Carte bancaire",
};

export const HOME_SECTION_TYPES = [
  "HERO",
  "BANNER",
  "FEATURED_PRODUCTS",
  "CATEGORIES",
  "COLLECTIONS",
  "EDITORIAL",
  "REASSURANCE",
  "NEWSLETTER",
] as const;
export type HomeSectionType = (typeof HOME_SECTION_TYPES)[number];
export const HOME_SECTION_LABELS: Record<HomeSectionType, string> = {
  HERO: "Bannière principale (couverture)",
  BANNER: "Bannière publicitaire",
  FEATURED_PRODUCTS: "Produits mis en avant",
  CATEGORIES: "Grille de catégories",
  COLLECTIONS: "Collections",
  EDITORIAL: "Bloc éditorial (image + texte)",
  REASSURANCE: "Réassurance (livraison, paiement…)",
  NEWSLETTER: "Inscription à la newsletter",
};

export const EXPENSE_CATEGORIES = [
  "ACHAT_MARCHANDISES",
  "EMBALLAGE",
  "LIVRAISON",
  "MARKETING",
  "LOGICIEL",
  "FRAIS_BANCAIRES",
  "LOYER",
  "AUTRE",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  ACHAT_MARCHANDISES: "Achats de marchandises",
  EMBALLAGE: "Emballages",
  LIVRAISON: "Frais de livraison",
  MARKETING: "Marketing et publicité",
  LOGICIEL: "Logiciels et abonnements",
  FRAIS_BANCAIRES: "Frais bancaires",
  LOYER: "Loyer et charges",
  AUTRE: "Autres frais",
};

// Comptes du plan comptable général (simplifié) utilisés par le journal interne.
export const ACCOUNTS = {
  CLIENTS: "411000",
  FOURNISSEURS: "401000",
  BANQUE: "512000",
  VENTES_MARCHANDISES: "707000",
  PORT_FACTURE: "708500",
  TVA_COLLECTEE: "445710",
  TVA_DEDUCTIBLE: "445660",
  ACHATS_MARCHANDISES: "607000",
  AUTRES_CHARGES: "618000",
  RABAIS_REMISES: "709000",
} as const;

export const EXPENSE_ACCOUNTS: Record<ExpenseCategory, string> = {
  ACHAT_MARCHANDISES: "607000",
  EMBALLAGE: "602600",
  LIVRAISON: "624100",
  MARKETING: "623000",
  LOGICIEL: "651000",
  FRAIS_BANCAIRES: "627000",
  LOYER: "613200",
  AUTRE: "618000",
};

export const COUNTRIES: { code: string; name: string }[] = [
  { code: "FR", name: "France" },
  { code: "BE", name: "Belgique" },
  { code: "LU", name: "Luxembourg" },
  { code: "CH", name: "Suisse" },
  { code: "DE", name: "Allemagne" },
  { code: "ES", name: "Espagne" },
  { code: "IT", name: "Italie" },
  { code: "NL", name: "Pays-Bas" },
  { code: "PT", name: "Portugal" },
  { code: "MC", name: "Monaco" },
];

export const ADMIN_COOKIE = "ls_admin";
export const CUSTOMER_COOKIE = "ls_customer";
export const CART_COOKIE = "ls_cart";
export const LAST_ORDER_COOKIE = "ls_last_order";
