/**
 * AlbaChat — İlk Veritabanı Şeması
 * 14 tablo: users, refresh_tokens, groups, group_members, messages,
 * message_reads, files, announcements, announcement_groups,
 * announcement_reads, file_cleanup_policies, system_settings,
 * audit_logs, notifications
 */

export async function up(knex) {
  // ─── users ────────────────────────────────────────────────────────────────
  await knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.string('username', 64).notNullable().unique();
    t.string('email', 255).notNullable().unique();
    t.string('password_hash', 255).notNullable();
    t.string('display_name', 128).notNullable();
    t.string('avatar_url', 500).nullable();
    t.enu('role', ['admin', 'user']).notNullable().defaultTo('user');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.boolean('is_online').notNullable().defaultTo(false);
    t.timestamp('last_seen').nullable();
    t.string('timezone', 64).notNullable().defaultTo('Europe/Istanbul');
    t.integer('last_seen_message_id').nullable();
    t.timestamps(true, true);
  });

  // ─── refresh_tokens ───────────────────────────────────────────────────────
  await knex.schema.createTable('refresh_tokens', (t) => {
    t.increments('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('token_hash', 255).notNullable().unique();
    t.string('jti', 36).notNullable().unique(); // UUID
    t.timestamp('expires_at').notNullable();
    t.boolean('revoked').notNullable().defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['user_id']);
    t.index(['jti']);
  });

  // ─── groups ───────────────────────────────────────────────────────────────
  await knex.schema.createTable('groups', (t) => {
    t.increments('id').primary();
    t.string('name', 128).notNullable();
    t.text('description').nullable();
    t.enu('type', ['direct', 'department', 'private']).notNullable().defaultTo('private');
    t.string('department_code', 64).nullable();
    t.integer('created_by').notNullable().references('id').inTable('users');
    t.boolean('is_archived').notNullable().defaultTo(false);
    t.timestamps(true, true);
    t.index(['type']);
    t.index(['department_code']);
  });

  // ─── group_members ────────────────────────────────────────────────────────
  await knex.schema.createTable('group_members', (t) => {
    t.increments('id').primary();
    t.integer('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE');
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.enu('role', ['owner', 'admin', 'member']).notNullable().defaultTo('member');
    t.timestamp('joined_at').defaultTo(knex.fn.now());
    t.integer('added_by').nullable().references('id').inTable('users');
    t.unique(['group_id', 'user_id']);
    t.index(['user_id']);
    t.index(['group_id']);
  });

  // ─── messages ─────────────────────────────────────────────────────────────
  await knex.schema.createTable('messages', (t) => {
    t.increments('id').primary();
    t.integer('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE');
    t.integer('sender_id').notNullable().references('id').inTable('users');
    t.text('content').nullable();
    t.enu('type', ['text', 'image', 'file', 'system']).notNullable().defaultTo('text');
    t.integer('file_id').nullable(); // files tablosuna FK sonra eklenir
    t.integer('reply_to_id').nullable().references('id').inTable('messages');
    t.string('idempotency_key', 36).notNullable().unique(); // UUID
    t.boolean('is_deleted').notNullable().defaultTo(false);
    t.timestamps(true, true);
    t.index(['group_id', 'created_at']);
    t.index(['sender_id']);
    t.index(['idempotency_key']);
  });

  // ─── message_reads ────────────────────────────────────────────────────────
  await knex.schema.createTable('message_reads', (t) => {
    t.increments('id').primary();
    t.integer('message_id').notNullable().references('id').inTable('messages').onDelete('CASCADE');
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.timestamp('read_at').defaultTo(knex.fn.now());
    t.unique(['message_id', 'user_id']);
    t.index(['message_id', 'user_id']);
  });

  // ─── files ────────────────────────────────────────────────────────────────
  await knex.schema.createTable('files', (t) => {
    t.increments('id').primary();
    t.string('original_name', 255).notNullable();
    t.string('mime_type', 128).notNullable();
    t.bigInteger('size_bytes').notNullable();
    t.string('storage_path', 500).notNullable();
    t.string('storage_bucket', 128).notNullable();
    t.integer('uploaded_by').notNullable().references('id').inTable('users');
    t.integer('group_id').notNullable().references('id').inTable('groups');
    t.boolean('is_deleted').notNullable().defaultTo(false);
    t.timestamp('deleted_at').nullable();
    t.timestamps(true, true);
    t.index(['group_id']);
    t.index(['uploaded_by']);
    t.index(['is_deleted', 'created_at']);
  });

  // messages.file_id FK (files tablosu oluşturulduktan sonra)
  await knex.schema.alterTable('messages', (t) => {
    t.foreign('file_id').references('id').inTable('files');
  });

  // ─── announcements ────────────────────────────────────────────────────────
  await knex.schema.createTable('announcements', (t) => {
    t.increments('id').primary();
    t.string('title', 255).notNullable();
    t.text('content').notNullable();
    t.enu('scope', ['global', 'group']).notNullable().defaultTo('global');
    t.enu('priority', ['normal', 'urgent']).notNullable().defaultTo('normal');
    t.integer('created_by').notNullable().references('id').inTable('users');
    t.timestamp('expires_at').nullable();
    t.timestamps(true, true);
    t.index(['scope', 'created_at']);
  });

  // ─── announcement_groups ──────────────────────────────────────────────────
  await knex.schema.createTable('announcement_groups', (t) => {
    t.increments('id').primary();
    t.integer('announcement_id').notNullable().references('id').inTable('announcements').onDelete('CASCADE');
    t.integer('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE');
    t.unique(['announcement_id', 'group_id']);
  });

  // ─── announcement_reads ───────────────────────────────────────────────────
  await knex.schema.createTable('announcement_reads', (t) => {
    t.increments('id').primary();
    t.integer('announcement_id').notNullable().references('id').inTable('announcements').onDelete('CASCADE');
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.timestamp('read_at').defaultTo(knex.fn.now());
    t.unique(['announcement_id', 'user_id']);
    t.index(['user_id']);
  });

  // ─── file_cleanup_policies ────────────────────────────────────────────────
  await knex.schema.createTable('file_cleanup_policies', (t) => {
    t.increments('id').primary();
    t.string('name', 128).notNullable();
    t.integer('max_age_days').nullable();
    t.integer('max_size_mb').nullable();
    t.enu('scope', ['global', 'group']).notNullable().defaultTo('global');
    t.integer('group_id').nullable().references('id').inTable('groups').onDelete('SET NULL');
    t.string('mime_type_filter', 255).nullable();
    t.enu('action', ['delete', 'archive']).notNullable().defaultTo('delete');
    t.string('cron_expression', 64).notNullable().defaultTo('0 2 * * *');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.timestamp('last_run_at').nullable();
    t.integer('created_by').notNullable().references('id').inTable('users');
    t.timestamps(true, true);
  });

  // ─── system_settings ──────────────────────────────────────────────────────
  await knex.schema.createTable('system_settings', (t) => {
    t.string('key', 64).primary();
    t.text('value').notNullable();
    t.integer('updated_by').nullable().references('id').inTable('users');
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Varsayılan sistem ayarları
  await knex('system_settings').insert([
    { key: 'port', value: '8080' },
    { key: 'timezone', value: 'Europe/Istanbul' },
    { key: 'max_file_size_mb', value: '50' },
    { key: 'allowed_file_types', value: 'image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,text/plain' },
    { key: 'registration_open', value: 'false' },
    { key: 'app_name', value: 'AlbaChat' },
    { key: 'logo_url', value: '' },
    { key: 'announcement_sound', value: 'true' },
    { key: 'ws_timeout_seconds', value: '60' },
  ]);

  // ─── notifications ────────────────────────────────────────────────────────
  await knex.schema.createTable('notifications', (t) => {
    t.increments('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('type', 64).notNullable();
    t.integer('reference_id').nullable();
    t.string('reference_type', 64).nullable();
    t.boolean('is_read').notNullable().defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['user_id', 'is_read']);
  });

  // ─── audit_logs ───────────────────────────────────────────────────────────
  await knex.schema.createTable('audit_logs', (t) => {
    t.increments('id').primary();
    t.integer('actor_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.string('action', 128).notNullable();
    t.string('target_type', 64).nullable();
    t.integer('target_id').nullable();
    t.jsonb('detail_json').nullable();
    t.string('ip_address', 45).nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index(['actor_id']);
    t.index(['action', 'created_at']);
  });
}

export async function down(knex) {
  // Bağımlılıklar tersine sırada kaldırılır
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('system_settings');
  await knex.schema.dropTableIfExists('file_cleanup_policies');
  await knex.schema.dropTableIfExists('announcement_reads');
  await knex.schema.dropTableIfExists('announcement_groups');
  await knex.schema.dropTableIfExists('announcements');

  await knex.schema.alterTable('messages', (t) => {
    t.dropForeign(['file_id']);
  });

  await knex.schema.dropTableIfExists('files');
  await knex.schema.dropTableIfExists('message_reads');
  await knex.schema.dropTableIfExists('messages');
  await knex.schema.dropTableIfExists('group_members');
  await knex.schema.dropTableIfExists('groups');
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('users');
}
