export enum Language {
  English = 'en',
  Spanish = 'es',
  French = 'fr',
  German = 'de',
  Russian = 'ru',
  Chinese = 'zh',
  Japanese = 'ja',
  Korean = 'ko',
}

export const defaultLanguage = Language.English;

export const supportedLanguages: readonly string[] = [Language.English, Language.Russian] as const;

export const languageNames: Record<string, string> = {
  [Language.English]: 'English',
  [Language.Russian]: 'Русский',
};

export const supportedLanguageOptions = [
  { code: Language.English, name: 'English' },
  { code: Language.Russian, name: 'Русский' },
] as const;

export function getLang(lang?: string): Language {
  if (!lang) {
    return defaultLanguage;
  }

  const normalizedLang = lang.toLowerCase();
  const foundLang = Object.values(Language).find((l) => l.toString() === normalizedLang);

  return foundLang || defaultLanguage;
}
