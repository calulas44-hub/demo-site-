/**
 * Tests de bout en bout : boutique, vente additionnelle, paiement, webhooks Stripe, administration, médias.
 *
 * Prérequis : serveur démarré sur APP_URL, base initialisée avec le catalogue de démonstration
 * (SEED_DEMO=1 npm run db:seed), compte propriétaire ADMIN_EMAIL / ADMIN_PASSWORD.
 * Les tests de webhook nécessitent STRIPE_WEBHOOK_SECRET (même valeur que le serveur testé).
 *
 * Usage : npm test                         (local)
 *         APP_URL=https://… npm test       (site déployé ; TEST_WEBHOOK=0 pour ignorer les webhooks)
 */
import { chromium, type Page, type BrowserContext } from "playwright";
import sharp from "sharp";
import Stripe from "stripe";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { computeUpsell } from "../src/lib/upsell";

try {
  process.loadEnvFile(".env");
} catch {
  /* .env facultatif */
}

const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const adminEmail = process.env.TEST_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? "";
const adminPassword = process.env.TEST_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const testWebhooks = process.env.TEST_WEBHOOK !== "0" && Boolean(webhookSecret);
const prisma = new PrismaClient();

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}
const euros = (s: string) => {
  const all = s.match(/\d[\d\s ]*,\d{2}/g) ?? ["0"];
  return Number(all[all.length - 1].replace(/[\s ]/g, "").replace(",", "."));
};

// ------------------------------------------------------------------ Calculs (sans navigateur)

function unit() {
  const s = { upsellEnabled: true, upsellRate: 10, upsellMaxPrice: 10000 };
  const ex = computeUpsell(
    [
      { variantId: "a", unitPrice: 15000, regularPrice: 15000, quantity: 1, upsellEligible: true },
      { variantId: "b", unitPrice: 8500, regularPrice: 8500, quantity: 1, upsellEligible: true },
    ],
    s,
  );
  check("calcul : 150 € + 85 € → remise 8,50 €, total 226,50 €", ex?.amount === 850 && ex.variantId === "b" && 15000 + 8500 - ex.amount === 22650);
  check("calcul : un seul parfum → pas de remise", computeUpsell([{ variantId: "a", unitPrice: 8500, regularPrice: 8500, quantity: 1, upsellEligible: true }], s) === null);
  check(
    "calcul : pas de cumul avec un prix promotionnel",
    computeUpsell(
      [
        { variantId: "a", unitPrice: 15000, regularPrice: 15000, quantity: 1, upsellEligible: true },
        { variantId: "b", unitPrice: 8400, regularPrice: 9900, quantity: 1, upsellEligible: true },
      ],
      s,
    ) === null,
  );
  check(
    "calcul : seuil de prix respecté (2 parfums > 100 €)",
    computeUpsell(
      [
        { variantId: "a", unitPrice: 15000, regularPrice: 15000, quantity: 1, upsellEligible: true },
        { variantId: "b", unitPrice: 12000, regularPrice: 12000, quantity: 1, upsellEligible: true },
      ],
      s,
    ) === null,
  );
  check("calcul : offre désactivée", computeUpsell([{ variantId: "a", unitPrice: 8500, regularPrice: 8500, quantity: 2, upsellEligible: true }], { ...s, upsellEnabled: false }) === null);
}

// ------------------------------------------------------------------ Boutique

async function addVariant(page: Page, slug: string, label: string) {
  await page.goto(`${base}/produits/${slug}`, { waitUntil: "networkidle" });
  const opt = page.locator(`label[for^="v-"]:has-text("${label}")`);
  if (await opt.count()) await opt.first().click();
  await page.click('button:has-text("Ajouter au panier")');
  await page.waitForSelector(".drawer.is-open .cart-line", { timeout: 20000 });
  await page.waitForTimeout(400);
}

async function cartTotal(page: Page): Promise<number> {
  await page.goto(`${base}/panier`, { waitUntil: "networkidle" });
  return euros(await page.locator(".cart-page .summary__row--total").innerText());
}

