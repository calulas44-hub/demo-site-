/**
 * Données de démonstration de Luxury Scent.
 * - Crée l'administrateur initial (ADMIN_EMAIL / ADMIN_PASSWORD) s'il n'existe pas.
 * - Crée les réglages, catégories, marques, collections, produits (avec images générées),
 *   sections d'accueil, pages, modes de livraison et un compte bancaire d'exemple.
 * Relançable : les éléments existants ne sont pas dupliqués.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, createCipheriv } from "node:crypto";

const prisma = new PrismaClient();
const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "./storage/uploads");

async function saveWebp(folder: string, buffer: Buffer, filename: string, meta: { filename: string; alt?: string }) {
  const dir = path.join(uploadRoot, folder);
  await mkdir(dir, { recursive: true });
  const out = await sharp(buffer).webp({ quality: 86 }).toBuffer();
  const info = await sharp(out).metadata();
  await writeFile(path.join(dir, filename), out);
  const url = `/uploads/${folder}/${filename}`;
  await prisma.media.upsert({
    where: { url },
    create: { url, filename: meta.filename, mimeType: "image/webp", size: out.length, width: info.width ?? null, height: info.height ?? null, alt: meta.alt ?? null, folder },
    update: {},
  });
  return url;
}

/** Image de flacon stylisée (SVG → WebP), couleur propre à chaque parfum. */
function bottleSvg(c1: string, c2: string, liquid: string, variant: 0 | 1, w = 1200, h = 1500) {
  const cap = variant === 0 ? `<rect x="${w / 2 - 70}" y="${h * 0.22}" width="140" height="120" rx="10" fill="#1f1b17"/>` : `<rect x="${w / 2 - 60}" y="${h * 0.2}" width="120" height="140" rx="60" fill="#d8c08a"/>`;
  const body =
    variant === 0
      ? `<rect x="${w / 2 - 210}" y="${h * 0.3}" width="420" height="640" rx="36" fill="${liquid}" opacity="0.92"/>`
      : `<rect x="${w / 2 - 180}" y="${h * 0.32}" width="360" height="620" rx="180" fill="${liquid}" opacity="0.92"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
    <linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="0.4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.12"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.95" r="0.6"><stop offset="0" stop-color="#000" stop-opacity="0.25"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  ${cap}
  <rect x="${w / 2 - 40}" y="${h * 0.3 - 30}" width="80" height="40" fill="#c9b17a"/>
  ${body}
  <rect x="${w / 2 - 210}" y="${h * 0.3}" width="420" height="640" rx="36" fill="url(#gl)"/>
  <rect x="${w / 2 - 120}" y="${h * 0.52}" width="240" height="150" fill="#fbf8f2" opacity="0.95"/>
  <rect x="${w / 2 - 90}" y="${h * 0.56}" width="180" height="6" fill="#1f1b17" opacity="0.8"/>
  <rect x="${w / 2 - 60}" y="${h * 0.60}" width="120" height="4" fill="#9a8a6a" opacity="0.8"/>
</svg>`);
}

