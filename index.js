/***********************
 * SEGURANÇA DE ERROS *
 ***********************/
process.on("unhandledRejection", (err) => {
  console.log("⚠️ unhandledRejection:", err?.message || err);
});
process.on("uncaughtException", (err) => {
  console.log("⚠️ uncaughtException:", err?.message || err);
});

/***********************
 * DEPENDÊNCIAS
 ***********************/
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");

/***********************
 * MAPS GLOBAIS
 ***********************/
const lastVariantByTheme = new Map();
const lastGlobalThemeAt = new Map();
const lastUserThemeAt = new Map();

/***********************
 * TEMPOS
 ***********************/
const DELETE_WARNING_AFTER_MS = 4000;
const DELETE_NORMATIVE_AFTER_MS = 40000;
const GLOBAL_THEME_COOLDOWN_MS = 40000;
const USER_THEME_COOLDOWN_MS = 180000;

/***********************
 * UTIL
 ***********************/
function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasLink(textNorm) {
  const link
