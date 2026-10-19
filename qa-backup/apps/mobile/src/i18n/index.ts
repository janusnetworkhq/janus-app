import { useI18nStore } from "./store";
import type { TranslationDictionary } from "./types";

export * from "./languages";
export * from "./types";
export { useI18nStore };

export function useTranslation() {
  const locale = useI18nStore((s) => s.locale);
  const setLanguage = useI18nStore((s) => s.setLanguage);
  const t = useI18nStore((s) => s.t);

  return {
    t: (key: keyof TranslationDictionary, params?: Record<string, string | number>) => t(key, params),
    locale,
    setLanguage,
  };
}
