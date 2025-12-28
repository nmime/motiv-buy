import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { TrafficSourceCategoryEntity, TopicCategory } from '../entity';

export class TrafficSourceCategoryRepository extends EntityRepository<TrafficSourceCategoryEntity> {
  constructor(em: EntityManager) {
    super(em, TrafficSourceCategoryEntity);
  }

  /**
   * Find all active categories ordered by sortOrder
   */
  async findAllActive(): Promise<TrafficSourceCategoryEntity[]> {
    return this.find({ isActive: true }, { orderBy: { sortOrder: 'ASC', name: 'ASC' } });
  }

  /**
   * Find category by slug
   */
  async findBySlug(slug: string): Promise<TrafficSourceCategoryEntity | null> {
    return this.findOne({ slug });
  }

  /**
   * Find category by category type
   */
  async findByCategoryType(categoryType: TopicCategory): Promise<TrafficSourceCategoryEntity | null> {
    return this.findOne({ categoryType });
  }

  /**
   * Find multiple categories by category types
   */
  async findByCategoryTypes(categoryTypes: TopicCategory[]): Promise<TrafficSourceCategoryEntity[]> {
    return this.find({ categoryType: { $in: categoryTypes }, isActive: true }, { orderBy: { sortOrder: 'ASC' } });
  }

  /**
   * Find category by ID
   */
  async findById(id: string): Promise<TrafficSourceCategoryEntity | null> {
    return this.findOne({ id });
  }

  /**
   * Get category stats
   */
  async getCategoryStats(): Promise<{ total: number; active: number }> {
    const [total, active] = await Promise.all([this.count(), this.count({ isActive: true })]);

    return { total, active };
  }

  /**
   * Find or create category by type
   * Creates a new category if it doesn't exist
   */
  async findOrCreateByType(
    categoryType: TopicCategory,
    defaultData?: { name: { en: string; ru?: string }; icon?: string; color?: string },
  ): Promise<TrafficSourceCategoryEntity> {
    const existing = await this.findByCategoryType(categoryType);

    if (existing) {
      return existing;
    }

    const em = this.em.fork();
    const defaultName = defaultData?.name?.en ?? categoryType;
    const ruName = defaultData?.name?.ru ?? categoryType;

    const category = new TrafficSourceCategoryEntity({
      name: {
        en: defaultName,
        es: undefined,
        fr: undefined,
        de: undefined,
        ru: ruName,
        zh: undefined,
        ja: undefined,
        ko: undefined,
      },
      slug: categoryType,
      categoryType,
      icon: defaultData?.icon,
      color: defaultData?.color,
      isActive: true,
      sortOrder: 0,
    });

    em.persist(category);
    await em.flush();

    return category;
  }
}
