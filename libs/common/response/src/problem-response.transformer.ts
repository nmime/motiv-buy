import {
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  INestApplication,
  Injectable,
  Logger,
  Module,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, map, Observable, of } from 'rxjs';
import { Result } from 'ts-results';
import { FastifyReply, FastifyRequest } from 'fastify';
import {
  BaseException,
  ExceptionClass,
  ExceptionHttpStatusMapper,
  formatTitleFromClassName,
  generateProblemType,
  getProblemInstance,
  getProblemType,
  ProblemExceptionDto,
  ProblemKind,
  ProblemKindMapper,
} from '@app/common-exception';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { v4 as uuidv4 } from 'uuid';
import { getLang, Language, OptionalClassConstructor } from '@app/common-shared';
import { I18nService } from 'nestjs-i18n';

@Catch()
@Injectable()
export class ProblemResponseTransformer implements NestInterceptor, ExceptionFilter {
  private readonly logger: Logger = new Logger(this.constructor.name);

  constructor(private readonly i18nService: I18nService) {}

  static setup(app: INestApplication): void {
    const transformer = app.get(ProblemResponseTransformer);
    app.useGlobalInterceptors(transformer);
    app.useGlobalFilters(transformer);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result: unknown): unknown => {
        if (Result.isResult(result)) {
          if (result.err) {
            return this.handleError(context.switchToHttp(), result.val);
          }

          return result.val;
        }

        if (result instanceof Error) {
          return this.handleError(context.switchToHttp(), result);
        }

        return result;
      }),
      catchError((e) => of(this.handleError(context.switchToHttp(), e))),
    );
  }

  catch(error: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const result = this.handleError(ctx, error);

    ctx.getResponse<FastifyReply>().send(result);
  }

  private generateTraceId(): string {
    return uuidv4();
  }

  private localize(translationKey: string | undefined, fallbackText: string, lang: Language): string {
    if (!translationKey) {
      return fallbackText;
    }

    try {
      const translatedText = this.i18nService.t(translationKey, { lang });

      return typeof translatedText === 'string' ? translatedText : fallbackText;
    } catch {
      return fallbackText;
    }
  }

  private handleError(context: HttpArgumentsHost, e: unknown): ProblemExceptionDto<unknown> {
    this.logger.error(e);

    const response = context.getResponse<FastifyReply>();
    const request = context.getRequest<FastifyRequest>();
    const acceptLang = request.headers['accept-language'];
    const xLang = request.headers['x-language'];
    let langHeader = 'en';
    if (Array.isArray(acceptLang)) {
      langHeader = acceptLang[0] || 'en';
    } else if (acceptLang) {
      langHeader = acceptLang;
    } else if (Array.isArray(xLang)) {
      langHeader = xLang[0] || 'en';
    } else if (typeof xLang === 'string') {
      langHeader = xLang;
    }

    const lang = getLang(langHeader);

    const traceId = this.generateTraceId();

    if (e instanceof BaseException) {
      const status = ExceptionHttpStatusMapper.getHttpStatus(e.kind);
      response.code(status);

      const exceptionConstructor = e.constructor as ExceptionClass<OptionalClassConstructor>;
      const problemType = exceptionConstructor.problemType || generateProblemType(e.constructor.name);

      const defaultTitle = e.title || exceptionConstructor.title || formatTitleFromClassName(e.constructor.name);
      const defaultDetail = e.detail || defaultTitle;

      const localizedTitle = this.localize(defaultTitle, defaultTitle, lang);
      const localizedDetail = this.localize(defaultDetail, defaultDetail, lang);

      return new ProblemExceptionDto({
        type: getProblemType(e.type || problemType),
        title: localizedTitle,
        status,
        detail: localizedDetail,
        instance: e.instance ?? getProblemInstance(traceId),
        kind: ProblemKindMapper.mapToProblemKind(e.kind),
        info: e.data as unknown,
      });
    }

    if (e instanceof HttpException) {
      const status = e.getStatus();
      const messageOrData = e.getResponse();
      response.code(status);

      const title = formatTitleFromClassName(e.constructor.name);
      const detail = typeof messageOrData === 'string' ? messageOrData : e.message;
      const problemType = generateProblemType(e.constructor.name);

      let info: string | Record<string, unknown> | undefined | null;
      if (typeof messageOrData === 'object' && !('message' in messageOrData)) {
        info = messageOrData as Record<string, unknown>;
      } else if (
        typeof messageOrData === 'object' &&
        'message' in messageOrData &&
        typeof messageOrData.message === 'object'
      ) {
        info = messageOrData.message as Record<string, unknown>;
      }

      return new ProblemExceptionDto({
        type: getProblemType(problemType),
        title,
        status,
        detail,
        instance: getProblemInstance(traceId),
        kind: ProblemKindMapper.mapToProblemKind(ExceptionHttpStatusMapper.getKind(status)),
        info,
      });
    }

    response.status(500);

    const localizedText = this.localize('errors.generic.internal', 'Internal server error', lang);

    return new ProblemExceptionDto({
      type: getProblemType('internal_error'),
      title: localizedText,
      status: 500,
      detail: localizedText,
      instance: getProblemInstance(traceId),
      kind: ProblemKind.Internal,
      info: undefined,
    });
  }
}

@Module({
  providers: [ProblemResponseTransformer],
  exports: [ProblemResponseTransformer],
})
export class ProblemResponseModule {}
