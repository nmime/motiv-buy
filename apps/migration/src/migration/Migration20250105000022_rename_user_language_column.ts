import { Migration } from '@mikro-orm/migrations';

/**
 * Rename User Language Column Migration
 *
 * Renames the column from language_code to language in the users table.
 * This aligns the database schema with the entity property naming.
 */
export class Migration20250105000022RenameUserLanguageColumn extends Migration {
  async up(): Promise<void> {
    this.addSql('ALTER TABLE users RENAME COLUMN language_code TO language;');

    await Promise.resolve();
  }

  async down(): Promise<void> {
    this.addSql('ALTER TABLE users RENAME COLUMN language TO language_code;');

    await Promise.resolve();
  }
}
