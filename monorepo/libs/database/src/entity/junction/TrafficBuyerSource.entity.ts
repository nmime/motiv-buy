import { Entity, PrimaryKey, ManyToOne, Property, Index, Unique } from '@mikro-orm/core';
import { TrafficBuyerEntity } from '../TrafficBuyer.entity';
import { TrafficSourceEntity } from '../TrafficSource.entity';
import { EntityConstructorData } from "../../type/entity-constructor.type";


@Entity()
@Unique({ properties: ['trafficBuyer', 'trafficSource'] })
export class TrafficBuyerSourceEntity {
  @PrimaryKey()
  id!: number;

  @ManyToOne(() => TrafficBuyerEntity)
  @Index()
  trafficBuyer!: TrafficBuyerEntity;

  @ManyToOne(() => TrafficSourceEntity)
  @Index()
  trafficSource!: TrafficSourceEntity;

  @Property({ default: true })
  isActive = true;

  @Property({ nullable: true })
  contractTerms?: string; // JSON string for contract terms

  @Property({ nullable: true })
  pricePerAction?: number;

  @Property({ nullable: true })
  minimumOrder?: number;

  @Property({ nullable: true })
  maximumOrder?: number;

  @Property({ nullable: true })
  agreementStartDate?: Date;

  @Property({ nullable: true })
  agreementEndDate?: Date;

  @Property({ nullable: true })
  lastOrderDate?: Date;

  @Property({ default: 0 })
  totalOrdersCompleted = 0;

  @Property({ default: 0 })
  totalAmountSpent = 0;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  constructor(data: EntityConstructorData<TrafficBuyerSourceEntity, 'id' | 'createdAt' | 'updatedAt', 'isActive' | 'totalOrdersCompleted' | 'totalAmountSpent'>) {
    Object.assign(this, data);
  }
}
