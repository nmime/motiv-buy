export enum Language {
  EN = 'en',
  ES = 'es',
  FR = 'fr',
  DE = 'de',
  RU = 'ru',
  ZH = 'zh',
  JA = 'ja',
  KO = 'ko',
}

export const defaultLanguage = Language.EN;

export function getLang(lang?: string): Language {
  if (!lang) return defaultLanguage;
  
  const normalizedLang = lang.toLowerCase();
  const foundLang = Object.values(Language).find(l => l === normalizedLang);
  
  return foundLang || defaultLanguage;
}
