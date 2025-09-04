import { Migration } from '@mikro-orm/migrations';

export class Migration20250904000001 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "users" add column "ref_link_level_1" uuid null;');
    this.addSql('alter table "users" add column "ref_link_level_2" uuid null;');
    this.addSql('alter table "users" add column "ref_link_level_3" uuid null;');

    this.addSql('alter table "users" add constraint "users_ref_link_level_1_foreign" foreign key ("ref_link_level_1") references "user_ref_links" ("id") on update cascade on delete set null;');
    this.addSql('alter table "users" add constraint "users_ref_link_level_2_foreign" foreign key ("ref_link_level_2") references "user_ref_links" ("id") on update cascade on delete set null;');
    this.addSql('alter table "users" add constraint "users_ref_link_level_3_foreign" foreign key ("ref_link_level_3") references "user_ref_links" ("id") on update cascade on delete set null;');
  }

  async down(): Promise<void> {
    this.addSql('alter table "users" drop constraint if exists "users_ref_link_level_1_foreign";');
    this.addSql('alter table "users" drop constraint if exists "users_ref_link_level_2_foreign";');
    this.addSql('alter table "users" drop constraint if exists "users_ref_link_level_3_foreign";');

    this.addSql('alter table "users" drop column if exists "ref_link_level_1";');
    this.addSql('alter table "users" drop column if exists "ref_link_level_2";');
    this.addSql('alter table "users" drop column if exists "ref_link_level_3";');
  }

}