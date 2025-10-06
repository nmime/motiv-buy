import { Ref, Reference } from '@mikro-orm/core';

/**
 * Type-safe constructor data for MikroORM entities
 * Accepts either string IDs for relations OR entity instances directly
 *
 * @template T - The entity type
 * @template TExclude - Properties to exclude (auto-generated fields like id, createdAt)
 * @template TOptional - Properties that have defaults and should be optional
 * @template TRelations - Array of relation field names that need ID conversion
 *
 * @example
 * ```typescript
 * EntityConstructorData<
 *   UserEntity,
 *   'id' | 'createdAt',           // Exclude auto-generated fields
 *   'isActive',                   // Fields with defaults are optional
 *   'user' | 'linkUser'           // Relation fields - will accept both IDs and entities
 * >
 *
 * // Usage with IDs:
 * new UserEntity({ userId: "123", linkUserId: "456", ...data })
 *
 * // Usage with entities:
 * new UserEntity({ user: userEntity, linkUser: linkUserEntity, ...data })
 *
 * // Mixed usage (different relations):
 * new UserEntity({ userId: "123", linkUser: linkUserEntity, ...data })
 *
 * // Invalid - will throw error:
 * // new UserEntity({ userId: "123", user: userEntity, ...data }) // ❌
 * ```
 */
export type EntityConstructorData<
  T,
  TExclude extends keyof T,
  TOptional extends keyof T = never,
  TRelations extends keyof T = never,
> =
  // Base entity properties (excluding auto-generated, optional, and relations)
  Omit<T, TExclude | TOptional | TRelations> &
    // Optional properties (fields with defaults)
    Partial<Pick<T, TOptional>> &
    // Relation options: either entity OR id for each relation (partial, so both are optional)
    Partial<Pick<T, TRelations>> &
    Partial<{
      [K in TRelations as `${K & string}Id`]: T[K] extends Ref<unknown> | undefined ? string | undefined : string;
    }>;

/**
 * Unified type for entity constructor classes that accept any constructor signature
 */
export type EntityConstructor<T = unknown> = new (...args: never[]) => T;

/**
 * Type-safe relation configuration for entity relationships
 */
export interface RelationConfig {
  field: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entityClass: new (...args: any[]) => any;
  required?: boolean;
}

/**
 * Helper function to assign entity data with automatic relation handling
 */
export function assignEntityData(
  entity: Record<string, unknown>,
  data: Record<string, unknown>,
  relationMap: Record<string, RelationConfig>,
): void {
  const processedKeys = new Set<string>();
  const entityTarget = entity;

  // Handle relations
  for (const [idKey, config] of Object.entries(relationMap)) {
    const idValue = data[idKey];
    const entityValue = data[config.field];

    // Mutual exclusion: cannot provide both entity and ID
    if (entityValue !== undefined && idValue !== undefined) {
      throw new Error(`Cannot provide both '${config.field}' and '${idKey}' - use either entity or ID, not both`);
    }

    if (entityValue !== undefined) {
      entityTarget[config.field] = entityValue;
      processedKeys.add(config.field);
    } else if (idValue !== undefined && idValue !== null) {
      entityTarget[config.field] = Reference.createFromPK(config.entityClass, idValue as string);

      processedKeys.add(idKey);
    } else if (config.required) {
      throw new Error(`Required relation '${config.field}' or '${idKey}' is missing`);
    }

    processedKeys.add(idKey);
  }

  // Assign other fields
  const otherFields = Object.fromEntries(Object.entries(data).filter(([key]) => !processedKeys.has(key)));

  Object.assign(entityTarget, otherFields);
}
