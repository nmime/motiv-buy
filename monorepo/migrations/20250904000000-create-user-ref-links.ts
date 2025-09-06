import { Migration } from '@mikro-orm/migrations';

export class Migration20250904000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table "user_ref_links" ("id" uuid not null default gen_random_uuid_v7(), "type" varchar(50) not null, "source_type" varchar(50) null, "source_id" uuid null, "user_id" uuid not null, "ref_code" varchar(50) not null, "ref_code_unique_key" varchar(100) not null, "default_unique_key" varchar(100) not null, "ref_percent_level_1" decimal(5,2) not null, "ref_percent_level_2" decimal(5,2) not null, "ref_percent_level_3" decimal(5,2) not null, "is_default" boolean not null default false, "is_custom" boolean not null default false, "is_deleted" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "user_ref_links_pkey" primary key ("id"));',
    );

    this.addSql('create index "ix__user_ref_links__ref_code" on "user_ref_links" ("ref_code");');
    this.addSql('create index "ix__user_ref_links__user_id" on "user_ref_links" ("user_id");');

    this.addSql(
      'alter table "user_ref_links" add constraint "uq__user_ref_links__ref_code_ref_code_unique_key" unique ("ref_code", "ref_code_unique_key");',
    );
    this.addSql(
      'alter table "user_ref_links" add constraint "uq__user_ref_links__default_default_unique_key" unique ("is_default", "default_unique_key");',
    );

    this.addSql(
      'alter table "user_ref_links" add constraint "user_ref_links_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;',
    );
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "user_ref_links" cascade;');
  }
}
