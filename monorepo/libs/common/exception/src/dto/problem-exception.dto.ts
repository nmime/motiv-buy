import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import { ProblemKind } from '../enum';
import { ExceptionClass } from '../type';
import { OptionalClassConstructor } from '@app/common-shared';
import { ReferenceObject, SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { ExceptionHttpStatusMapper } from '../mapper';
import { formatTitleFromClassName } from '../util';
import { ProblemKindMapper } from '../mapper';

export function getProblemType(problemType: string): string {
  return `/api/problems/${problemType}`;
}

export function getProblemInstance(uuid: string): string {
  return `/api/problems/instances/${uuid}`;
}

/**
 * RFC 9457 Problem Details for HTTP APIs DTO
 * https://tools.ietf.org/html/rfc9457
 */
export class ProblemExceptionDto<T = unknown> {
  @ApiProperty({
    description: 'A URI reference that identifies the problem type',
    example: getProblemType('symbol_not_found'),
  })
  type!: string;

  @ApiProperty({
    description: 'A short, human-readable summary of the problem type',
    example: 'Symbol not found',
  })
  title!: string;

  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  status!: number;

  @ApiProperty({
    description: 'A human-readable explanation specific to this occurrence of the problem',
    example: 'The requested symbol could not be found',
  })
  detail!: string;

  @ApiProperty({
    description: 'A URI reference that identifies the specific occurrence of the problem',
    example: getProblemInstance('ada06f0c-8ca8-457a-9906-4feb8c999169'),
  })
  instance!: string;

  @ApiProperty({
    description: 'Problem category for easier error handling',
    example: ProblemKind.Validation,
    enum: ProblemKind,
  })
  kind!: ProblemKind;

  @ApiPropertyOptional({
    description: 'Additional problem-specific information',
  })
  info?: T;

  constructor(data: ProblemExceptionDto<T>) {
    Object.assign(this, data);
  }
}

export function getProblemExceptionDtoSchema(params: {
  exception: ExceptionClass<OptionalClassConstructor>;
  description?: string;
  problemType: string;
  title?: string;
}): SchemaObject & Partial<ReferenceObject> {
  const { exception, description, problemType, title } = params;

  const { kind, dataType } = exception;
  const status = ExceptionHttpStatusMapper.getHttpStatus(kind);
  const problemKind = ProblemKindMapper.mapToProblemKind(kind);

  const type = getProblemType(problemType);
  const defaultTitle = title ?? formatTitleFromClassName(exception.name);

  const properties: Record<Exclude<keyof ProblemExceptionDto, 'info'>, SchemaObject | ReferenceObject> = {
    type: {
      type: 'string',
      enum: [type],
      example: type,
    },
    title: {
      type: 'string',
      example: defaultTitle,
    },
    status: {
      type: 'number',
      enum: [status],
      example: status,
    },
    detail: {
      type: 'string',
      example: description ?? 'An error occurred',
    },
    instance: {
      type: 'string',
      example: getProblemInstance('ada06f0c-8ca8-457a-9906-4feb8c999169'),
    },
    kind: {
      type: 'string',
      enum: [problemKind],
      example: problemKind,
    },
    ...(dataType && {
      info: {
        $ref: getSchemaPath(dataType as new () => unknown),
      },
    }),
  };

  return {
    type: 'object',
    description,
    properties,
    required: Object.keys(properties),
  };
}
