// Copie les assets web (index.html, css/, js/, sync.config.js optionnel) dans www/ pour Capacitor.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";

const OUT = "www";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const path of ["index.html", "css", "js"]) cpSync(path, `${OUT}/${path}`, { recursive: true });
if (existsSync("sync.config.js")) cpSync("sync.config.js", `${OUT}/sync.config.js`);
console.log("www/ prêt");
