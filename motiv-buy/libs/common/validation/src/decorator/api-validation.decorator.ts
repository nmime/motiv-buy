import { applyDecorators } from '@nestjs/common';
import { ApiBadRequestResponse } from '@nestjs/swagger';
import { ExceptionKind } from '@app/common/exception';
import { ClientDataValidationException } from '../exception';

/**
 * @deprecated Use ApiProblemValidation instead for RFC 9457 compliance
 *
 * ⚠️ Warning: Do not use together with @ApiProblemValidation() decorator
 * as it will cause conflicts in Swagger documentation.
 * Please migrate to @ApiProblemValidation() for RFC 9457 compliance.
 */
export const ApiValidation = (options?: { description?: string }) => {
  const description = options?.description ?? ClientDataValidationException.message;

  return applyDecorators(
    ApiBadRequestResponse({
      description,
      schema: {
        type: 'object',
        required: ['name', 'message', 'kind', 'data'],
        properties: {
          name: { type: 'string', example: ClientDataValidationException.name },
          message: { type: 'string', example: ClientDataValidationException.message },
          kind: { type: 'string', example: ExceptionKind.ClientDataValidation },
          data: {
            type: 'object',
            required: ['errors'],
            properties: {
              errors: {
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
              },
            },
          },
        },
      },
    }),
  );
};
