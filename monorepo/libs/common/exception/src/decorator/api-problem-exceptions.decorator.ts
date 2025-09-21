import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiExtraModels, ApiResponse } from '@nestjs/swagger';
import { ExceptionHttpStatusMapper } from '../mapper';
import { OptionalClassConstructor } from '@app/common-shared';
import { ExceptionClass } from '../type';
import { getProblemExceptionDtoSchema, getProblemType } from '../dto';
import { formatTitleFromClassName, generateProblemType, getSchemaExample } from '../util';
import { getHttpStatusName } from '../mapper';
import { ApiResponseExamples } from '@nestjs/swagger/dist/decorators/api-response.decorator';

// eslint-disable-next-line @typescript-eslint/naming-convention
export function ApiProblemExceptions(
  exceptions: Array<[ExceptionClass<OptionalClassConstructor>, { description?: string }]>,
) {
  const decorators: Array<ClassDecorator | MethodDecorator | PropertyDecorator> = [];

  const statusExceptionMap: Map<HttpStatus, [ExceptionClass<OptionalClassConstructor>, { description?: string }][]> =
    new Map();

  exceptions.forEach((item) => {
    const [exception] = item;

    const { kind, dataType } = exception;
    const status = ExceptionHttpStatusMapper.getHttpStatus(kind);

    const statusExceptions = statusExceptionMap.get(status) ?? [];
    statusExceptions.push(item);
    statusExceptionMap.set(status, statusExceptions);

    if (dataType) {
      decorators.push(ApiExtraModels(dataType));
    }
  });

  decorators.push(
    ...[...statusExceptionMap.entries()].map(([status, items]) => {
      const examples: { [key: string]: ApiResponseExamples } = {};

      const schemas = items.map(([exception, options]) => {
        const problemType = exception.problemType ?? generateProblemType(exception.name);
        const title = exception.title ?? formatTitleFromClassName(exception.name);

        const schema = getProblemExceptionDtoSchema({
          exception,
          description: options?.description,
          problemType,
          title,
        });

        const type = getProblemType(problemType);
        const example = getSchemaExample(schema);

        examples[problemType] = {
          summary: `${title} (type: ${type})`,
          value: example,
        };

        return schema;
      });

      if (schemas.length === 1) {
        return ApiResponse({
          description: getHttpStatusName(status),
          status,
          schema: schemas[0],
        });
      }

      return ApiResponse({
        description: getHttpStatusName(status),
        status,
        schema: {
          discriminator: {
            propertyName: 'type',
          },
          oneOf: schemas,
        },
        examples,
      });
    }),
  );

  return applyDecorators(...decorators);
}
