import { Migration } from '@mikro-orm/migrations';

export class Migration20250908135425 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table "traffic_source_categories" ("id" uuid not null default gen_random_uuid_v7(), "name" jsonb not null, "slug" varchar(100) not null, "category_type" varchar(50) not null, "description" text null, "color" varchar(7) null, "icon" varchar(50) null, "sort_order" int not null default 0, "is_active" boolean not null default true, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "traffic_source_categories_pkey" primary key ("id"));`);
    this.addSql(`alter table "traffic_source_categories" add constraint "traffic_source_categories_slug_unique" unique ("slug");`);
    this.addSql(`create index "ix__traffic_source_categories__is_active" on "traffic_source_categories" ("is_active");`);
    this.addSql(`create index "ix__traffic_source_categories__category_type" on "traffic_source_categories" ("category_type");`);
    this.addSql(`create index "ix__traffic_source_categories__slug" on "traffic_source_categories" ("slug");`);
    this.addSql(`create index "ix__traffic_source_categories__name" on "traffic_source_categories" ("name");`);

    this.addSql(`create table "user_balance_history" ("id" uuid not null default gen_random_uuid_v7(), "user_id" uuid not null, "currency" varchar(10) not null, "type" varchar(20) not null, "amount" numeric(20,8) not null, "balance_before" numeric(20,8) not null, "balance_after" numeric(20,8) not null, "status" varchar(20) not null default 'pending', "description" text null, "tx_hash" varchar(128) null, "reference_id" varchar(64) null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "user_balance_history_pkey" primary key ("id"));`);
    this.addSql(`create index "ix__user_balance_history__created_at" on "user_balance_history" ("created_at");`);
    this.addSql(`create index "ix__user_balance_history__reference_id" on "user_balance_history" ("reference_id");`);
    this.addSql(`create index "ix__user_balance_history__status" on "user_balance_history" ("status");`);
    this.addSql(`create index "ix__user_balance_history__type" on "user_balance_history" ("type");`);
    this.addSql(`create index "ix__user_balance_history__currency" on "user_balance_history" ("currency");`);
    this.addSql(`create index "ix__user_balance_history__user_id" on "user_balance_history" ("user_id");`);

    this.addSql(`create table "traffic_sources" ("id" uuid not null default gen_random_uuid_v7(), "name" varchar(255) not null, "description" text null, "type" varchar(20) not null, "bot_token" text null, "bot_username" varchar(32) null, "telegram_id" bigint null, "is_active" boolean not null default true, "config" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "managed_by_id" uuid null, constraint "traffic_sources_pkey" primary key ("id"));`);
    this.addSql(`create index "ix__traffic_sources__bot_username" on "traffic_sources" ("bot_username");`);
    this.addSql(`create index "ix__traffic_sources__is_active" on "traffic_sources" ("is_active");`);
    this.addSql(`create index "ix__traffic_sources__type" on "traffic_sources" ("type");`);
    this.addSql(`create index "ix__traffic_sources__telegram_id" on "traffic_sources" ("telegram_id");`);

    this.addSql(`create table "traffic_users" ("id" uuid not null default gen_random_uuid_v7(), "telegram_id" bigint not null, "username" varchar(32) null, "first_name" varchar(64) not null, "last_name" varchar(64) null, "total_orders_participated" int not null default 0, "total_earnings" numeric(20,8) not null default '0', "completion_rate" numeric(5,2) not null default '0', "language_code" varchar(10) null, "is_bot" boolean not null default true, "can_join_groups" boolean not null default true, "can_receive_messages" boolean not null default false, "supports_inline_queries" boolean not null default false, "status" varchar(20) not null default 'active', "last_seen_at" timestamptz null, "joined_at" timestamptz not null default now(), "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "traffic_source_id" uuid not null, constraint "traffic_users_pkey" primary key ("id"));`);
    this.addSql(`alter table "traffic_users" add constraint "traffic_users_telegram_id_unique" unique ("telegram_id");`);
    this.addSql(`create index "ix__traffic_users__traffic_source_id" on "traffic_users" ("traffic_source_id");`);
    this.addSql(`create index "ix__traffic_users__status" on "traffic_users" ("status");`);
    this.addSql(`create index "ix__traffic_users__username" on "traffic_users" ("username");`);
    this.addSql(`create index "ix__traffic_users__telegram_id" on "traffic_users" ("telegram_id");`);

    this.addSql(`create table "traffic_target_users" ("id" uuid not null default gen_random_uuid_v7(), "traffic_target_id" uuid not null, "traffic_user_id" uuid not null, "can_view" boolean not null default true, "can_contact" boolean not null default false, "is_blocked" boolean not null default false, "first_interaction_date" timestamptz null, "last_interaction_date" timestamptz null, "total_interactions" int not null default 0, "total_orders_shared" int not null default 0, "notes" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "traffic_target_users_pkey" primary key ("id"));`);
    this.addSql(`create index "ix__traffic_target_users__is_blocked" on "traffic_target_users" ("is_blocked");`);
    this.addSql(`create index "ix__traffic_target_users__user_id" on "traffic_target_users" ("traffic_user_id");`);
    this.addSql(`create index "ix__traffic_target_users__target_id" on "traffic_target_users" ("traffic_target_id");`);
    this.addSql(`alter table "traffic_target_users" add constraint "uq__traffic_target_users__target_user" unique ("traffic_target_id", "traffic_user_id");`);

    this.addSql(`create table "traffic_target_sources" ("id" uuid not null default gen_random_uuid_v7(), "traffic_target_id" uuid not null, "traffic_source_id" uuid not null, "is_active" boolean not null default true, "contract_terms" jsonb null, "price_per_action" numeric(10,4) null, "minimum_order" int null, "maximum_order" int null, "agreement_start_date" timestamptz null, "agreement_end_date" timestamptz null, "last_order_date" timestamptz null, "total_orders_completed" int not null default 0, "total_amount_spent" numeric(15,4) not null default '0', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "traffic_target_sources_pkey" primary key ("id"));`);
    this.addSql(`create index "ix__traffic_target_sources__is_active" on "traffic_target_sources" ("is_active");`);
    this.addSql(`create index "ix__traffic_target_sources__source_id" on "traffic_target_sources" ("traffic_source_id");`);
    this.addSql(`create index "ix__traffic_target_sources__target_id" on "traffic_target_sources" ("traffic_target_id");`);
    this.addSql(`alter table "traffic_target_sources" add constraint "uq__traffic_target_sources__target_source" unique ("traffic_target_id", "traffic_source_id");`);

    this.addSql(`create table "traffic_source_categories_junction" ("id" uuid not null default gen_random_uuid_v7(), "traffic_source_id" uuid not null, "category_id" uuid not null, "is_primary" boolean not null default false, "sort_order" int not null default 0, "category_specific_config" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "traffic_source_categories_junction_pkey" primary key ("id"));`);
    this.addSql(`create index "ix__traffic_source_categories_junction__is_primary" on "traffic_source_categories_junction" ("is_primary");`);
    this.addSql(`create index "ix__traffic_source_categories_junction__category_id" on "traffic_source_categories_junction" ("category_id");`);
    this.addSql(`create index "ix__traffic_source_categories_junction__source_id" on "traffic_source_categories_junction" ("traffic_source_id");`);
    this.addSql(`alter table "traffic_source_categories_junction" add constraint "uq__traffic_source_categories_junction__source_category" unique ("traffic_source_id", "category_id");`);

    this.addSql(`create table "traffic_orders" ("id" uuid not null default gen_random_uuid_v7(), "order_id" varchar(64) not null, "type" varchar(20) not null, "status" varchar(20) not null, "target_count" int not null, "current_count" int not null default 0, "price_per_action" numeric(10,4) not null, "total_budget" numeric(15,4) not null, "spent_amount" numeric(15,4) not null default '0', "description" text null, "target_url" text null, "requirements" jsonb null, "start_date" timestamptz null, "end_date" timestamptz null, "completed_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "creator_id" uuid not null, "traffic_source_id" uuid not null, "traffic_target_id" uuid not null, "assigned_traffic_user_id" uuid null, "created_by_id" uuid null, constraint "traffic_orders_pkey" primary key ("id"));`);
    this.addSql(`alter table "traffic_orders" add constraint "traffic_orders_order_id_unique" unique ("order_id");`);
    this.addSql(`create index "ix__traffic_orders__created_by" on "traffic_orders" ("created_by_id");`);
    this.addSql(`create index "ix__traffic_orders__assigned_traffic_user_id" on "traffic_orders" ("assigned_traffic_user_id");`);
    this.addSql(`create index "ix__traffic_orders__traffic_target_id" on "traffic_orders" ("traffic_target_id");`);
    this.addSql(`create index "ix__traffic_orders__traffic_source_id" on "traffic_orders" ("traffic_source_id");`);
    this.addSql(`create index "ix__traffic_orders__creator_id" on "traffic_orders" ("creator_id");`);
    this.addSql(`create index "ix__traffic_orders__created_at" on "traffic_orders" ("created_at");`);
    this.addSql(`create index "ix__traffic_orders__type" on "traffic_orders" ("type");`);
    this.addSql(`create index "ix__traffic_orders__status" on "traffic_orders" ("status");`);
    this.addSql(`create index "ix__traffic_orders__order_id" on "traffic_orders" ("order_id");`);

    this.addSql(`create table "traffic_actions" ("id" uuid not null default gen_random_uuid_v7(), "action_id" varchar(64) not null, "type" varchar(20) not null, "status" varchar(20) not null, "description" text null, "target_url" text null, "action_data" jsonb null, "reward" numeric(10,4) not null default '0', "scheduled_at" timestamptz null, "started_at" timestamptz null, "completed_at" timestamptz null, "failed_at" timestamptz null, "failure_reason" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "traffic_order_id" uuid null, "traffic_source_id" uuid not null, constraint "traffic_actions_pkey" primary key ("id"));`);
    this.addSql(`alter table "traffic_actions" add constraint "traffic_actions_action_id_unique" unique ("action_id");`);
    this.addSql(`create index "traffic_actions_traffic_order_id_index" on "traffic_actions" ("traffic_order_id");`);
    this.addSql(`create index "traffic_actions_traffic_source_id_index" on "traffic_actions" ("traffic_source_id");`);
    this.addSql(`create index "ix__traffic_actions__scheduled_at" on "traffic_actions" ("scheduled_at");`);
    this.addSql(`create index "ix__traffic_actions__type" on "traffic_actions" ("type");`);
    this.addSql(`create index "ix__traffic_actions__status" on "traffic_actions" ("status");`);
    this.addSql(`create index "ix__traffic_actions__action_id" on "traffic_actions" ("action_id");`);

    this.addSql(`create table "traffic_actions_users" ("id" uuid not null default gen_random_uuid_v7(), "traffic_action_id" uuid not null, "traffic_user_id" uuid not null, "participation_date" timestamptz null, "is_completed" boolean not null default false, "completed_at" timestamptz null, "reward" numeric(10,4) null, "notes" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "traffic_actions_users_pkey" primary key ("id"));`);
    this.addSql(`create index "ix__traffic_actions_users__is_completed" on "traffic_actions_users" ("is_completed");`);
    this.addSql(`create index "ix__traffic_actions_users__user_id" on "traffic_actions_users" ("traffic_user_id");`);
    this.addSql(`create index "ix__traffic_actions_users__action_id" on "traffic_actions_users" ("traffic_action_id");`);
    this.addSql(`alter table "traffic_actions_users" add constraint "uq__traffic_actions_users__action_user" unique ("traffic_action_id", "traffic_user_id");`);

    this.addSql(`create table "user_last_auth" ("id" uuid not null default gen_random_uuid_v7(), "ip" inet null, "country" varchar(255) null, "city" varchar(255) null, "continent" varchar(255) null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "user_id" uuid not null, constraint "user_last_auth_pkey" primary key ("id"));`);
    this.addSql(`alter table "user_last_auth" add constraint "user_last_auth_user_id_unique" unique ("user_id");`);
    this.addSql(`create index "ix__user_last_auth__user_id" on "user_last_auth" ("user_id");`);
    this.addSql(`alter table "user_last_auth" add constraint "user_last_auth_user_id_unique" unique ("user_id");`);

    this.addSql(`create table "user_ref_links" ("id" uuid not null default gen_random_uuid_v7(), "type" varchar(50) not null, "source_type" varchar(50) null, "source_id" uuid null, "user_id" uuid not null, "ref_code" varchar(50) not null, "ref_code_unique_key" varchar(100) not null, "default_unique_key" varchar(100) not null, "ref_percent_level_1" numeric(5,2) not null, "ref_percent_level_2" numeric(5,2) not null, "ref_percent_level_3" numeric(5,2) not null, "is_default" boolean not null default false, "is_custom" boolean not null default false, "is_deleted" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "user_ref_links_pkey" primary key ("id"));`);
    this.addSql(`create index "ix__user_ref_links__user_id" on "user_ref_links" ("user_id");`);
    this.addSql(`create index "ix__user_ref_links__ref_code" on "user_ref_links" ("ref_code");`);
    this.addSql(`alter table "user_ref_links" add constraint "uq__user_ref_links__default_default_unique_key" unique ("is_default", "default_unique_key");`);
    this.addSql(`alter table "user_ref_links" add constraint "uq__user_ref_links__ref_code_ref_code_unique_key" unique ("ref_code", "ref_code_unique_key");`);

    this.addSql(`create table "user_settings" ("id" uuid not null default gen_random_uuid_v7(), "user_id" uuid not null, "key" varchar(64) not null, "value" text not null, "type" varchar(10) not null default 'string', "description" text null, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "user_settings_pkey" primary key ("id"));`);
    this.addSql(`create index "ix__user_settings__is_active" on "user_settings" ("is_active");`);
    this.addSql(`create index "ix__user_settings__key" on "user_settings" ("key");`);
    this.addSql(`create index "ix__user_settings__user_id" on "user_settings" ("user_id");`);
    this.addSql(`alter table "user_settings" add constraint "uq__user_settings__user_key" unique ("user_id", "key");`);

    this.addSql(`create table "user_source_visits" ("id" uuid not null default gen_random_uuid_v7(), "created_at" timestamptz not null default now(), "is_signup" boolean not null default false, "platform_type" varchar(20) not null, "platform_data" jsonb null, "params" text null, "utm_source" varchar(255) null, "utm_medium" varchar(255) null, "utm_campaign" varchar(255) null, "utm_content" varchar(255) null, "link_type" varchar(255) null, "link_code" varchar(255) null, "language" varchar(10) null, "telegram_language" varchar(10) null, "continent" varchar(64) null, "country" varchar(64) null, "city" varchar(128) null, "ip" inet null, "user_id" uuid not null, "link_user_id" uuid null, constraint "user_source_visits_pkey" primary key ("id"));`);
    this.addSql(`create index "ix__user_source_visits__platform_type" on "user_source_visits" ("platform_type");`);
    this.addSql(`create index "ix__user_source_visits__utm_campaign" on "user_source_visits" ("utm_campaign");`);
    this.addSql(`create index "ix__user_source_visits__utm_medium" on "user_source_visits" ("utm_medium");`);
    this.addSql(`create index "ix__user_source_visits__utm_source" on "user_source_visits" ("utm_source");`);
    this.addSql(`create index "ix__user_source_visits__created_at" on "user_source_visits" ("created_at");`);

    this.addSql(`create table "user_traffic_orders" ("id" uuid not null default gen_random_uuid_v7(), "user_id" uuid not null, "traffic_order_id" uuid not null, "role" varchar(20) not null, "can_edit" boolean not null default true, "can_view" boolean not null default true, "can_approve" boolean not null default false, "assigned_at" timestamptz null, "assigned_by_id" uuid null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "user_traffic_orders_pkey" primary key ("id"));`);
    this.addSql(`create index "ix__user_traffic_orders__role" on "user_traffic_orders" ("role");`);
    this.addSql(`create index "ix__user_traffic_orders__order_id" on "user_traffic_orders" ("traffic_order_id");`);
    this.addSql(`create index "ix__user_traffic_orders__user_id" on "user_traffic_orders" ("user_id");`);
    this.addSql(`alter table "user_traffic_orders" add constraint "uq__user_traffic_orders__user_order" unique ("user_id", "traffic_order_id");`);

    this.addSql(`create table "user_traffic_sources" ("id" uuid not null default gen_random_uuid_v7(), "user_id" uuid not null, "traffic_source_id" uuid not null, "role" varchar(20) not null, "is_active" boolean not null default true, "permissions" jsonb null, "assigned_at" timestamptz null, "assigned_by_id" uuid null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "user_traffic_sources_pkey" primary key ("id"));`);
    this.addSql(`create index "ix__user_traffic_sources__is_active" on "user_traffic_sources" ("is_active");`);
    this.addSql(`create index "ix__user_traffic_sources__role" on "user_traffic_sources" ("role");`);
    this.addSql(`create index "ix__user_traffic_sources__source_id" on "user_traffic_sources" ("traffic_source_id");`);
    this.addSql(`create index "ix__user_traffic_sources__user_id" on "user_traffic_sources" ("user_id");`);
    this.addSql(`alter table "user_traffic_sources" add constraint "uq__user_traffic_sources__user_source" unique ("user_id", "traffic_source_id");`);

    this.addSql(`create table "user_traffic_targets" ("id" uuid not null default gen_random_uuid_v7(), "user_id" uuid not null, "traffic_target_id" uuid not null, "role" varchar(20) not null, "is_active" boolean not null default true, "permissions" jsonb null, "assigned_at" timestamptz null, "assigned_by_id" uuid null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), constraint "user_traffic_targets_pkey" primary key ("id"));`);
    this.addSql(`create index "ix__user_traffic_targets__is_active" on "user_traffic_targets" ("is_active");`);
    this.addSql(`create index "ix__user_traffic_targets__role" on "user_traffic_targets" ("role");`);
    this.addSql(`create index "ix__user_traffic_targets__target_id" on "user_traffic_targets" ("traffic_target_id");`);
    this.addSql(`create index "ix__user_traffic_targets__user_id" on "user_traffic_targets" ("user_id");`);
    this.addSql(`alter table "user_traffic_targets" add constraint "uq__user_traffic_targets__user_target" unique ("user_id", "traffic_target_id");`);

    this.addSql(`alter table "user_balance_history" add constraint "user_balance_history_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);

    this.addSql(`alter table "traffic_sources" add constraint "traffic_sources_managed_by_id_foreign" foreign key ("managed_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "traffic_users" add constraint "traffic_users_traffic_source_id_foreign" foreign key ("traffic_source_id") references "traffic_sources" ("id") on update cascade;`);

    this.addSql(`alter table "traffic_target_users" add constraint "traffic_target_users_traffic_target_id_foreign" foreign key ("traffic_target_id") references "traffic_targets" ("id") on update cascade;`);
    this.addSql(`alter table "traffic_target_users" add constraint "traffic_target_users_traffic_user_id_foreign" foreign key ("traffic_user_id") references "traffic_users" ("id") on update cascade;`);

    this.addSql(`alter table "traffic_target_sources" add constraint "traffic_target_sources_traffic_target_id_foreign" foreign key ("traffic_target_id") references "traffic_targets" ("id") on update cascade;`);
    this.addSql(`alter table "traffic_target_sources" add constraint "traffic_target_sources_traffic_source_id_foreign" foreign key ("traffic_source_id") references "traffic_sources" ("id") on update cascade;`);

    this.addSql(`alter table "traffic_source_categories_junction" add constraint "traffic_source_categories_junction_traffic_source_id_foreign" foreign key ("traffic_source_id") references "traffic_sources" ("id") on update cascade;`);
    this.addSql(`alter table "traffic_source_categories_junction" add constraint "traffic_source_categories_junction_category_id_foreign" foreign key ("category_id") references "traffic_source_categories" ("id") on update cascade;`);

    this.addSql(`alter table "traffic_orders" add constraint "traffic_orders_creator_id_foreign" foreign key ("creator_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "traffic_orders" add constraint "traffic_orders_traffic_source_id_foreign" foreign key ("traffic_source_id") references "traffic_sources" ("id") on update cascade;`);
    this.addSql(`alter table "traffic_orders" add constraint "traffic_orders_traffic_target_id_foreign" foreign key ("traffic_target_id") references "traffic_targets" ("id") on update cascade;`);
    this.addSql(`alter table "traffic_orders" add constraint "traffic_orders_assigned_traffic_user_id_foreign" foreign key ("assigned_traffic_user_id") references "traffic_users" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "traffic_orders" add constraint "traffic_orders_created_by_id_foreign" foreign key ("created_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "traffic_actions" add constraint "traffic_actions_traffic_order_id_foreign" foreign key ("traffic_order_id") references "traffic_orders" ("id") on update cascade on delete set null;`);
    this.addSql(`alter table "traffic_actions" add constraint "traffic_actions_traffic_source_id_foreign" foreign key ("traffic_source_id") references "traffic_sources" ("id") on update cascade;`);

    this.addSql(`alter table "traffic_actions_users" add constraint "traffic_actions_users_traffic_action_id_foreign" foreign key ("traffic_action_id") references "traffic_actions" ("id") on update cascade;`);
    this.addSql(`alter table "traffic_actions_users" add constraint "traffic_actions_users_traffic_user_id_foreign" foreign key ("traffic_user_id") references "traffic_users" ("id") on update cascade;`);

    this.addSql(`alter table "user_last_auth" add constraint "user_last_auth_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);

    this.addSql(`alter table "user_ref_links" add constraint "user_ref_links_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);

    this.addSql(`alter table "user_settings" add constraint "user_settings_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);

    this.addSql(`alter table "user_source_visits" add constraint "user_source_visits_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "user_source_visits" add constraint "user_source_visits_link_user_id_foreign" foreign key ("link_user_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "user_traffic_orders" add constraint "user_traffic_orders_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "user_traffic_orders" add constraint "user_traffic_orders_traffic_order_id_foreign" foreign key ("traffic_order_id") references "traffic_orders" ("id") on update cascade;`);
    this.addSql(`alter table "user_traffic_orders" add constraint "user_traffic_orders_assigned_by_id_foreign" foreign key ("assigned_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "user_traffic_sources" add constraint "user_traffic_sources_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "user_traffic_sources" add constraint "user_traffic_sources_traffic_source_id_foreign" foreign key ("traffic_source_id") references "traffic_sources" ("id") on update cascade;`);
    this.addSql(`alter table "user_traffic_sources" add constraint "user_traffic_sources_assigned_by_id_foreign" foreign key ("assigned_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "user_traffic_targets" add constraint "user_traffic_targets_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "user_traffic_targets" add constraint "user_traffic_targets_traffic_target_id_foreign" foreign key ("traffic_target_id") references "traffic_targets" ("id") on update cascade;`);
    this.addSql(`alter table "user_traffic_targets" add constraint "user_traffic_targets_assigned_by_id_foreign" foreign key ("assigned_by_id") references "users" ("id") on update cascade on delete set null;`);

    this.addSql(`alter table "users" drop constraint "fk__users__ref_link_level_1";`);
    this.addSql(`alter table "users" drop constraint "fk__users__ref_link_level_2";`);
    this.addSql(`alter table "users" drop constraint "fk__users__ref_link_level_3";`);
    this.addSql(`alter table "users" drop constraint "fk__users__referred_by";`);

    this.addSql(`alter table "user_balances" drop constraint "fk__user_balances__user_id";`);

    this.addSql(`alter table "traffic_targets" drop constraint "fk__traffic_targets__managed_by_id";`);

    this.addSql(`alter table "users" alter column "id" drop default;`);
    this.addSql(`alter table "users" alter column "id" type uuid using ("id"::text::uuid);`);
    this.addSql(`alter table "users" alter column "id" set default gen_random_uuid_v7();`);
    this.addSql(`alter table "users" drop constraint "users_telegram_id_key";`);
    this.addSql(`alter table "users" add constraint "users_telegram_id_unique" unique ("telegram_id");`);

    this.addSql(`alter table "user_balances" drop column "reserved";`);

    this.addSql(`alter table "user_balances" add column "locked_balance" numeric(20,8) not null default '0';`);
    this.addSql(`alter table "user_balances" alter column "id" drop default;`);
    this.addSql(`alter table "user_balances" alter column "id" type uuid using ("id"::text::uuid);`);
    this.addSql(`alter table "user_balances" alter column "id" set default gen_random_uuid_v7();`);
    this.addSql(`alter table "user_balances" alter column "balance" type numeric(20,8) using ("balance"::numeric(20,8));`);
    this.addSql(`alter table "user_balances" alter column "balance" set default '0';`);
    this.addSql(`alter table "user_balances" alter column "currency" drop default;`);
    this.addSql(`alter table "user_balances" alter column "currency" type varchar(10) using ("currency"::varchar(10));`);
    this.addSql(`alter table "user_balances" add constraint "user_balances_user_id_foreign" foreign key ("user_id") references "users" ("id") on update cascade;`);
    this.addSql(`alter table "user_balances" add constraint "uq__user_balances__user_currency" unique ("user_id", "currency");`);

    this.addSql(`alter table "traffic_targets" alter column "id" drop default;`);
    this.addSql(`alter table "traffic_targets" alter column "id" type uuid using ("id"::text::uuid);`);
    this.addSql(`alter table "traffic_targets" alter column "id" set default gen_random_uuid_v7();`);
    this.addSql(`alter table "traffic_targets" add constraint "traffic_targets_managed_by_id_foreign" foreign key ("managed_by_id") references "users" ("id") on update cascade on delete set null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "traffic_source_categories_junction" drop constraint "traffic_source_categories_junction_category_id_foreign";`);

    this.addSql(`alter table "traffic_users" drop constraint "traffic_users_traffic_source_id_foreign";`);

    this.addSql(`alter table "traffic_target_sources" drop constraint "traffic_target_sources_traffic_source_id_foreign";`);

    this.addSql(`alter table "traffic_source_categories_junction" drop constraint "traffic_source_categories_junction_traffic_source_id_foreign";`);

    this.addSql(`alter table "traffic_orders" drop constraint "traffic_orders_traffic_source_id_foreign";`);

    this.addSql(`alter table "traffic_actions" drop constraint "traffic_actions_traffic_source_id_foreign";`);

    this.addSql(`alter table "user_traffic_sources" drop constraint "user_traffic_sources_traffic_source_id_foreign";`);

    this.addSql(`alter table "traffic_target_users" drop constraint "traffic_target_users_traffic_user_id_foreign";`);

    this.addSql(`alter table "traffic_orders" drop constraint "traffic_orders_assigned_traffic_user_id_foreign";`);

    this.addSql(`alter table "traffic_actions_users" drop constraint "traffic_actions_users_traffic_user_id_foreign";`);

    this.addSql(`alter table "traffic_actions" drop constraint "traffic_actions_traffic_order_id_foreign";`);

    this.addSql(`alter table "user_traffic_orders" drop constraint "user_traffic_orders_traffic_order_id_foreign";`);

    this.addSql(`alter table "traffic_actions_users" drop constraint "traffic_actions_users_traffic_action_id_foreign";`);

    this.addSql(`alter table "traffic_targets" drop constraint "traffic_targets_managed_by_id_foreign";`);

    this.addSql(`alter table "user_balances" drop constraint "user_balances_user_id_foreign";`);

    this.addSql(`alter table "traffic_targets" alter column "id" drop default;`);
    this.addSql(`alter table "traffic_targets" alter column "id" type uuid using ("id"::text::uuid);`);
    this.addSql(`alter table "traffic_targets" alter column "id" set default uuidv7();`);

    this.addSql(`alter table "user_balances" drop constraint "uq__user_balances__user_currency";`);
    this.addSql(`alter table "user_balances" drop column "locked_balance";`);

    this.addSql(`alter table "user_balances" add column "reserved" numeric(15,4) not null default 0;`);
    this.addSql(`alter table "user_balances" alter column "id" drop default;`);
    this.addSql(`alter table "user_balances" alter column "id" type uuid using ("id"::text::uuid);`);
    this.addSql(`alter table "user_balances" alter column "id" set default uuidv7();`);
    this.addSql(`alter table "user_balances" alter column "currency" type varchar(3) using ("currency"::varchar(3));`);
    this.addSql(`alter table "user_balances" alter column "currency" set default 'USD';`);
    this.addSql(`alter table "user_balances" alter column "balance" type numeric(15,4) using ("balance"::numeric(15,4));`);
    this.addSql(`alter table "user_balances" alter column "balance" set default 0;`);

    this.addSql(`alter table "users" alter column "id" drop default;`);
    this.addSql(`alter table "users" alter column "id" type uuid using ("id"::text::uuid);`);
    this.addSql(`alter table "users" alter column "id" set default uuidv7();`);
    this.addSql(`alter table "users" drop constraint "users_telegram_id_unique";`);
    this.addSql(`alter table "users" add constraint "users_telegram_id_key" unique ("telegram_id");`);
  }

}
