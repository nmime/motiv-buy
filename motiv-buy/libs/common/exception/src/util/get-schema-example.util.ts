import { ReferenceObject, SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

export function getSchemaExample(schemaObject: SchemaObject | ReferenceObject): Record<string, unknown> | undefined {
  if ('example' in schemaObject) {
    return schemaObject.example as Record<string, unknown>;
  }

  if ('properties' in schemaObject) {
    const result: Record<string, unknown> = {};
    for (const key in schemaObject.properties) {
      result[key] = getSchemaExample(schemaObject.properties[key]);
    }

    return result;
  }

  return undefined;
}
