import { Entity, PrimaryKey, ManyToOne, Property, Index, Unique } from '@mikro-orm/core';
import { EntityConstructorData } from "../../type";
import type { TrafficSourceEntity } from '../TrafficSource.entity';
import type { TrafficSourceCategoryEntity } from '../TrafficSourceCategory.entity';
@Entity({ tableName: 'traffic_source_categories_junction' })
@Index({ name: 'ix__traffic_source_categories_junction__source_id', properties: ['trafficSourceId'] })
@Index({ name: 'ix__traffic_source_categories_junction__category_id', properties: ['categoryId'] })
@Index({ name: 'ix__traffic_source_categories_junction__is_primary', properties: ['isPrimary'] })
@Unique({ name: 'uq__traffic_source_categories_junction__source_category', properties: ['trafficSourceId', 'categoryId'] })
export class TrafficSourceCategoriesEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @Property({ type: 'uuid', fieldName: 'traffic_source_id' })
  trafficSourceId!: string;

  @Property({ type: 'uuid', fieldName: 'category_id' })
  categoryId!: string;

  @ManyToOne('TrafficSourceEntity', { nullable: false, joinColumn: 'traffic_source_id', referenceColumnName: 'id' })
  trafficSource?: TrafficSourceEntity;

  @ManyToOne('TrafficSourceCategoryEntity', { nullable: false, joinColumn: 'category_id', referenceColumnName: 'id' })
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

  constructor(data: EntityConstructorData<TrafficSourceCategoriesEntity, 'id' | 'createdAt' | 'updatedAt' | 'trafficSource' | 'category', 'isPrimary' | 'sortOrder'>) {
    Object.assign(this, data);
  }
}
