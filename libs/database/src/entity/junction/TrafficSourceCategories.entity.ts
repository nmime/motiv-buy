import { Entity, Index, ManyToOne, PrimaryKey, Property, Ref, Unique } from '@mikro-orm/core';
import { assignEntityData, EntityConstructorData } from '../../type';
import { TrafficSourceEntity } from '../TrafficSource.entity';
import { TrafficSourceCategoryEntity } from '../TrafficSourceCategory.entity';

@Entity({ tableName: 'traffic_source_categories_junction' })
@Index({ name: 'ix__traffic_source_categories_junction__source_id', properties: ['trafficSource'] })
@Index({ name: 'ix__traffic_source_categories_junction__category_id', properties: ['category'] })
@Index({ name: 'ix__traffic_source_categories_junction__is_primary', properties: ['isPrimary'] })
@Unique({ name: 'uq__traffic_source_categories_junction__source_category', properties: ['trafficSource', 'category'] })
export class TrafficSourceCategoriesEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'uuidv7()' })
  id!: string;

  @ManyToOne('TrafficSourceEntity', {
    nullable: false,
    joinColumn: 'traffic_source_id',
    referenceColumnName: 'id',
    ref: true,
  })
  trafficSource!: Ref<TrafficSourceEntity>;

  @ManyToOne('TrafficSourceCategoryEntity', {
    nullable: false,
    joinColumn: 'category_id',
    referenceColumnName: 'id',
    ref: true,
  })
  category!: Ref<TrafficSourceCategoryEntity>;

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

  constructor(
    data: EntityConstructorData<
      TrafficSourceCategoriesEntity,
      'id' | 'createdAt' | 'updatedAt',
      'isPrimary' | 'sortOrder',
      'trafficSource' | 'category'
    >,
  ) {
    assignEntityData(this as Record<string, unknown>, data, {
      trafficSourceId: {
        field: 'trafficSource',

        entityClass: TrafficSourceEntity,
        required: true,
      },
      categoryId: {
        field: 'category',
        entityClass: TrafficSourceCategoryEntity,
        required: true,
      },
    });
  }
}
