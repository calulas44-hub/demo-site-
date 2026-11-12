// Affiche le code d'installation dans le « Deploy summary » en haut de la page du déploiement Netlify.
// Le code est écrit par scripts/bootstrap.mjs (fichier .setup-code, jamais versionné).
const { readFileSync, existsSync, rmSync } = require("node:fs");
const path = require("node:path");

module.exports = {
  onSuccess({ utils }) {
    const file = path.join(process.cwd(), ".setup-code");
    if (!existsSync(file)) return;
    const code = readFileSync(file, "utf8").trim();
    rmSync(file, { force: true });
    if (!code) return;
    utils.status.show({
      title: `Code d'installation : ${code}`,
      summary: `Ouvrez /admin de votre site et saisissez ce code pour créer votre compte administrateur. Il est valable jusqu'au prochain déploiement.`,
    });
  },
};