async function shop(page: Page, ctx: BrowserContext) {
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  const heroImg = page.locator(".hero img").first();
  check("accueil : couverture affichée", (await heroImg.count()) === 1 && (await heroImg.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)));

  await page.goto(`${base}/parfums?tri=price_asc`, { waitUntil: "networkidle" });
  const nums = (await page.locator(".grid .card__price").allInnerTexts()).map(euros);
  check("catalogue : tri par prix croissant", nums.length > 1 && nums.every((n, i) => i === 0 || n >= nums[i - 1]));
  await page.goto(`${base}/recherche?q=ROSE`, { waitUntil: "networkidle" });
  check("recherche : insensible à la casse", (await page.locator(".grid .card").count()) > 0);

  // Vente additionnelle
  await addVariant(page, "nuit-boreale-eau-de-parfum", "50 ml");
  check("panier : offre « 2e parfum » proposée", (await page.locator(".drawer.is-open .upsell .upsell__item").count()) > 0);
  await addVariant(page, "rose-givree", "30 ml");
  const discountText = await page.locator(".drawer.is-open .cart-total--discount").innerText().catch(() => "");
  check("panier : remise 2e parfum = 8,50 €", euros(discountText) === 8.5, discountText.replace(/\s+/g, " "));
  check("panier : total 150 + 85 − 8,50 = 226,50 €", (await cartTotal(page)) === 226.5);

  // Persistance (nouvel onglet, même navigateur)
  const p2 = await ctx.newPage();
  await p2.goto(`${base}/panier`, { waitUntil: "networkidle" });
  check("panier : conservé entre les visites", (await p2.locator(".cart-page .cart-line").count()) === 2);
  await p2.close();

  // Quantité : la remise ne s'applique qu'à une unité
  await page.goto(`${base}/panier`, { waitUntil: "networkidle" });
  const roseLine = page.locator(".cart-page .cart-line", { hasText: "Rose Givrée" });
  await roseLine.locator('button[aria-label="Augmenter"]').click();
  await page.waitForTimeout(1500);
  check("panier : quantité 2 → remise sur une seule unité (311,50 €)", euros(await page.locator(".cart-page .summary__row--total").innerText()) === 311.5);
  await roseLine.locator('button[aria-label="Diminuer"]').click();
  await page.waitForTimeout(1500);

  // Pas de cumul avec une promotion
  await roseLine.locator(".cart-remove").click();
  await page.waitForTimeout(1500);
  check("panier : retrait d'un article", (await page.locator(".cart-page .cart-line").count()) === 1);
  await addVariant(page, "rivage-eau-de-toilette", "50 ml");
  await page.goto(`${base}/panier`, { waitUntil: "networkidle" });
  check("panier : pas de double remise sur un article déjà en promotion", (await page.locator(".cart-page .summary__row--discount").count()) === 0);
  await page.locator(".cart-page .cart-line", { hasText: "Rivage" }).locator(".cart-remove").click();
  await page.waitForTimeout(1500);
  await addVariant(page, "rose-givree", "30 ml");

  // Paiement : virement « Bientôt disponible », carte via Stripe
  await page.goto(`${base}/commande`, { waitUntil: "networkidle" });
  const bank = page.locator('input[name="paymentMethod"][value="BANK_TRANSFER"]');
  check("paiement : virement désactivé « Bientôt disponible »", (await bank.isDisabled()) && (await page.locator(".tag-soon").count()) >= 1);
  check("paiement : récapitulatif avec remise", (await page.locator(".checkout .summary__row--discount").count()) === 1 && euros(await page.locator(".checkout .summary__row--total").innerText()) === 226.5);
}

async function fillCheckout(page: Page, email: string) {
  await page.fill("#email", email);
  await page.fill("#shipping-firstName", "Camille");
  await page.fill("#shipping-lastName", "Durand");
  await page.fill("#shipping-line1", "12 rue des Lilas");
  await page.fill("#shipping-postalCode", "69001");
  await page.fill("#shipping-city", "Lyon");
  await page.check('input[name="acceptTerms"]');
}

// ------------------------------------------------------------------ Administration

async function login(page: Page) {
  await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
  check("admin : accès protégé (redirection connexion)", page.url().includes("/admin/login"));
  await page.fill("#email", adminEmail);
  await page.fill("#password", adminPassword);
  await page.click("button[type=submit]");
  await page.waitForURL(`${base}/admin`, { timeout: 90000 });
  check("admin : connexion", true);
}

