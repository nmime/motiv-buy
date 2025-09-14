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

export function getLang(lang?: string): Language {
  if (!lang) {
    return defaultLanguage;
  }

  const normalizedLang = lang.toLowerCase();
  const foundLang = Object.values(Language).find((l) => l.toString() === normalizedLang);

  return foundLang || defaultLanguage;
}
