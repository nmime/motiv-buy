import { I18nContext, I18nService, TranslateOptions } from 'nestjs-i18n';
import { Language } from '@app/common/shared';

export interface BaseI18nContext {
  lang: Language;
  i18n: I18nService;
}

export class AppI18nContext extends I18nContext {
  tr(key: string, options?: TranslateOptions): string {
    return this.translate<string>(key, options) as string;
  }

  static getI18nContext<TContext extends BaseI18nContext>(ctx: TContext): AppI18nContext {
    const { lang } = ctx;
    const service = ctx.i18n;

    return new AppI18nContext(lang, service);
  }
}

/* @deprecated */
export class MyI18nContext extends AppI18nContext {}
