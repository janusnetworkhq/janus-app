import { useI18nStore } from "./store";
import { en, translations } from "./translations";
import type { TranslationDictionary } from "./types";

export * from "./languages";
export * from "./types";
export { useI18nStore };

export function useTranslation() {
  const locale = useI18nStore((s) => s.locale);
  const setLanguage = useI18nStore((s) => s.setLanguage);

  // Resolve against the subscribed `locale` (not the store's stable `t`), so the React
  // Compiler's memoised JSX sees a new dependency and re-renders when the language changes.
  const dict = translations[locale] ?? en;
  const t = (key: keyof TranslationDictionary, params?: Record<string, string | number>) => {
    let template = dict[key] ?? en[key] ?? (key as string);
    if (params) {
      Object.entries(params).forEach(([paramKey, val]) => {
        template = template.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(val));
      });
    }
    return template;
  };

  return { t, locale, setLanguage };
}
