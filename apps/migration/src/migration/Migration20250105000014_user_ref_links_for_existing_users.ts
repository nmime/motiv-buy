import { Migration } from '@mikro-orm/migrations';
import { randomBytes } from 'crypto';

/**
 * Create UserRefLinks for existing users who don't have one
 * This ensures all users have a proper referral code
 */
export class Migration20250105000014UserRefLinksForExistingUsers extends Migration {
  async up(): Promise<void> {
    // Get all users who don't have a default UserRefLink
    const usersWithoutRefLink = await this.execute(`
      SELECT u.id
      FROM users u
      LEFT JOIN user_ref_links url ON url.user_id = u.id AND url.is_default = true AND url.is_deleted = false
      WHERE url.id IS NULL
    `);

    const users = usersWithoutRefLink as Array<{ id: string }>;
    const level2Percent = '1.00'; // 10% / 10

    const insertPromises = users.map((user) => {
      const refCode = this.generateRefCode(10);

      return this.execute(
        `
        INSERT INTO user_ref_links (
          id, type, user_id, ref_code, ref_code_unique_key, default_unique_key,
          ref_percent_level_1, ref_percent_level_2, ref_percent_level_3,
          is_default, is_custom, is_deleted, created_at, updated_at
        ) VALUES (
          uuidv7(), 'user', ?, ?, ?, ?,
          '10.00', '${level2Percent}', '0.00',
          true, false, false, now(), now()
        )
      `,
        [user.id, refCode, refCode, user.id],
      );
    });

    await Promise.all(insertPromises);
  }

  async down(): Promise<void> {
    // Remove all default UserRefLinks that were created by this migration
    // We can identify them as default links with is_custom = false
    await this.execute(`
      DELETE FROM user_ref_links
      WHERE is_default = true AND is_custom = false
    `);
  }

  private generateRefCode(length = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomArray = randomBytes(length);

    for (let i = 0; i < length; i++) {
      result += chars[randomArray[i] % chars.length];
    }

    return result;
  }
}
