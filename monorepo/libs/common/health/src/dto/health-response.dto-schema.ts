import { ReferenceObject, SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

function getComponentSchema(example: 'up' | 'down') {
  return {
    type: 'object',
    required: ['name', 'status'],
    properties: {
      name: {
        type: 'string',
        example: 'component',
      },
      status: {
        type: 'string',
        enum: ['up', 'down'],
        example,
      },
      message: {
        type: 'string',
        example: 'example message',
      },
    },
  };
}

export const HealthResponseDtoSchema: SchemaObject & Partial<ReferenceObject> = {
  type: 'object',
  required: ['status', 'info', 'error', 'details'],
  properties: {
    status: {
      type: 'string',
      enum: ['ok', 'error', 'shutting_down'],
      example: 'ok',
    },
    info: {
      type: 'array',
      items: getComponentSchema('up'),
    },
    error: {
      type: 'array',
      items: getComponentSchema('down'),
    },
    details: {
      type: 'array',
      items: getComponentSchema('up'),
    },
  },
};
