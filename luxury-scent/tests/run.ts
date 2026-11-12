/**
 * Tests fonctionnels de bout en bout (boutique + administration).
 * Prérequis : serveur démarré sur APP_URL (par défaut http://localhost:3000),
 * base initialisée (`npm run db:push && npm run db:seed`), Playwright installé.
 * Usage : npm test
 */
import { chromium, type Page } from "playwright";
import sharp from "sharp";

const base = process.env.APP_URL ?? "http://localhost:3000";
const adminEmail = process.env.ADMIN_EMAIL ?? "admin@luxury-scent.local";
const adminPassword = process.env.ADMIN_PASSWORD ?? "change-me-now";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

async function shop(page: Page) {
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  check("accueil : bannière et sections", (await page.locator(".hero, .section").count()) > 0);

  await page.goto(`${base}/parfums?tri=price_asc`, { waitUntil: "networkidle" });
  const prices = await page.locator(".grid .card__price").allInnerTexts();
  const nums = prices.map((p) => Number(p.replace(/[^\d,]/g, "").replace(",", ".")));
  check("catalogue : tri par prix croissant", nums.every((n, i) => i === 0 || n >= nums[i - 1]), prices.slice(0, 4).join(" | "));

  await page.goto(`${base}/recherche?q=rose`, { waitUntil: "networkidle" });
  check("recherche : résultats pour « rose »", (await page.locator(".grid .card").count()) > 0);

  await page.goto(`${base}/produits/neige-d-or-eau-de-parfum`, { waitUntil: "networkidle" });
  await page.click('label[for^="v-"]:has-text("50 ml")');
  check("fiche : prix de la contenance 50 ml", (await page.locator(".pdp__price span").innerText()).includes("135"));
  await page.click('button:has-text("Ajouter au panier")');
  await page.waitForSelector(".drawer.is-open .cart-line", { timeout: 15000 });
  check("panier : tiroir ouvert avec 1 ligne", (await page.locator(".drawer.is-open .cart-line").count()) === 1);

  await page.goto(`${base}/commande`, { waitUntil: "networkidle" });
  const email = `test-${Date.now()}@example.com`;
  await page.fill("#email", email);
  await page.fill("#shipping-firstName", "Camille");
  await page.fill("#shipping-lastName", "Durand");
  await page.fill("#shipping-line1", "12 rue des Lilas");
  await page.fill("#shipping-postalCode", "69001");
  await page.fill("#shipping-city", "Lyon");
  await page.check('input[name="paymentMethod"][value="BANK_TRANSFER"]');
  await page.check('input[name="acceptTerms"]');
  await page.click('button:has-text("Confirmer la commande")');
  await page.waitForURL(/\/commande\/confirmation\//, { timeout: 60000 });
  const number = decodeURIComponent(page.url().split("/").pop()!.split("?")[0]);
  check("commande : confirmation affichée", /^LS-\d{4}-\d{5}$/.test(number), number);
  check("commande : IBAN affiché pour le virement", (await page.locator(".bank-box").count()) === 1);

  await page.goto(`${base}/suivi?n=${encodeURIComponent(number)}&e=${encodeURIComponent(email)}`, { waitUntil: "networkidle" });
  check("suivi : commande retrouvée sans compte", (await page.locator(".confirmation__box").count()) === 1);
  return { number, email };
}

async function admin(page: Page, orderNumber: string) {
  await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
  check("admin : accès protégé", page.url().includes("/admin/login"));
  await page.fill("#email", adminEmail);
  await page.fill("#password", adminPassword);
  await page.click("button[type=submit]");
  await page.waitForURL(`${base}/admin`, { timeout: 90000 });
  check("admin : connexion", true);

  await page.goto(`${base}/admin/commandes?q=${encodeURIComponent(orderNumber)}`, { waitUntil: "networkidle" });
  await page.click(".tbl a.row-link");
  await page.waitForLoadState("networkidle");
  await page.selectOption("select[name=status]", "PAID");
  await page.click('button:has-text("Appliquer")');
  await page.waitForTimeout(2500);
  check("commande : passage en payée", (await page.locator(".adm-head .pill").first().innerText()).toUpperCase().includes("PAY"));
  const invoice = await page.locator('a:has-text("Facture")').first().getAttribute("href");
  const pdf = invoice ? await page.request.get(base + invoice) : null;
  check("facture : PDF généré", Boolean(pdf && pdf.status() === 200 && (await pdf.body()).subarray(0, 4).toString() === "%PDF"));

  await page.goto(`${base}/admin/produits/nouveau`, { waitUntil: "networkidle" });
  const name = `Produit test ${Date.now()}`;
  await page.fill("#name", name);
  await page.fill('input[name="variants[0][label]"]', "50 ml");
  await page.fill('input[name="variants[0][price]"]', "99");
  await page.fill('input[name="variants[0][stock]"]', "3");
  await page.selectOption("#status", "ACTIVE");
  await page.click('button:has-text("Créer le produit")');
  await page.waitForURL(/\/admin\/produits\/[a-z0-9]+\?ok=1/, { timeout: 60000 });
  const buf = await sharp({ create: { width: 600, height: 750, channels: 3, background: { r: 200, g: 170, b: 120 } } }).jpeg().toBuffer();
  await page.setInputFiles("#images", { name: "test.jpg", mimeType: "image/jpeg", buffer: buf });
  await page.click('button:has-text("Téléverser")');
  await page.waitForTimeout(3000);
  check("produit : image téléversée", (await page.locator(".thumb-card").count()) === 1);
  const slug = (await page.locator("#slug").inputValue()) || "";
  const pub = await page.goto(`${base}/produits/${slug}`, { waitUntil: "networkidle" });
  check("produit : visible sur le site public", pub?.status() === 200 && (await page.locator(".pdp__title").innerText()) === name);

  const x = await page.request.get(`${base}/admin/comptabilite/export?format=xlsx&periode=year`);
  check("comptabilité : export Excel", x.status() === 200 && (await x.body()).subarray(0, 2).toString() === "PK");
  await page.goto(`${base}/admin/comptabilite/journal?periode=year`, { waitUntil: "networkidle" });
  check("comptabilité : journal équilibré", !(await page.locator(".adm-head p").innerText()).includes("Déséquilibre"));
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    const { number } = await shop(page);
    await admin(page, number);
  } catch (e) {
    check("exécution sans exception", false, e instanceof Error ? e.message : String(e));
  }
  check("aucune erreur JavaScript navigateur", errors.length === 0, errors.join(" | "));
  await browser.close();
  console.log(failures ? `\n${failures} test(s) en échec` : "\nTous les tests passent");
  process.exit(failures ? 1 : 0);
})();
