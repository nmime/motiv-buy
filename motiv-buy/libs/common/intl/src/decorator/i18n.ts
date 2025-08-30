import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { MyI18nContext } from '../i18n-context';

export const I18n = createParamDecorator((data, ctx: ExecutionContext) => {
  return MyI18nContext.getI18nContext(ctx.getArgByIndex(0));
});
