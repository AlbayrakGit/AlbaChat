/**
 * Performans İndeksleri
 * Sık kullanılan sorgular için kompozit ve tekil index'ler.
 */

export async function up(knex) {
  // ─── messages ──────────────────────────────────────────────────────────────
  // Grup mesaj listesi: group_id + tarih sıralı (en sık kullanılan sorgu)
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_messages_group_created
    ON messages (group_id, created_at DESC)
    WHERE is_deleted = FALSE
  `);

  // İdempotency key araması
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_idempotency
    ON messages (idempotency_key)
    WHERE idempotency_key IS NOT NULL
  `);

  // Gönderen araması (profil sayfası, audit)
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_messages_sender
    ON messages (sender_id, created_at DESC)
    WHERE is_deleted = FALSE
  `);

  // ─── message_reads ─────────────────────────────────────────────────────────
  // Okundu bildirimi: tek bir mesajı kim okudu?
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reads_msg_user
    ON message_reads (message_id, user_id)
  `);

  // Kullanıcı bazlı: bu kullanıcı hangi mesajları okudu?
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_message_reads_user
    ON message_reads (user_id, read_at DESC)
  `);

  // ─── group_members ─────────────────────────────────────────────────────────
  // Kullanıcının üye olduğu grupları getir
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_group_members_user
    ON group_members (user_id)
  `);

  // Bir grubun üyelerini getir
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_group_members_group
    ON group_members (group_id)
  `);

  // ─── files ─────────────────────────────────────────────────────────────────
  // Grup dosya listesi
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_files_group
    ON files (group_id, created_at DESC)
    WHERE is_deleted = FALSE
  `);

  // Soft-deleted dosyalar — cron purge için
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_files_deleted_at
    ON files (deleted_at)
    WHERE is_deleted = TRUE AND storage_path IS NOT NULL
  `);

  // ─── announcements ─────────────────────────────────────────────────────────
  // Aktif duyurular listesi
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_announcements_created
    ON announcements (created_at DESC)
  `);

  // ─── announcement_reads ───────────────────────────────────────────────────
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_announcement_reads_user_ann
    ON announcement_reads (announcement_id, user_id)
  `);

  // ─── push_subscriptions ───────────────────────────────────────────────────
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
    ON push_subscriptions (user_id)
  `);

  // ─── audit_logs ────────────────────────────────────────────────────────────
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created
    ON audit_logs (actor_id, created_at DESC)
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created
    ON audit_logs (created_at DESC)
  `);

  // ─── users ─────────────────────────────────────────────────────────────────
  // Kullanıcı arama (username, display_name ILIKE)
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_users_username_lower
    ON users (lower(username))
  `);
}

export async function down(knex) {
  const indexes = [
    'idx_messages_group_created',
    'idx_messages_idempotency',
    'idx_messages_sender',
    'idx_message_reads_msg_user',
    'idx_message_reads_user',
    'idx_group_members_user',
    'idx_group_members_group',
    'idx_files_group',
    'idx_files_deleted_at',
    'idx_announcements_created',
    'idx_announcement_reads_user_ann',
    'idx_push_subscriptions_user',
    'idx_audit_logs_actor_created',
    'idx_audit_logs_created',
    'idx_users_username_lower',
  ];
  for (const idx of indexes) {
    await knex.raw(`DROP INDEX IF EXISTS ${idx}`);
  }
}
