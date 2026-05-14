"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  messages,
} from "./messages";

const SUPPORTED_CODES = new Set(SUPPORTED_LOCALES.map((locale) => locale.code));
const AUTO_PREFERENCE = "auto";

const LocaleContext = createContext({
  locale: DEFAULT_LOCALE,
  localeLabel: "English",
  preference: AUTO_PREFERENCE,
  supportedLocales: SUPPORTED_LOCALES,
  setPreference: () => {},
  t: (key) => key,
});

function normalizeLocale(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const exact = raw.replace("_", "-");
  if (SUPPORTED_CODES.has(exact)) return exact;
  const languageOnly = exact.split("-")[0];
  return SUPPORTED_CODES.has(languageOnly) ? languageOnly : "";
}

function matchSupportedLocale(languages = []) {
  for (const language of languages) {
    const matched = normalizeLocale(language);
    if (matched) return matched;
  }
  return DEFAULT_LOCALE;
}

function browserLocale() {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const languages = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language];
  return matchSupportedLocale(languages);
}

function validPreference(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === AUTO_PREFERENCE) return AUTO_PREFERENCE;
  return normalizeLocale(raw) || AUTO_PREFERENCE;
}

function safeDecodePreference(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function readStoredPreference() {
  if (typeof window === "undefined") return AUTO_PREFERENCE;
  const localPreference = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (localPreference) return validPreference(localPreference);
  const cookiePreference = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${LOCALE_COOKIE_NAME}=`))
    ?.split("=")[1];
  return validPreference(cookiePreference ? safeDecodePreference(cookiePreference) : "");
}

function writeLocaleCookie(preference) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(preference)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function getMessageValue(localeMessages, key) {
  return key.split(".").reduce((value, segment) => {
    if (!value || typeof value !== "object") return undefined;
    return value[segment];
  }, localeMessages);
}

function formatMessage(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
}

export function LocaleProvider({ children }) {
  const [preference, setPreferenceState] = useState(AUTO_PREFERENCE);
  const [detectedLocale, setDetectedLocale] = useState(DEFAULT_LOCALE);

  useEffect(() => {
    setPreferenceState(readStoredPreference());
    setDetectedLocale(browserLocale());
  }, []);

  useEffect(() => {
    const handleLanguageChange = () => setDetectedLocale(browserLocale());
    window.addEventListener("languagechange", handleLanguageChange);
    return () => window.removeEventListener("languagechange", handleLanguageChange);
  }, []);

  const locale = preference === AUTO_PREFERENCE ? detectedLocale : preference;
  const safeLocale = SUPPORTED_CODES.has(locale) ? locale : DEFAULT_LOCALE;
  const localeMeta = SUPPORTED_LOCALES.find((item) => item.code === safeLocale) || SUPPORTED_LOCALES[0];

  useEffect(() => {
    document.documentElement.lang = safeLocale;
    document.documentElement.dataset.locale = safeLocale;
  }, [safeLocale]);

  const setPreference = useCallback((nextPreference) => {
    const safePreference = validPreference(nextPreference);
    setPreferenceState(safePreference);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, safePreference);
    }
    writeLocaleCookie(safePreference);
  }, []);

  const t = useCallback(
    (key, values = {}) => {
      const localized = getMessageValue(messages[safeLocale], key);
      const fallback = getMessageValue(messages[DEFAULT_LOCALE], key);
      return formatMessage(localized ?? fallback ?? key, values);
    },
    [safeLocale]
  );

  const value = useMemo(
    () => ({
      locale: safeLocale,
      localeLabel: localeMeta.nativeLabel || localeMeta.label,
      preference,
      supportedLocales: SUPPORTED_LOCALES,
      setPreference,
      t,
    }),
    [localeMeta, preference, safeLocale, setPreference, t]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  return useContext(LocaleContext);
}
