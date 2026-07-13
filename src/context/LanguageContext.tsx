// Til konteksti — saytdagi context/LanguageContext.tsx dan port.
// Cookie/router.refresh o'rniga AsyncStorage ishlatiladi.
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ru } from "@/locales/ru";
import { uz, type TKey } from "@/locales/uz";
import { setLocalizeLang } from "@/utils/localize";

export type Lang = "uz" | "ru";

const DICTS: Record<Lang, Record<TKey, string>> = { uz, ru };
const STORAGE_KEY = "lang";

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  /** Statik UI matni: t("pv.stat_today"). {name} kabi o'rinlarni vars bilan to'ldiradi. */
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("uz");

  // localize() ham shu tilga ergashsin
  useMemo(() => setLocalizeLang(lang), [lang]);

  // Saqlangan tilni yuklaymiz
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "uz" || saved === "ru") {
        setLangState(saved);
        setLocalizeLang(saved);
      }
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    setLocalizeLang(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
  }, []);

  const toggle = useCallback(() => setLang(lang === "uz" ? "ru" : "uz"), [lang, setLang]);

  const t = useCallback(
    (key: TKey, vars?: Record<string, string | number>) => {
      let str: string = DICTS[lang][key] ?? uz[key] ?? key;
      if (vars) {
        for (const k of Object.keys(vars)) str = str.replace(`{${k}}`, String(vars[k]));
      }
      return str;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
