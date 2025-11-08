import { readFileSync } from 'fs';
import { join } from 'path';

export class I18nLoader {
  private static readonly localesDir = join(__dirname, '../../locales');
  private static readonly features = ['common', 'auth', 'user', 'balance', 'payment', 'traffic', 'statistic', 'bot'];

  static loadLocale(lang: string): Record<string, unknown> {
    const locale: Record<string, unknown> = {};

    for (const feature of this.features) {
      const filePath = join(this.localesDir, lang, `${feature}.json`);

      try {
        const content = readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        Object.assign(locale, data);
      } catch {
        // Silently skip missing locale files
      }
    }

    return locale;
  }

  static loadAllLocales(): Record<string, Record<string, unknown>> {
    const locales: Record<string, Record<string, unknown>> = {};
    const langDirs = ['en', 'ru'];

    for (const lang of langDirs) {
      locales[lang] = this.loadLocale(lang);
    }

    return locales;
  }
}
