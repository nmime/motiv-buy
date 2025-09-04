import { Entity, PrimaryKey, ManyToOne, Property, Index, Unique } from '@mikro-orm/core';
import { EntityConstructorData } from "../../type";

// Forward declarations for circular dependency resolution
declare class TrafficSourceEntity { }
declare class TrafficSourceCategoryEntity { }
@Entity({ tableName: 'traffic_source_categories_junction' })
@Index({ name: 'ix__traffic_source_categories_junction__source_id', properties: ['trafficSource'] })
@Index({ name: 'ix__traffic_source_categories_junction__category_id', properties: ['category'] })
@Index({ name: 'ix__traffic_source_categories_junction__is_primary', properties: ['isPrimary'] })
@Unique({ name: 'uq__traffic_source_categories_junction__source_category', properties: ['trafficSource', 'category'] })
export class TrafficSourceCategoriesEntity {
  @PrimaryKey({ type: 'bigserial' })
  id!: number;

  @Property({ type: 'bigint', fieldName: 'traffic_source_id' })
  trafficSourceId!: number;

  @Property({ type: 'bigint', fieldName: 'category_id' })
  categoryId!: number;

  @ManyToOne('TrafficSourceEntity', { fieldName: 'traffic_source_id' })
  trafficSource?: TrafficSourceEntity;

  @ManyToOne('TrafficSourceCategoryEntity', { fieldName: 'category_id' })
  category?: TrafficSourceCategoryEntity;

  @Property({ type: 'boolean', default: false, fieldName: 'is_primary' })
  isPrimary = false;

  @Property({ type: 'integer', default: 0, fieldName: 'sort_order' })
  sortOrder = 0;

  @Property({ type: 'json', nullable: true, fieldName: 'category_specific_config' })
  categorySpecificConfig?: Record<string, unknown>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  constructor(data: EntityConstructorData<TrafficSourceCategoriesEntity, 'id' | 'createdAt' | 'updatedAt', 'isPrimary' | 'sortOrder'>) {
    Object.assign(this, data);
  }
}
