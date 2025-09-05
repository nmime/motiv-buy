import { Entity, PrimaryKey, Property, Collection, OneToMany, Index, Enum } from '@mikro-orm/core';
import { EntityConstructorData } from "../type";
import { LocalizedField } from '@app/common-shared';
import { TrafficSourceCategoriesEntity } from './junction/TrafficSourceCategory.entity';

export enum TopicCategory {
  // Basic controls
  All = "All",
  
  // Main categories from first screen
  Other = "Other",
  Blogs = "Blogs",
  News = "News",
  Commerce = "Commerce",
  Useful = "Useful",
  Elders = "Elders",
  Entertainment = "Entertainment",
  Cryptocurrencies = "Cryptocurrencies",
  Earnings = "Earnings",
  Quotes = "Quotes",
  Music = "Music",
  Womens = "Womens",
  Astrology = "Astrology",
  Educational = "Educational",
  Adult18Plus = "Adult18Plus",
  Psychology = "Psychology",
  Chats = "Chats",
  Betting = "Betting",
  CreativityAndDesign = "CreativityAndDesign",
  NeuralNetworks = "NeuralNetworks",
  
  // Additional categories from second screen
  Sports = "Sports",
  Auto = "Auto",
  Movies = "Movies",
  Health = "Health",
  Travel = "Travel",
  CookingFood = "CookingFood",
  Tools = "Tools",
  Communication = "Communication",
  Mens = "Mens",
  Technologies = "Technologies",
  Downloads = "Downloads",
  Auctions = "Auctions",
  Video = "Video",
  Trash = "Trash",
  StickersThemes = "StickersThemes",
  Economics = "Economics",
  Spam = "Spam",
  Dating = "Dating",
  Subscriptions = "Subscriptions",
  Applications = "Applications",
  
  // Final categories from third screen
  GaiTrafficPolice = "GaiTrafficPolice", // Russian traffic police
  Gambling = "Gambling",
  Folders = "Folders"
}

/**
 * Entity representing traffic source categories
 * Used to categorize traffic sources by type, industry, or characteristics
 */
@Entity({ tableName: 'traffic_source_categories' })
@Index({ name: 'ix__traffic_source_categories__name', properties: ['name'] })
@Index({ name: 'ix__traffic_source_categories__slug', properties: ['slug'] })
@Index({ name: 'ix__traffic_source_categories__category_type', properties: ['categoryType'] })
@Index({ name: 'ix__traffic_source_categories__is_active', properties: ['isActive'] })
export class TrafficSourceCategoryEntity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid_v7()' })
  id!: string;

  @Property({ type: 'json', fieldName: 'name' })
  name!: LocalizedField;

  @Property({ type: 'varchar', length: 100, unique: true, fieldName: 'slug' })
  slug!: string;

  @Property({ type: 'varchar', length: 50, fieldName: 'category_type' })
  @Enum(() => TopicCategory)
  categoryType!: TopicCategory;

  @Property({ type: 'text', nullable: true, fieldName: 'description' })
  description?: string;

  @Property({ type: 'varchar', length: 7, nullable: true, fieldName: 'color' })
  color?: string; // Hex color code for UI display

  @Property({ type: 'varchar', length: 50, nullable: true, fieldName: 'icon' })
  icon?: string; // Icon name or class for UI display

  @Property({ type: 'integer', default: 0, fieldName: 'sort_order' })
  sortOrder = 0;

  @Property({ type: 'boolean', default: true, fieldName: 'is_active' })
  isActive = true;

  @Property({ type: 'json', nullable: true, fieldName: 'metadata' })
  metadata?: Record<string, any>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()', fieldName: 'created_at' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', defaultRaw: 'now()', onUpdate: () => new Date(), fieldName: 'updated_at' })
  updatedAt: Date = new Date();

  @OneToMany(() => TrafficSourceCategoriesEntity, 'category')
  trafficSources? = new Collection<TrafficSourceCategoriesEntity>(this);

  constructor(data: EntityConstructorData<TrafficSourceCategoryEntity, 'id' | 'createdAt' | 'updatedAt' | 'trafficSources', 'sortOrder' | 'isActive'>) {
    Object.assign(this, data);
  }
}