function sceneSvg(c1: string, c2: string, w = 1800, h = 1200) {
  const dots = Array.from({ length: 40 }, (_, i) => {
    const x = (i * 467) % w;
    const y = (i * 311) % h;
    const r = 18 + ((i * 7) % 40);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${0.08 + ((i * 13) % 20) / 100}"/>`;
  }).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>${dots}</svg>`);
}

function encrypt(plain: string): string {
  const hex = process.env.BANK_ENCRYPTION_KEY ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("BANK_ENCRYPTION_KEY manquante ou invalide (openssl rand -hex 32).");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(hex, "hex"), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

async function main() {
  // ---------------------------------------------------------------- Administrateur
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@luxury-scent.local").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "change-me-now";
  const existingAdmin = await prisma.adminUser.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.adminUser.create({ data: { email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 12), name: "Propriétaire", role: "OWNER" } });
    console.log(`Administrateur créé : ${adminEmail}`);
  }

  // ---------------------------------------------------------------- Réglages
  const hasSettings = await prisma.setting.findUnique({ where: { key: "site" } });
  if (!hasSettings) {
    await prisma.setting.create({
      data: {
        key: "site",
        value: JSON.stringify({
          brandName: "Luxury Scent",
          tagline: "Parfumerie de luxe",
          contactEmail: "contact@luxury-scent.fr",
          contactPhone: "+33 1 00 00 00 00",
          address: "1 rue de la Paix\n75002 Paris\nFrance",
          vatRate: 20,
          freeShippingThreshold: 15000,
          seoTitle: "Luxury Scent — Parfumerie de luxe en ligne",
          seoDescription: "Luxury Scent sélectionne des parfums d'exception : eaux de parfum, extraits et coffrets, livrés avec soin.",
        }),
      },
    });
  }

  const already = await prisma.product.count();
  if (already > 0) {
    console.log("Catalogue déjà présent : seed des produits ignoré.");
  } else {
    // -------------------------------------------------------------- Images d'ambiance
    const heroUrl = await saveWebp("accueil", await sharp(path.join(__dirname, "seed-assets", "hero.jpg")).resize({ width: 2400, withoutEnlargement: true }).toBuffer(), "hero-hiver.webp", { filename: "hero.jpg", alt: "Flacons Luxury Scent dans la neige" });
    const editorialUrl = await saveWebp("accueil", await sharp(sceneSvg("#2b2420", "#8c6a36")).toBuffer(), "atelier.webp", { filename: "atelier.svg", alt: "Atelier" });

    // -------------------------------------------------------------- Catégories
    const parfums = await prisma.category.create({ data: { name: "Parfums", slug: "parfums", description: "Eaux de parfum, eaux de toilette et colognes.", position: 1, imageUrl: await saveWebp("categories", await sharp(sceneSvg("#e9dfcf", "#b89968", 1200, 1200)).toBuffer(), "parfums.webp", { filename: "parfums.svg" }) } });
    const femme = await prisma.category.create({ data: { name: "Femme", slug: "parfums-femme", parentId: parfums.id, position: 1 } });
    const homme = await prisma.category.create({ data: { name: "Homme", slug: "parfums-homme", parentId: parfums.id, position: 2 } });
    const mixte = await prisma.category.create({ data: { name: "Mixte", slug: "parfums-mixtes", parentId: parfums.id, position: 3 } });
    const extraits = await prisma.category.create({ data: { name: "Extraits & Élixirs", slug: "extraits-elixirs", description: "Les concentrations les plus intenses.", position: 2, imageUrl: await saveWebp("categories", await sharp(sceneSvg("#1f1b17", "#5a4631", 1200, 1200)).toBuffer(), "extraits.webp", { filename: "extraits.svg" }) } });
    const coffrets = await prisma.category.create({ data: { name: "Coffrets & Découverte", slug: "coffrets-decouverte", description: "Pour offrir ou pour essayer.", position: 3, imageUrl: await saveWebp("categories", await sharp(sceneSvg("#f3ece2", "#c9a96e", 1200, 1200)).toBuffer(), "coffrets.webp", { filename: "coffrets.svg" }) } });
    const bain = await prisma.category.create({ data: { name: "Bain & Corps", slug: "bain-corps", description: "Prolonger le sillage.", position: 4, imageUrl: await saveWebp("categories", await sharp(sceneSvg("#dfe6ea", "#8aa1ad", 1200, 1200)).toBuffer(), "bain.webp", { filename: "bain.svg" }) } });

    // -------------------------------------------------------------- Marques et collections
    const maison = await prisma.brand.create({ data: { name: "Luxury Scent", slug: "luxury-scent", description: "Les créations de la Maison.", position: 1 } });
    const aurore = await prisma.brand.create({ data: { name: "Aurore Lumière", slug: "aurore-lumiere", description: "Parfumeur de niche, Grasse.", position: 2 } });
    const nord = await prisma.brand.create({ data: { name: "Nord & Sel", slug: "nord-sel", description: "Colognes et eaux fraîches.", position: 3 } });

    const collectionDefs = [
      { name: "Neige d'Or", slug: "neige-d-or", tagline: "L'hiver, doré et enveloppant", description: "<p>Une collection née d'un matin de neige éclairé par le soleil : ambre, vanille et bois chauds, pour un sillage qui réchauffe.</p>", c: ["#f1e6d2", "#b08d57"] },
      { name: "Nuit Boréale", slug: "nuit-boreale", tagline: "Profonde, boisée, mystérieuse", description: "<p>Oud, cèdre et encens sous un ciel d'étoiles. La collection des grands soirs.</p>", c: ["#1c2230", "#4a3a30"] },
      { name: "Jardin d'Hiver", slug: "jardin-d-hiver", tagline: "Fleurs sous la givre", description: "<p>Rose, iris et violette, cueillis au cœur de l'hiver. Des floraux poudrés et lumineux.</p>", c: ["#f6eef0", "#b7899a"] },
      { name: "Rivage", slug: "rivage", tagline: "Lumière, sel et agrumes", description: "<p>Une parenthèse de fraîcheur : bergamote, sel marin et musc blanc.</p>", c: ["#e6eef2", "#6f8f9f"] },
    ];
    const collections: Record<string, { id: string }> = {};
    for (const [i, c] of collectionDefs.entries()) {
      const heroImageUrl = await saveWebp("collections", await sharp(sceneSvg(c.c[0], c.c[1])).toBuffer(), `${c.slug}-hero.webp`, { filename: `${c.slug}.svg` });
      const imageUrl = await saveWebp("collections", await sharp(sceneSvg(c.c[0], c.c[1], 1200, 1200)).toBuffer(), `${c.slug}.webp`, { filename: `${c.slug}.svg` });
      collections[c.slug] = await prisma.collection.create({ data: { name: c.name, slug: c.slug, tagline: c.tagline, description: c.description, heroImageUrl, imageUrl, position: i + 1 } });
    }

    // -------------------------------------------------------------- Produits
    type P = {
      name: string; slug: string; subtitle: string; brand: string; category: string; collection?: string; gender: "FEMME" | "HOMME" | "MIXTE";
      families: string; notesTop: string; notesHeart: string; notesBase: string; short: string; description: string; inspiration: string;
      featured?: boolean; isNew?: boolean; isLimited?: boolean; colors: [string, string, string];
      variants: { label: string; ml: number | null; price: number; sale?: number; cost: number; stock: number }[];
    };
    const products: P[] = [
      { name: "Neige d'Or", slug: "neige-d-or-eau-de-parfum", subtitle: "Eau de parfum", brand: maison.id, category: mixte.id, collection: "neige-d-or", gender: "MIXTE", families: "Ambrée, Vanillée, Boisée", notesTop: "Bergamote, Poivre rose, Safran", notesHeart: "Fleur d'oranger, Jasmin, Cannelle douce", notesBase: "Ambre, Vanille bourbon, Bois de santal", short: "L'ambre lumineux d'un matin de neige.", description: "<p>Neige d'Or ouvre sur une bergamote givrée relevée de safran, puis se réchauffe d'ambre et de vanille bourbon. Un sillage doré, enveloppant, pensé pour les journées froides et les soirées longues.</p>", inspiration: "<p>Un jardin sous la neige, traversé par un rayon de soleil. La chaleur qui naît du froid.</p>", featured: true, isNew: true, colors: ["#f4ead8", "#b08d57", "#d9b26a"], variants: [{ label: "30 ml", ml: 30, price: 9500, cost: 2600, stock: 18 }, { label: "50 ml", ml: 50, price: 13500, cost: 3600, stock: 24 }, { label: "100 ml", ml: 100, price: 19500, cost: 5200, stock: 9 }] },
      { name: "Neige d'Or", slug: "neige-d-or-extrait-de-parfum", subtitle: "Extrait de parfum", brand: maison.id, category: extraits.id, collection: "neige-d-or", gender: "MIXTE", families: "Ambrée, Vanillée, Résineuse", notesTop: "Safran, Cardamome", notesHeart: "Rose de Damas, Jasmin sambac", notesBase: "Ambre gris, Benjoin, Labdanum", short: "La version la plus intense de Neige d'Or.", description: "<p>Concentré à 30 %, l'extrait densifie l'ambre et prolonge la tenue jusqu'au lendemain. Deux vaporisations suffisent.</p>", inspiration: "<p>La nuit tombe sur la neige ; l'or devient braise.</p>", featured: true, colors: ["#efe2c8", "#6b4f2a", "#c9962e"], variants: [{ label: "50 ml", ml: 50, price: 24500, cost: 7200, stock: 7 }] },
      { name: "Ambre Impérial", slug: "ambre-imperial", subtitle: "Eau de parfum", brand: aurore.id, category: mixte.id, collection: "neige-d-or", gender: "MIXTE", families: "Ambrée, Épicée", notesTop: "Gingembre, Mandarine", notesHeart: "Encens, Rose", notesBase: "Ambre, Patchouli, Vanille", short: "Un ambre épicé, chaud et majestueux.", description: "<p>Aurore Lumière signe un ambre oriental où l'encens rencontre la mandarine. Puissant sans être écrasant.</p>", inspiration: "<p>Les salons dorés d'un palais d'hiver.</p>", colors: ["#e9d3b4", "#8a4b25", "#c47b3a"], variants: [{ label: "50 ml", ml: 50, price: 14500, cost: 4100, stock: 11 }, { label: "100 ml", ml: 100, price: 21000, cost: 5900, stock: 5 }] },
      { name: "Nuit Boréale", slug: "nuit-boreale-eau-de-parfum", subtitle: "Eau de parfum", brand: maison.id, category: homme.id, collection: "nuit-boreale", gender: "HOMME", families: "Boisée, Oud, Fumée", notesTop: "Baies de genièvre, Bergamote", notesHeart: "Oud, Cèdre de l'Atlas, Encens", notesBase: "Cuir, Vétiver, Musc", short: "Un oud profond sous un ciel d'étoiles.", description: "<p>Nuit Boréale associe un oud noble à des bois fumés et à une pointe de cuir. Une signature masculine, sombre et élégante.</p>", inspiration: "<p>Une forêt de pins sous les aurores.</p>", featured: true, colors: ["#1c2230", "#3a3028", "#2c3e55"], variants: [{ label: "50 ml", ml: 50, price: 15500, cost: 4300, stock: 14 }, { label: "100 ml", ml: 100, price: 22500, cost: 6200, stock: 6 }] },
      { name: "Cèdre Noir", slug: "cedre-noir", subtitle: "Eau de toilette", brand: nord.id, category: homme.id, collection: "nuit-boreale", gender: "HOMME", families: "Boisée, Aromatique", notesTop: "Pamplemousse, Romarin", notesHeart: "Cèdre, Sauge", notesBase: "Vétiver, Ambre gris", short: "Le bois sec et net d'une forêt du Nord.", description: "<p>Une eau de toilette vive et boisée, pensée pour tous les jours. Tenue de six à huit heures.</p>", inspiration: "<p>Une cabane de bois, l'hiver, au bord d'un fjord.</p>", colors: ["#d9d6cf", "#2f2b26", "#5a5247"], variants: [{ label: "50 ml", ml: 50, price: 8900, cost: 2500, stock: 20 }, { label: "100 ml", ml: 100, price: 12900, cost: 3600, stock: 12 }] },
      { name: "Rose Givrée", slug: "rose-givree", subtitle: "Eau de parfum", brand: maison.id, category: femme.id, collection: "jardin-d-hiver", gender: "FEMME", families: "Florale, Musquée", notesTop: "Litchi, Poivre rose", notesHeart: "Rose centifolia, Pivoine", notesBase: "Musc blanc, Bois blonds", short: "Une rose fraîche, cueillie sous la givre.", description: "<p>Rose Givrée joue la transparence : une rose de Grasse portée par des muscs propres et une pointe de litchi.</p>", inspiration: "<p>La première rose de l'année, encore couverte de givre.</p>", featured: true, colors: ["#f6eef0", "#b7899a", "#d8a6b4"], variants: [{ label: "30 ml", ml: 30, price: 8500, cost: 2300, stock: 15 }, { label: "50 ml", ml: 50, price: 12500, cost: 3300, stock: 19 }, { label: "100 ml", ml: 100, price: 17500, cost: 4600, stock: 8 }] },
      { name: "Iris Pâle", slug: "iris-pale-extrait", subtitle: "Extrait de parfum", brand: aurore.id, category: extraits.id, collection: "jardin-d-hiver", gender: "FEMME", families: "Poudrée, Florale", notesTop: "Violette, Mandarine", notesHeart: "Iris de Florence, Mimosa", notesBase: "Fève tonka, Santal", short: "Un iris poudré, précieux et feutré.", description: "<p>L'iris, matière la plus rare de la parfumerie, dans une concentration extrait. Doux, poudré, intemporel.</p>", inspiration: "<p>Un poudrier en nacre, la lumière d'un matin d'hiver.</p>", colors: ["#ece6ee", "#7d6f8f", "#b8a7c7"], variants: [{ label: "50 ml", ml: 50, price: 26500, cost: 8100, stock: 4 }] },
      { name: "Jardin d'Hiver", slug: "jardin-d-hiver-eau-de-parfum", subtitle: "Eau de parfum", brand: maison.id, category: femme.id, collection: "jardin-d-hiver", gender: "FEMME", families: "Florale, Verte", notesTop: "Feuille de violette, Poire", notesHeart: "Jasmin, Muguet, Violette", notesBase: "Mousse, Musc", short: "Des fleurs blanches sous une serre de verre.", description: "<p>Une composition verte et florale, lumineuse, où le muguet rencontre la feuille de violette.</p>", inspiration: "<p>Une serre, l'hiver : dehors la neige, dedans les fleurs.</p>", isNew: true, colors: ["#e8efe4", "#5f7f5a", "#9fbb97"], variants: [{ label: "50 ml", ml: 50, price: 12500, cost: 3300, stock: 16 }, { label: "100 ml", ml: 100, price: 17500, cost: 4600, stock: 7 }] },
      { name: "Rivage", slug: "rivage-eau-de-toilette", subtitle: "Eau de toilette", brand: maison.id, category: mixte.id, collection: "rivage", gender: "MIXTE", families: "Hespéridée, Aquatique", notesTop: "Bergamote, Citron de Menton, Sel marin", notesHeart: "Néroli, Jasmin", notesBase: "Musc blanc, Ambrette", short: "Lumière, sel et agrumes.", description: "<p>Rivage est une eau fraîche et saline, à vaporiser généreusement. Un parfum de peau propre et d'embruns.</p>", inspiration: "<p>Une plage d'hiver, vide, baignée de lumière.</p>", colors: ["#e6eef2", "#6f8f9f", "#9fbfcc"], variants: [{ label: "50 ml", ml: 50, price: 9900, sale: 8400, cost: 2700, stock: 22 }, { label: "100 ml", ml: 100, price: 14500, sale: 12300, cost: 3900, stock: 10 }] },
      { name: "Sel & Lumière", slug: "sel-et-lumiere-cologne", subtitle: "Cologne", brand: nord.id, category: mixte.id, collection: "rivage", gender: "MIXTE", families: "Hespéridée, Aromatique", notesTop: "Citron, Petit grain", notesHeart: "Lavande, Thym", notesBase: "Vétiver, Musc", short: "Une cologne classique, revisitée.", description: "<p>Une cologne vive, à la façon des grandes eaux fraîches, avec une tenue renforcée par le vétiver.</p>", inspiration: "<p>Les falaises, le vent, le sel.</p>", colors: ["#f3f1e6", "#8d9a6b", "#c5c98f"], variants: [{ label: "100 ml", ml: 100, price: 9500, cost: 2600, stock: 25 }, { label: "200 ml", ml: 200, price: 15500, cost: 4300, stock: 0 }] },
      { name: "Coffret Découverte", slug: "coffret-decouverte", subtitle: "5 parfums × 2 ml", brand: maison.id, category: coffrets.id, gender: "MIXTE", families: "Ambrée, Boisée, Florale, Hespéridée", notesTop: "", notesHeart: "", notesBase: "", short: "Cinq signatures de la Maison à essayer sur peau.", description: "<p>Neige d'Or, Nuit Boréale, Rose Givrée, Jardin d'Hiver et Rivage en format 2 ml. Le montant du coffret est déduit de votre premier flacon.</p>", inspiration: "", featured: true, colors: ["#f3ece2", "#c9a96e", "#e5d3a8"], variants: [{ label: "Coffret", ml: 10, price: 3500, cost: 900, stock: 40 }] },
      { name: "Lait parfumé Neige d'Or", slug: "lait-parfume-neige-d-or", subtitle: "Lait pour le corps", brand: maison.id, category: bain.id, collection: "neige-d-or", gender: "MIXTE", families: "Ambrée, Vanillée", notesTop: "", notesHeart: "", notesBase: "", short: "Prolonger le sillage de Neige d'Or.", description: "<p>Un lait hydratant parfumé à Neige d'Or, à appliquer avant le parfum pour en prolonger la tenue.</p>", inspiration: "", colors: ["#f8f2e8", "#d8c08a", "#efe0bf"], variants: [{ label: "200 ml", ml: 200, price: 6500, cost: 1800, stock: 30 }] },
      { name: "Bougie Nuit Boréale", slug: "bougie-nuit-boreale", subtitle: "Bougie parfumée", brand: maison.id, category: bain.id, collection: "nuit-boreale", gender: "MIXTE", families: "Boisée, Fumée", notesTop: "", notesHeart: "", notesBase: "", short: "L'odeur d'un feu de cèdre.", description: "<p>Cire végétale, mèche en coton, 50 heures de combustion.</p>", inspiration: "", isLimited: true, colors: ["#2a2622", "#6b4f3a", "#8c6a36"], variants: [{ label: "220 g", ml: null, price: 7500, cost: 2100, stock: 12 }] },
    ];

    for (const [i, p] of products.entries()) {
      const front = await saveWebp("produits", await sharp(bottleSvg(p.colors[0], p.colors[1], p.colors[2], 0)).toBuffer(), `${p.slug}-1.webp`, { filename: `${p.slug}-1.svg`, alt: `${p.name} — ${p.subtitle}` });
      const side = await saveWebp("produits", await sharp(bottleSvg(p.colors[1], p.colors[0], p.colors[2], 1)).toBuffer(), `${p.slug}-2.webp`, { filename: `${p.slug}-2.svg`, alt: `${p.name} — vue 2` });
      await prisma.product.create({
        data: {
          name: p.name,
          slug: p.slug,
          subtitle: p.subtitle,
          brandId: p.brand,
          categoryId: p.category,
          collectionId: p.collection ? collections[p.collection].id : null,
          gender: p.gender,
          families: p.families,
          notesTop: p.notesTop || null,
          notesHeart: p.notesHeart || null,
          notesBase: p.notesBase || null,
          shortDescription: p.short,
          description: p.description,
          inspiration: p.inspiration || null,
          status: "ACTIVE",
          featured: p.featured ?? false,
          isNew: p.isNew ?? false,
          isLimited: p.isLimited ?? false,
          position: i + 1,
          images: { create: [{ url: front, alt: `${p.name} — ${p.subtitle}`, position: 0, isPrimary: true }, { url: side, alt: `${p.name} — vue 2`, position: 1 }] },
          variants: {
            create: p.variants.map((v, j) => ({ label: v.label, volumeMl: v.ml, sku: `LS-${String(i + 1).padStart(3, "0")}-${String(j + 1)}`, price: v.price, salePrice: v.sale ?? null, costPrice: v.cost, stock: v.stock, position: j })),
          },
        },
      });
    }
    console.log(`${products.length} produits créés.`);

    // -------------------------------------------------------------- Page d'accueil
    const featuredIds = (await prisma.product.findMany({ where: { featured: true }, select: { id: true }, orderBy: { position: "asc" } })).map((p) => p.id);
    await prisma.homeSection.createMany({
      data: [
        { type: "HERO", title: "L'hiver a son parfum", subtitle: "Nouvelle collection Neige d'Or", text: "Ambre, vanille et bois chauds : un sillage qui réchauffe les jours froids.", imageUrl: heroUrl, buttonLabel: "Découvrir la collection", buttonUrl: "/collections/neige-d-or", position: 1, data: JSON.stringify({ align: "left", theme: "dark" }) },
        { type: "REASSURANCE", position: 2 },
        { type: "FEATURED_PRODUCTS", title: "Les signatures", subtitle: "Sélection", buttonLabel: "Voir tous les parfums", buttonUrl: "/parfums", position: 3, data: JSON.stringify({ productIds: featuredIds }) },
        { type: "COLLECTIONS", title: "Explorer les collections", position: 4 },
        { type: "EDITORIAL", title: "L'art de composer", subtitle: "La Maison", text: "Chaque création Luxury Scent naît d'un dialogue entre une matière première d'exception et une émotion. Nos parfums sont composés à Grasse, embouteillés à la main et expédiés dans un écrin.", imageUrl: editorialUrl, buttonLabel: "Notre histoire", buttonUrl: "/pages/notre-maison", position: 5, data: JSON.stringify({ imageSide: "right" }) },
        { type: "BANNER", title: "Le coffret découverte", text: "Cinq parfums en 2 ml, remboursé sur votre premier flacon.", imageUrl: await saveWebp("accueil", await sharp(sceneSvg("#f3ece2", "#c9a96e", 2400, 900)).toBuffer(), "banniere-coffret.webp", { filename: "banniere.svg" }), buttonLabel: "Commander le coffret", buttonUrl: "/produits/coffret-decouverte", position: 6 },
        { type: "CATEGORIES", title: "Par univers", position: 7 },
        { type: "NEWSLETTER", title: "Restez informé·e", text: "Nouveautés, éditions limitées et conseils, une fois par mois.", position: 8 },
      ],
    });

    await prisma.announcement.createMany({
      data: [
        { text: "Livraison offerte dès 150 € en France métropolitaine", position: 1 },
        { text: "Deux échantillons offerts pour toute commande", position: 2 },
        { text: "Coffret découverte : 35 €, déduits de votre premier flacon", url: "/produits/coffret-decouverte", position: 3 },
      ],
    });

    // -------------------------------------------------------------- Pages
    const pages = [
      { slug: "notre-maison", title: "Notre Maison", system: false, content: "<h2>Une parfumerie indépendante</h2><p>Luxury Scent est née d'une conviction : le luxe tient à la justesse des matières et à l'attention portée à chaque geste. Nous sélectionnons et composons des parfums d'exception, et nous les expédions comme on offre un cadeau.</p><h2>Nos engagements</h2><ul><li>Des matières premières tracées, en majorité naturelles.</li><li>Des flacons rechargeables et des étuis recyclables.</li><li>Un service client humain, joignable six jours sur sept.</li></ul>" },
      { slug: "livraison-et-retours", title: "Livraison et retours", system: true, content: "<h2>Livraison</h2><p>Les commandes sont préparées sous 24 à 48 h ouvrées et expédiées en colis suivi. La livraison est offerte en France métropolitaine dès 150 € d'achat.</p><h2>Retours</h2><p>Vous disposez de 14 jours à compter de la réception pour retourner un produit non ouvert, dans son emballage d'origine. Contactez-nous pour obtenir une étiquette de retour.</p>" },
      { slug: "conditions-generales-de-vente", title: "Conditions générales de vente", system: true, content: "<p><em>Texte à compléter par Luxury Scent et à faire valider par un conseil juridique.</em></p><h2>1. Objet</h2><p>Les présentes conditions régissent les ventes conclues sur le site Luxury Scent.</p><h2>2. Prix</h2><p>Les prix sont indiqués en euros, toutes taxes comprises, hors frais de livraison.</p><h2>3. Commande et paiement</h2><p>Le paiement s'effectue par carte bancaire (via un prestataire sécurisé) ou par virement. La commande est expédiée après encaissement.</p><h2>4. Droit de rétractation</h2><p>Conformément à la loi, vous disposez de 14 jours pour exercer votre droit de rétractation sur les produits non descellés.</p>" },
      { slug: "mentions-legales", title: "Mentions légales", system: true, content: "<p><em>À compléter avec les informations de votre société.</em></p><p><strong>Éditeur :</strong> Luxury Scent — forme juridique, capital, siège social, RCS, numéro de TVA.</p><p><strong>Directeur de la publication :</strong> —</p><p><strong>Hébergeur :</strong> —</p>" },
      { slug: "politique-de-confidentialite", title: "Politique de confidentialité", system: true, content: "<p>Les données collectées (identité, adresses, e-mail, historique de commandes) servent uniquement au traitement des commandes, au service client et, avec votre accord, à l'envoi de notre newsletter. Elles ne sont jamais vendues. Vous pouvez demander l'accès, la rectification ou la suppression de vos données en nous écrivant.</p>" },
      { slug: "faq", title: "Questions fréquentes", system: false, content: "<h3>Comment choisir ma contenance ?</h3><p>30 ml pour essayer, 50 ml pour adopter, 100 ml pour un parfum porté tous les jours.</p><h3>Puis-je essayer avant d'acheter ?</h3><p>Oui : le coffret découverte réunit cinq parfums en 2 ml, et son prix est déduit de votre premier flacon.</p><h3>Comment conserver mon parfum ?</h3><p>À l'abri de la lumière et de la chaleur, flacon fermé.</p>" },
    ];
    for (const [i, p] of pages.entries()) {
      await prisma.page.upsert({ where: { slug: p.slug }, create: { ...p, position: i + 1 }, update: {} });
    }

    // -------------------------------------------------------------- Livraison
    await prisma.shippingMethod.createMany({
      data: [
        { name: "Colissimo suivi", description: "Livraison à domicile en 2 à 3 jours ouvrés", price: 690, freeAbove: 15000, estimatedDays: "2 à 3 jours ouvrés", countries: "FR,MC", position: 1 },
        { name: "Chronopost express", description: "Livraison le lendemain avant 13 h", price: 1490, freeAbove: null, estimatedDays: "1 jour ouvré", countries: "FR", position: 2 },
        { name: "Livraison Europe", description: "Colis suivi en 4 à 6 jours ouvrés", price: 1490, freeAbove: 25000, estimatedDays: "4 à 6 jours ouvrés", countries: "BE,LU,DE,ES,IT,NL,PT,CH", position: 3 },
      ],
    });

    // -------------------------------------------------------------- Compte bancaire d'exemple (IBAN de test officiel, à remplacer)
    if ((await prisma.bankAccount.count()) === 0) {
      await prisma.bankAccount.create({
        data: { label: "EXEMPLE — à remplacer par votre compte", holderName: "LUXURY SCENT", bankName: "Banque exemple", ibanEncrypted: encrypt("FR7630006000011234567890189"), ibanLast4: "0189", bicEncrypted: encrypt("BNPAFRPP"), isActive: true, showOnInvoice: true },
      });
    }

    // -------------------------------------------------------------- Dépenses d'exemple
    const d = new Date();
    await prisma.expense.createMany({
      data: [
        { date: new Date(d.getFullYear(), d.getMonth(), 2), label: "Achat flacons et pompes", supplier: "Verrerie du Rhône", category: "ACHAT_MARCHANDISES", amountHt: 84000, vatRate: 20, vatAmount: 16800, amountTtc: 100800, paymentMethod: "Virement", invoiceNumber: "VR-2026-118" },
        { date: new Date(d.getFullYear(), d.getMonth(), 5), label: "Étuis et papier de soie", supplier: "Cartonnages Martin", category: "EMBALLAGE", amountHt: 21000, vatRate: 20, vatAmount: 4200, amountTtc: 25200, paymentMethod: "Carte", invoiceNumber: "CM-5521" },
        { date: new Date(d.getFullYear(), d.getMonth(), 9), label: "Campagne réseaux sociaux", supplier: "Agence Lumen", category: "MARKETING", amountHt: 45000, vatRate: 20, vatAmount: 9000, amountTtc: 54000, paymentMethod: "Virement", invoiceNumber: "LUM-0092" },
      ],
    });
  }

  console.log("Seed terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
