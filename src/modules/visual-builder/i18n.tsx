"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Locale } from "./types";

const STORAGE_KEY = "visual-builder.locale";

type I18n = { locale: Locale; setLocale: (locale: Locale) => void; t: (de: string, en: string) => string };

const Ctx = createContext<I18n>({ locale: "de", setLocale: () => undefined, t: (de) => de });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("de");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Browser storage is only readable after hydration.
      if (localStorage.getItem(STORAGE_KEY) === "en") setLocaleState("en");
    } catch {
      /* Browser storage can be disabled. */
    }
  }, []);
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Browser storage can be disabled. */ }
  }, []);
  const value = useMemo<I18n>(() => ({ locale, setLocale, t: (de, en) => (locale === "en" ? en : de) }), [locale, setLocale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}
