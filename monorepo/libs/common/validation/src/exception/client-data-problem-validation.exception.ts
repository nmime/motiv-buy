import { Exception, ExceptionKind } from '@app/common-exception';
import { ValidationErrorResponse } from '../type';
import { ApiProperty } from '@nestjs/swagger';

export class ClientDataProblemValidationDto {
  @ApiProperty({
    description: 'Validation errors details',
    type: 'object',
    additionalProperties: {
      oneOf: [
        { type: 'array', items: { type: 'string' } },
        {
          type: 'object',
          additionalProperties: { type: 'array', items: { type: 'string' } },
        },
      ],
    },
    example: {
      property1: ['Property1 should not be empty'],
      nestedProperty: {
        nestedProperty1: ['Nested property1 should not be empty'],
        nestedProperty2: ['Nested property2 should not be empty'],
      },
    },
  })
  errors!: ValidationErrorResponse;

  constructor(data: ClientDataProblemValidationDto) {
    Object.assign(this, data);
  }
}

export class ClientDataProblemValidationException extends Exception({
  kind: ExceptionKind.ClientDataValidation,
  dataType: ClientDataProblemValidationDto,
  problemType: 'client_data_validation',
  title: 'Client data validation error',
}) {
  static readonly defaultTitle = 'Validation error';
  static readonly defaultDetail = 'The provided data failed validation';

  constructor(
    errors: ValidationErrorResponse,
    options?: {
      title?: string;
      detail?: string;
      instance?: string;
    },
  ) {
    super({
      data: new ClientDataProblemValidationDto({ errors }),
      title: options?.title ?? ClientDataProblemValidationException.defaultTitle,
      detail: options?.detail ?? ClientDataProblemValidationException.defaultDetail,
      instance: options?.instance,
    });
  }
}
