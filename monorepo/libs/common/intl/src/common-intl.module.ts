import { Module } from '@nestjs/common';
import { AcceptLanguageResolver, I18nModule } from 'nestjs-i18n';
import { defaultLanguage } from '@app/common-shared';
import path from 'node:path';

@Module({
  controllers: [],
  providers: [],
  exports: [],
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: defaultLanguage,
      loaderOptions: {
        path: path.join(process.cwd(), 'libs/common/intl/locales'),
        watch: true,
      },
      logging: false,
      resolvers: [AcceptLanguageResolver],
    }),
  ],
})
export class AppCommonIntlModule {}
