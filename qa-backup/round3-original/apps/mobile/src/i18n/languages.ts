import type { LanguageInfo, SupportedLanguage } from "./types";

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  // US & UK Popular Languages
  {
    code: "en",
    name: "English (US)",
    nativeName: "English (US)",
    flag: "🇺🇸",
    region: "us_uk",
  },
  {
    code: "en-GB",
    name: "English (UK)",
    nativeName: "English (UK)",
    flag: "🇬🇧",
    region: "us_uk",
  },
  {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    flag: "🇪🇸",
    region: "us_uk",
  },
  {
    code: "fr",
    name: "French",
    nativeName: "Français",
    flag: "🇫🇷",
    region: "us_uk",
  },
  {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    flag: "🇩🇪",
    region: "us_uk",
  },

  // Indian Popular Languages
  {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    flag: "🇮🇳",
    region: "india",
  },
  {
    code: "ta",
    name: "Tamil",
    nativeName: "தமிழ்",
    flag: "🇮🇳",
    region: "india",
  },
  {
    code: "te",
    name: "Telugu",
    nativeName: "తెలుగు",
    flag: "🇮🇳",
    region: "india",
  },
  {
    code: "kn",
    name: "Kannada",
    nativeName: "ಕನ್ನಡ",
    flag: "🇮🇳",
    region: "india",
  },
  {
    code: "ml",
    name: "Malayalam",
    nativeName: "മലയാളം",
    flag: "🇮🇳",
    region: "india",
  },
  {
    code: "bn",
    name: "Bengali",
    nativeName: "বাংলা",
    flag: "🇮🇳",
    region: "india",
  },
  {
    code: "mr",
    name: "Marathi",
    nativeName: "मराठी",
    flag: "🇮🇳",
    region: "india",
  },
  {
    code: "gu",
    name: "Gujarati",
    nativeName: "ગુજરાતી",
    flag: "🇮🇳",
    region: "india",
  },
];

export const DEFAULT_LANGUAGE: SupportedLanguage = "en";
