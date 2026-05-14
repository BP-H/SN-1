import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const catalogPath = join(repoRoot, "content", "i18n", "messages.js");
const source = readFileSync(catalogPath, "utf8");

function loadCatalog() {
  const executable = source
    .replace(/export const SUPPORTED_LOCALES\s*=/, "const SUPPORTED_LOCALES =")
    .replace(/export const DEFAULT_LOCALE\s*=/, "const DEFAULT_LOCALE =")
    .replace(/export const LOCALE_STORAGE_KEY\s*=/, "const LOCALE_STORAGE_KEY =")
    .replace(/export const LOCALE_COOKIE_NAME\s*=/, "const LOCALE_COOKIE_NAME =")
    .replace(/export const messages\s*=/, "const messages =");

  // messages.js is a static data module, so this avoids a build step while keeping
  // the script dependency-free for local/CI smoke use.
  return Function(
    `${executable}\nreturn { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_STORAGE_KEY, LOCALE_COOKIE_NAME, messages };`
  )();
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectLeaves(node, prefix = "") {
  if (!isObject(node)) return [[prefix, node]];
  return Object.entries(node).flatMap(([key, value]) => collectLeaves(value, prefix ? `${prefix}.${key}` : key));
}

function collectKeys(node, prefix = "") {
  if (!isObject(node)) return [prefix];
  return Object.entries(node).flatMap(([key, value]) => collectKeys(value, prefix ? `${prefix}.${key}` : key));
}

function placeholders(value) {
  const matches = String(value || "").matchAll(/\{(\w+)\}/g);
  return [...new Set([...matches].map((match) => match[1]))].sort();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const { SUPPORTED_LOCALES, DEFAULT_LOCALE, messages } = loadCatalog();
const supportedCodes = SUPPORTED_LOCALES.map((locale) => locale.code);
const expectedCodes = ["ko", "en", "es"];

assert(DEFAULT_LOCALE === "en", `Expected DEFAULT_LOCALE to be en, got ${DEFAULT_LOCALE}`);
assert(
  JSON.stringify(supportedCodes) === JSON.stringify(expectedCodes),
  `Expected supported locales ${expectedCodes.join(", ")}, got ${supportedCodes.join(", ")}`
);
assert(!Object.hasOwn(messages, "tr"), "Stale Turkish catalog key must not remain in messages.");

for (const code of supportedCodes) {
  assert(isObject(messages[code]), `Missing message catalog for supported locale ${code}`);
}

const unsupportedCatalogs = Object.keys(messages).filter((code) => !supportedCodes.includes(code));
assert(unsupportedCatalogs.length === 0, `Unsupported message catalogs: ${unsupportedCatalogs.join(", ")}`);

const defaultKeys = collectKeys(messages[DEFAULT_LOCALE]).sort();
const defaultLeafMap = Object.fromEntries(collectLeaves(messages[DEFAULT_LOCALE]));

for (const code of supportedCodes) {
  const catalog = messages[code];
  const keys = collectKeys(catalog).sort();
  const missingKeys = defaultKeys.filter((key) => !keys.includes(key));
  assert(missingKeys.length === 0, `${code} is missing i18n keys: ${missingKeys.join(", ")}`);

  for (const [key, value] of collectLeaves(catalog)) {
    assert(typeof value === "string", `${code}.${key} must be a string leaf`);
    assert(value.trim(), `${code}.${key} must not be empty`);

    const expectedPlaceholders = placeholders(defaultLeafMap[key]);
    const actualPlaceholders = placeholders(value);
    assert(
      JSON.stringify(actualPlaceholders) === JSON.stringify(expectedPlaceholders),
      `${code}.${key} placeholders ${actualPlaceholders.join(", ")} do not match default ${expectedPlaceholders.join(", ")}`
    );
  }
}

console.log(`PASS i18n catalog integrity: ${supportedCodes.join(", ")}`);
