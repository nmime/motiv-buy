import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { I18nResolver, I18nResolverOptions } from 'nestjs-i18n';
import { BaseI18nContext } from '../i18n-context';

@Injectable()
export class BotLangResolver implements I18nResolver {
  private readonly logger: Logger = new Logger(this.constructor.name);

  constructor(@I18nResolverOptions() private keys: string[] = []) {}

  resolve(context: ExecutionContext): string {
    const ctx: BaseI18nContext = context.getArgByIndex(0);

    this.logger.log('Bot lang', ctx.lang);

    return ctx.lang;
  }
}
