import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "./languages";
import { en, translations } from "./translations";
import type { SupportedLanguage, TranslationDictionary } from "./types";

const LANGUAGE_STORAGE_KEY = "janus.language_preference";

async function readStorage(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeStorage(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    /* ignore */
  }
}

interface I18nState {
  locale: SupportedLanguage;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (key: keyof TranslationDictionary, params?: Record<string, string | number>) => string;
}

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: DEFAULT_LANGUAGE,
  hydrated: false,

  hydrate: async () => {
    const saved = await readStorage(LANGUAGE_STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
      set({ locale: saved as SupportedLanguage, hydrated: true });
    } else {
      set({ locale: DEFAULT_LANGUAGE, hydrated: true });
    }
  },

  setLanguage: async (lang: SupportedLanguage) => {
    await writeStorage(LANGUAGE_STORAGE_KEY, lang);
    set({ locale: lang });
  },

  t: (key: keyof TranslationDictionary, params?: Record<string, string | number>) => {
    const currentLocale = get().locale;
    const dict = translations[currentLocale] ?? en;
    let template = dict[key] ?? en[key] ?? (key as string);

    if (params) {
      Object.entries(params).forEach(([paramKey, val]) => {
        template = template.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(val));
      });
    }
    return template;
  },
}));
