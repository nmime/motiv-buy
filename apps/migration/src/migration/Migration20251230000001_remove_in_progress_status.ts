import { Migration } from '@mikro-orm/migrations';

/**
 * Remove InProgress Status Migration
 *
 * Updates all traffic orders with 'in_progress' status to 'active' status.
 * This simplifies the order status flow by merging InProgress into Active.
 */
export class Migration20251230000001RemoveInProgressStatus extends Migration {
  async up(): Promise<void> {
    this.addSql(`UPDATE traffic_orders SET status = 'active' WHERE status = 'in_progress';`);

    await Promise.resolve();
  }

  async down(): Promise<void> {
    // Cannot restore in_progress status automatically - would need business logic to determine
    // which active orders should be in_progress
    await Promise.resolve();
  }
}
