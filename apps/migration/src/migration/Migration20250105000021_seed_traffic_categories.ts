import { Migration } from '@mikro-orm/migrations';

/**
 * Seed traffic_source_categories with all TopicCategory values
 */
export class Migration20250105000021SeedTrafficCategories extends Migration {
  override async up(): Promise<void> {
    const categories = [
      { slug: 'other', name: { en: 'Other', ru: 'Другое' } },
      { slug: 'blogs', name: { en: 'Blogs', ru: 'Блоги' } },
      { slug: 'news', name: { en: 'News', ru: 'Новости' } },
      { slug: 'commerce', name: { en: 'Commerce', ru: 'Коммерция' } },
      { slug: 'useful', name: { en: 'Useful', ru: 'Полезное' } },
      { slug: 'elders', name: { en: 'Elders', ru: 'Для старшего поколения' } },
      { slug: 'entertainment', name: { en: 'Entertainment', ru: 'Развлечения' } },
      { slug: 'cryptocurrencies', name: { en: 'Cryptocurrencies', ru: 'Криптовалюты' } },
      { slug: 'earnings', name: { en: 'Earnings', ru: 'Заработок' } },
      { slug: 'quotes', name: { en: 'Quotes', ru: 'Цитаты' } },
      { slug: 'music', name: { en: 'Music', ru: 'Музыка' } },
      { slug: 'womens', name: { en: "Women's", ru: 'Женское' } },
      { slug: 'astrology', name: { en: 'Astrology', ru: 'Астрология' } },
      { slug: 'educational', name: { en: 'Educational', ru: 'Образование' } },
      { slug: 'adult_18_plus', name: { en: 'Adult 18+', ru: 'Для взрослых 18+' } },
      { slug: 'psychology', name: { en: 'Psychology', ru: 'Психология' } },
      { slug: 'chats', name: { en: 'Chats', ru: 'Чаты' } },
      { slug: 'betting', name: { en: 'Betting', ru: 'Ставки' } },
      { slug: 'creativity_and_design', name: { en: 'Creativity & Design', ru: 'Творчество и дизайн' } },
      { slug: 'neural_networks', name: { en: 'Neural Networks', ru: 'Нейросети' } },
      { slug: 'sports', name: { en: 'Sports', ru: 'Спорт' } },
      { slug: 'auto', name: { en: 'Auto', ru: 'Авто' } },
      { slug: 'movies', name: { en: 'Movies', ru: 'Фильмы' } },
      { slug: 'health', name: { en: 'Health', ru: 'Здоровье' } },
      { slug: 'travel', name: { en: 'Travel', ru: 'Путешествия' } },
      { slug: 'cooking_food', name: { en: 'Cooking & Food', ru: 'Кулинария' } },
      { slug: 'tools', name: { en: 'Tools', ru: 'Инструменты' } },
      { slug: 'communication', name: { en: 'Communication', ru: 'Общение' } },
      { slug: 'mens', name: { en: "Men's", ru: 'Мужское' } },
      { slug: 'technologies', name: { en: 'Technologies', ru: 'Технологии' } },
      { slug: 'downloads', name: { en: 'Downloads', ru: 'Загрузки' } },
      { slug: 'auctions', name: { en: 'Auctions', ru: 'Аукционы' } },
      { slug: 'video', name: { en: 'Video', ru: 'Видео' } },
      { slug: 'trash', name: { en: 'Trash', ru: 'Мусор' } },
      { slug: 'stickers_themes', name: { en: 'Stickers & Themes', ru: 'Стикеры и темы' } },
      { slug: 'economics', name: { en: 'Economics', ru: 'Экономика' } },
      { slug: 'spam', name: { en: 'Spam', ru: 'Спам' } },
      { slug: 'dating', name: { en: 'Dating', ru: 'Знакомства' } },
      { slug: 'subscriptions', name: { en: 'Subscriptions', ru: 'Подписки' } },
      { slug: 'applications', name: { en: 'Applications', ru: 'Приложения' } },
      { slug: 'gai_traffic_police', name: { en: 'Traffic Police', ru: 'ГАИ' } },
      { slug: 'gambling', name: { en: 'Gambling', ru: 'Азартные игры' } },
      { slug: 'folders', name: { en: 'Folders', ru: 'Папки' } },
    ];

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      this.addSql(`
        INSERT INTO traffic_source_categories (id, name, slug, category_type, is_active, sort_order, created_at, updated_at)
        VALUES (
          uuidv7(),
          '${JSON.stringify(cat.name).replace(/'/g, "''")}',
          '${cat.slug}',
          '${cat.slug}',
          true,
          ${i + 1},
          now(),
          now()
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          category_type = EXCLUDED.category_type,
          sort_order = EXCLUDED.sort_order,
          updated_at = now();
      `);
    }
  }

  override async down(): Promise<void> {
    this.addSql(`DELETE FROM traffic_source_categories WHERE category_type IS NOT NULL;`);
  }
}