async function setBankTransfer(page: Page, on: boolean) {
  await page.goto(`${base}/admin/promotions`, { waitUntil: "networkidle" });
  const box = page.locator('input[name="bankTransferEnabled"]');
  if ((await box.isChecked()) !== on) await box.click();
  await page.click('button:has-text("Enregistrer")');
  await page.waitForSelector(".msg--ok", { timeout: 20000 });
}

async function adminFlows(page: Page, anon: BrowserContext) {
  // Promotions : activer le virement pour tester une commande complète
  await setBankTransfer(page, true);
  check("admin : réglages promotions enregistrés", true);

  await page.goto(`${base}/commande`, { waitUntil: "networkidle" });
  const email = `test-${Date.now()}@example.com`;
  await fillCheckout(page, email);
  await page.check('input[name="paymentMethod"][value="BANK_TRANSFER"]');
  await page.click('button:has-text("Confirmer la commande"), button:has-text("Payer la commande")');
  await page.waitForURL(/\/commande\/confirmation\//, { timeout: 60000 });
  const number = decodeURIComponent(page.url().split("/").pop()!.split("?")[0]);
  check("commande : numéro unique", /^LS-\d{4}-\d{5}$/.test(number), number);
  const order = await prisma.order.findUnique({ where: { number }, include: { items: true } });
  check("commande : enregistrée avec remise 8,50 € et total 226,50 €", order?.discount === 850 && order.total === 22650 + order.shippingPrice, `remise ${order?.discount} total ${order?.total}`);
  check("commande : e-mail de confirmation journalisé", (await prisma.emailLog.count({ where: { to: email } })) >= 1);

  await page.goto(`${base}/suivi?n=${encodeURIComponent(number)}&e=${encodeURIComponent(email)}`, { waitUntil: "networkidle" });
  check("suivi : commande retrouvée sans compte", (await page.locator(".confirmation__box").count()) === 1);

  // Webhooks Stripe (signature, montant, paiement, expiration)
  if (testWebhooks && order) {
    const send = async (event: object, secret = webhookSecret) => {
      const payload = JSON.stringify(event);
      const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
      return page.request.post(`${base}/api/stripe/webhook`, { data: payload, headers: { "stripe-signature": header, "content-type": "application/json" } });
    };
    const session = (o: { id: string; number: string }, amount: number, type: string) => ({
      id: `evt_test_${Date.now()}`,
      object: "event",
      type,
      data: { object: { id: `cs_test_${o.id}`, object: "checkout.session", payment_status: type.endsWith("completed") ? "paid" : "unpaid", amount_total: amount, currency: "eur", payment_intent: `pi_test_${o.id}`, client_reference_id: o.id, metadata: { orderId: o.id, orderNumber: o.number } } },
    });
    const bad = await send(session(order, order.total, "checkout.session.completed"), "whsec_wrong");
    check("webhook : signature invalide refusée (400)", bad.status() === 400);
    await send(session(order, order.total - 100, "checkout.session.completed"));
    check("webhook : montant incohérent → non marquée payée", (await prisma.order.findUnique({ where: { id: order.id } }))?.paymentStatus === "PENDING");
    const ok = await send(session(order, order.total, "checkout.session.completed"));
    const paid = await prisma.order.findUnique({ where: { id: order.id }, include: { invoice: true } });
    check("webhook : paiement confirmé → commande payée + facture", ok.status() === 200 && paid?.paymentStatus === "PAID" && Boolean(paid.invoice));
    check("webhook : e-mail « paiement reçu » journalisé", (await prisma.emailLog.count({ where: { to: email } })) >= 2);
  } else {
    console.log("…   webhooks : ignorés (STRIPE_WEBHOOK_SECRET absent ou TEST_WEBHOOK=0)");
  }

  // Commande non payée puis expirée → annulation et remise en stock
  if (testWebhooks) {
    await addVariant(page, "cedre-noir", "50 ml");
    const before = (await prisma.productVariant.findFirst({ where: { product: { slug: "cedre-noir" }, label: "50 ml" } }))!.stock;
    await page.goto(`${base}/commande`, { waitUntil: "networkidle" });
    await fillCheckout(page, `exp-${Date.now()}@example.com`);
    await page.check('input[name="paymentMethod"][value="BANK_TRANSFER"]');
    await page.click('button:has-text("Confirmer la commande"), button:has-text("Payer la commande")');
    await page.waitForURL(/\/commande\/confirmation\//, { timeout: 60000 });
    const n2 = decodeURIComponent(page.url().split("/").pop()!.split("?")[0]);
    const o2 = (await prisma.order.findUnique({ where: { number: n2 } }))!;
    const reserved = (await prisma.productVariant.findFirst({ where: { product: { slug: "cedre-noir" }, label: "50 ml" } }))!.stock;
    const payload = JSON.stringify({ id: "evt_exp", object: "event", type: "checkout.session.expired", data: { object: { id: `cs_${o2.id}`, object: "checkout.session", payment_status: "unpaid", amount_total: o2.total, currency: "eur", client_reference_id: o2.id, metadata: { orderId: o2.id } } } });
    await page.request.post(`${base}/api/stripe/webhook`, { data: payload, headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret }), "content-type": "application/json" } });
    const after = (await prisma.productVariant.findFirst({ where: { product: { slug: "cedre-noir" }, label: "50 ml" } }))!.stock;
    const o2b = await prisma.order.findUnique({ where: { id: o2.id } });
    check("webhook : session expirée → commande annulée et stock libéré", reserved === before - 1 && after === before && o2b?.status === "CANCELLED");
  }

  // Paiement carte : si Stripe refuse (clé invalide en local), la commande est annulée et le panier conservé
  if (process.env.STRIPE_SECRET_KEY?.includes("dummy")) {
    await addVariant(page, "cedre-noir", "50 ml");
    await page.goto(`${base}/commande`, { waitUntil: "networkidle" });
    await fillCheckout(page, `card-${Date.now()}@example.com`);
    await page.check('input[name="paymentMethod"][value="CARD"]');
    await page.click('button:has-text("Payer la commande")');
    await page.waitForSelector(".alert--error", { timeout: 60000 });
    await page.goto(`${base}/panier`, { waitUntil: "networkidle" });
    check("carte : erreur Stripe gérée, panier conservé", (await page.locator(".cart-page .cart-line").count()) === 1);
    await page.locator(".cart-page .cart-remove").first().click();
    await page.waitForTimeout(1000);
  }
  await setBankTransfer(page, false);

  // Commande en admin : détail, statut, facture PDF
  await page.goto(`${base}/admin/commandes?q=${encodeURIComponent(number)}`, { waitUntil: "networkidle" });
  await Promise.all([page.waitForURL(/\/admin\/commandes\/[a-z0-9]+$/, { timeout: 30000 }), page.click(".tbl a.row-link")]);
  await page.waitForLoadState("networkidle");
  check("admin commande : remise visible", (await page.locator("td", { hasText: "2e parfum" }).count()) >= 1);
  if (!testWebhooks) {
    await page.selectOption("select[name=status]", "PAID");
    await page.click('button:has-text("Appliquer")');
    await page.waitForTimeout(2500);
  }
  await page.selectOption("select[name=status]", "SHIPPED");
  const carrier = page.locator('input[name="carrier"]').first();
  if (await carrier.count()) await carrier.fill("Transporteur test");
  const tracking = page.locator('input[name="trackingNumber"]').first();
  if (await tracking.count()) await tracking.fill("TRK123");
  await page.click('button:has-text("Appliquer")');
  await page.waitForTimeout(2500);
  check("admin commande : expédiée avec suivi", (await prisma.order.findUnique({ where: { number } }))?.status === "SHIPPED");
  const invoice = await page.locator('a:has-text("Facture")').first().getAttribute("href");
  const pdf = invoice ? await page.request.get(base + invoice) : null;
  check("facture : PDF généré", Boolean(pdf && pdf.status() === 200 && (await pdf.body()).subarray(0, 4).toString() === "%PDF"));

  await page.goto(`${base}/admin/clients?q=${encodeURIComponent(email)}`, { waitUntil: "networkidle" });
  check("admin clients : client et historique", (await page.locator(".tbl tbody tr").count()) >= 1);

  // Produit : création en brouillon, médias (photo + vidéo), aperçu, publication
  await page.goto(`${base}/admin/produits/nouveau`, { waitUntil: "networkidle" });
  const name = `Produit test ${Date.now()}`;
  await page.fill("#name", name);
  await page.fill('input[name="variants[0][label]"]', "50 ml");
  await page.fill('input[name="variants[0][price]"]', "99");
  await page.fill('input[name="variants[0][stock]"]', "3");
  await page.fill("#commercialLabel", "Exclusivité web");
  await page.selectOption("#status", "DRAFT");
  await page.click('button:has-text("Créer le produit")');
  await page.waitForURL(/\/admin\/produits\/[a-z0-9]+\?ok=1/, { timeout: 60000 });
  const editUrl = page.url().split("?")[0];
  const jpg = await sharp({ create: { width: 1600, height: 2000, channels: 3, background: { r: 200, g: 170, b: 120 } } }).jpeg().toBuffer();
  const files: { name: string; mimeType: string; buffer: Buffer }[] = [{ name: "photo.jpg", mimeType: "image/jpeg", buffer: jpg }];
  let withVideo = false;
  try {
    const dir = mkdtempSync(path.join(tmpdir(), "ls-"));
    const mp4 = path.join(dir, "clip.mp4");
    // Vidéo de ~6 Mo : envoyée en plusieurs morceaux (limite Netlify de 6 Mo par requête).
    execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=s=1280x720:d=3", "-b:v", "16M", "-maxrate", "16M", "-bufsize", "16M", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
    files.push({ name: "clip.mp4", mimeType: "video/mp4", buffer: readFileSync(mp4) });
    withVideo = true;
  } catch {
    console.log("…   vidéo : ffmpeg indisponible, envoi vidéo non testé");
  }
  await page.setInputFiles('[data-testid="upload-product-media"]', files);
  await page.waitForSelector(".msg--ok", { timeout: 90000 });
  await page.waitForTimeout(1500);
  check("médias : photo envoyée (compressée en WebP)", (await page.locator(".thumb-card img[src$='.webp']").count()) === 1);
  if (withVideo) {
    check("médias : vidéo envoyée en plusieurs morceaux", (await page.locator(".thumb-card video").count()) === 1, `${Math.round(files[1].buffer.length / 1024 / 1024 * 10) / 10} Mo`);
    const vurl = await page.locator(".thumb-card video").first().getAttribute("src");
    const partial = vurl ? await page.request.get(base + vurl.split("#")[0], { headers: { Range: "bytes=0-99" } }) : null;
    check("médias : lecture vidéo par plages (Safari/iOS)", partial?.status() === 206 && (await partial.body()).length === 100);
  }
  const imgUrl = await page.locator(".thumb-card img").first().getAttribute("src");
  const media = imgUrl ? await page.request.get(imgUrl.startsWith("http") ? imgUrl : base + imgUrl) : null;
  check("médias : fichier servi par le stockage", media?.status() === 200 && (media.headers()["content-type"] ?? "").includes("webp"), imgUrl ?? "");

  const slug = (await page.locator("#slug").inputValue()) || "";
  const anonPage = await anon.newPage();
  const hidden = await anonPage.goto(`${base}/produits/${slug}?apercu=1`);
  check("aperçu : brouillon invisible pour un visiteur", hidden?.status() === 404);
  await page.goto(`${base}/produits/${slug}?apercu=1`, { waitUntil: "networkidle" });
  check("aperçu : brouillon visible pour l'administrateur", (await page.locator(".preview-banner").count()) === 1 && (await page.locator(".pdp__label").innerText()).toLowerCase().includes("exclusivité"));
  await page.goto(editUrl, { waitUntil: "networkidle" });
  await page.selectOption("#status", "ACTIVE");
  await page.click('button:has-text("Enregistrer")');
  await page.waitForTimeout(3000);
  const pub = await anonPage.goto(`${base}/produits/${slug}`, { waitUntil: "networkidle" });
  check("produit : publié et visible", pub?.status() === 200 && (await anonPage.locator(".pdp__title").innerText()) === name);
  if (withVideo) check("produit : vidéo dans la galerie", (await anonPage.locator(".gallery--desktop video").count()) === 1);

  // Suppression d'un média : retiré de la fiche et du stockage
  await page.goto(editUrl, { waitUntil: "networkidle" });
  page.once("dialog", (d) => d.accept());
  await page.locator(".thumb-card").first().locator('button[value="delete"]').click();
  await page.waitForTimeout(2500);
  const gone = imgUrl ? await page.request.get(`${imgUrl.startsWith("http") ? imgUrl : base + imgUrl}?v=${Date.now()}`) : null;
  check("médias : suppression (fichier retiré du stockage)", (await page.locator(".thumb-card").count()) === (withVideo ? 1 : 0) && gone?.status() !== 200);

  // Couverture remplaçable depuis l'admin
  await page.goto(`${base}/admin/accueil`, { waitUntil: "networkidle" });
  await page.locator(".section-row", { hasText: "Bannière" }).first().locator("a.row-link").click().catch(async () => {
    await page.locator(".section-row a.row-link").first().click();
  });
  await page.waitForLoadState("networkidle");
  const cover = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: { r: 30, g: 40, b: 60 } } }).jpeg().toBuffer();
  await page.setInputFiles('[data-testid="upload-imageUrl"]', { name: "nouvelle-couverture.jpg", mimeType: "image/jpeg", buffer: cover });
  await page.waitForFunction(() => (document.querySelector('input[name="imageUrl"]') as HTMLInputElement | null)?.value.endsWith(".webp"), null, { timeout: 60000 });
  const newCover = await page.locator('input[name="imageUrl"]').inputValue();
  await page.click('button:has-text("Enregistrer")');
  await page.waitForURL(/\/admin\/accueil\?ok=1/, { timeout: 60000 });
  await anonPage.goto(`${base}/`, { waitUntil: "networkidle" });
  check("couverture : remplacée depuis l'admin", (await anonPage.locator(".hero img").first().getAttribute("src")) === newCover);

  // Comptabilité
  const x = await page.request.get(`${base}/admin/comptabilite/export?format=xlsx&periode=year`);
  check("comptabilité : export Excel", x.status() === 200 && (await x.body()).subarray(0, 2).toString() === "PK");
  await page.goto(`${base}/admin/comptabilite/journal?periode=year`, { waitUntil: "networkidle" });
  check("comptabilité : journal équilibré", !(await page.locator(".adm-head p").innerText()).includes("Déséquilibre"));

  // Sécurité : routes serveur protégées
  const put = await anonPage.request.put(`${base}/api/admin/upload?bucket=media&path=x/y.webp&type=image/webp&expires=0&sig=x&part=0`, { data: "x", headers: { "content-type": "application/octet-stream" } });
  check("sécurité : envoi de fichier refusé sans session admin", [401, 403, 404].includes(put.status()), String(put.status()));
  const priv = await anonPage.request.get(`${base}/api/admin/private-file?path=justificatifs/x.pdf`);
  check("sécurité : justificatifs privés refusés sans session", priv.status() === 401);
  await anonPage.goto(`${base}/admin/promotions`);
  check("sécurité : pages admin redirigées vers la connexion", anonPage.url().includes("/admin/login"));
  await anonPage.close();
  return { slug };
}

(async () => {
  unit();
  if (!adminEmail || !adminPassword) {
    check("identifiants admin de test fournis (ADMIN_EMAIL / ADMIN_PASSWORD ou TEST_ADMIN_*)", false);
  }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const anon = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${page.url().replace(base, "")} : ${e.message.slice(0, 120)}`));
  try {
    await shop(page, ctx);
    await login(page);
    await adminFlows(page, anon);
    const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await m.goto(`${base}/`, { waitUntil: "networkidle" });
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check("mobile : pas de débordement horizontal", overflow <= 1, `${overflow}px`);
    await m.close();
  } catch (e) {
    check("exécution sans exception", false, e instanceof Error ? e.message : String(e));
  }
  check("aucune erreur JavaScript navigateur", errors.length === 0, errors.join(" | "));
  await browser.close();
  await prisma.$disconnect();
  console.log(failures ? `\n${failures} test(s) en échec` : "\nTous les tests passent");
  process.exit(failures ? 1 : 0);
})();

