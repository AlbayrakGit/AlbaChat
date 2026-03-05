import { knex } from '../db/knex.js';

// ─── Hata Sınıfları ────────────────────────────────────────────────────────

export class AnnouncementNotFoundError extends Error {
  constructor() { super('Duyuru bulunamadı.'); this.code = 'NOT_FOUND'; }
}
export class AnnouncementForbiddenError extends Error {
  constructor() { super('Bu işlem için yetkiniz yok.'); this.code = 'FORBIDDEN'; }
}

// ─── Yardımcı: tam duyuru objesi ──────────────────────────────────────────

function formatAnnouncement(row, groups = [], readCount = null) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    scope: row.scope,
    priority: row.priority,
    created_by: row.created_by,
    creator_username: row.creator_username,
    creator_display_name: row.creator_display_name,
    expires_at: row.expires_at,
    created_at: row.created_at,
    groups,
    read_count: readCount,
  };
}

// ─── Servis Fonksiyonları ──────────────────────────────────────────────────

/**
 * Yeni duyuru oluştur (Admin)
 * groupIds — scope=group ise hedef gruplar
 */
export async function createAnnouncement({
  title, content, scope = 'global', priority = 'normal',
  groupIds = [], expiresAt = null, createdBy,
}) {
  const [announcement] = await knex('announcements')
    .insert({
      title: title.trim(),
      content: content.trim(),
      scope,
      priority,
      created_by: createdBy,
      expires_at: expiresAt || null,
    })
    .returning('*');

  // Grup bazlı duyuru ise announcement_groups kaydet
  if (scope === 'group' && groupIds.length > 0) {
    await knex('announcement_groups').insert(
      groupIds.map((gid) => ({ announcement_id: announcement.id, group_id: gid })),
    );
  }

  // Oluşturan kullanıcı bilgisiyle getir
  const full = await knex('announcements as a')
    .join('users as u', 'u.id', 'a.created_by')
    .where('a.id', announcement.id)
    .select('a.*', 'u.username as creator_username', 'u.display_name as creator_display_name')
    .first();

  const groups = scope === 'group'
    ? await knex('announcement_groups as ag')
      .join('groups as g', 'g.id', 'ag.group_id')
      .where('ag.announcement_id', announcement.id)
      .select('g.id', 'g.name')
    : [];

  return formatAnnouncement(full, groups);
}

/**
 * Belirli kullanıcı için okunmamış (pending) duyurular
 * Global duyurular: expires_at geçmemiş, okunmamış
 * Grup duyuruları: kullanıcının üye olduğu gruplara ait, okunmamış
 */
export async function getPendingAnnouncements(userId) {
  const now = new Date();

  // Global okunmamış
  const globalRows = await knex('announcements as a')
    .join('users as u', 'u.id', 'a.created_by')
    .where('a.scope', 'global')
    .where(function () {
      this.whereNull('a.expires_at').orWhere('a.expires_at', '>', now);
    })
    .whereNotExists(
      knex('announcement_reads as ar')
        .where('ar.user_id', userId)
        .whereRaw('ar.announcement_id = a.id'),
    )
    .orderBy('a.priority', 'desc') // urgent önce
    .orderBy('a.created_at', 'asc')
    .select('a.*', 'u.username as creator_username', 'u.display_name as creator_display_name');

  // Grup bazlı okunmamış
  const groupRows = await knex('announcements as a')
    .join('users as u', 'u.id', 'a.created_by')
    .join('announcement_groups as ag', 'ag.announcement_id', 'a.id')
    .join('group_members as gm', function () {
      this.on('gm.group_id', '=', 'ag.group_id').andOnVal('gm.user_id', userId);
    })
    .where('a.scope', 'group')
    .where(function () {
      this.whereNull('a.expires_at').orWhere('a.expires_at', '>', now);
    })
    .whereNotExists(
      knex('announcement_reads as ar')
        .where('ar.user_id', userId)
        .whereRaw('ar.announcement_id = a.id'),
    )
    .orderBy('a.priority', 'desc')
    .orderBy('a.created_at', 'asc')
    .select('a.*', 'u.username as creator_username', 'u.display_name as creator_display_name');

  // urgent önce, sonra tarih sırası
  const all = [...globalRows, ...groupRows].sort((a, b) => {
    if (a.priority === b.priority) return new Date(a.created_at) - new Date(b.created_at);
    return a.priority === 'urgent' ? -1 : 1;
  });

  return all.map((r) => formatAnnouncement(r));
}

/**
 * Tüm duyurular arşivi — sayfalı
 */
export async function getAnnouncementList({ page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;

  const rows = await knex('announcements as a')
    .join('users as u', 'u.id', 'a.created_by')
    .orderBy('a.created_at', 'desc')
    .offset(offset)
    .limit(limit)
    .select('a.*', 'u.username as creator_username', 'u.display_name as creator_display_name');

  const [{ count }] = await knex('announcements').count('id as count');

  const items = await Promise.all(
    rows.map(async (row) => {
      const [{ cnt }] = await knex('announcement_reads')
        .where('announcement_id', row.id)
        .count('id as cnt');
      return formatAnnouncement(row, [], parseInt(cnt, 10));
    }),
  );

  return {
    announcements: items,
    pagination: {
      page, limit,
      total: parseInt(count, 10),
      totalPages: Math.ceil(parseInt(count, 10) / limit),
    },
  };
}

/**
 * Tek duyuru detayı
 */
export async function getAnnouncementById(id) {
  const row = await knex('announcements as a')
    .join('users as u', 'u.id', 'a.created_by')
    .where('a.id', id)
    .select('a.*', 'u.username as creator_username', 'u.display_name as creator_display_name')
    .first();

  if (!row) throw new AnnouncementNotFoundError();

  const groups = row.scope === 'group'
    ? await knex('announcement_groups as ag')
      .join('groups as g', 'g.id', 'ag.group_id')
      .where('ag.announcement_id', id)
      .select('g.id', 'g.name')
    : [];

  const [{ cnt }] = await knex('announcement_reads')
    .where('announcement_id', id)
    .count('id as cnt');

  return formatAnnouncement(row, groups, parseInt(cnt, 10));
}

/**
 * Duyuruyu okundu olarak işaretle
 */
export async function markAsRead(announcementId, userId) {
  const ann = await knex('announcements').where({ id: announcementId }).first();
  if (!ann) throw new AnnouncementNotFoundError();

  await knex('announcement_reads')
    .insert({ announcement_id: announcementId, user_id: userId, read_at: new Date() })
    .onConflict(['announcement_id', 'user_id'])
    .ignore();

  return { announcementId, userId };
}

/**
 * Duyuru okuma istatistikleri (Admin)
 * — kaç kişi okudu, kimler okumadı
 */
export async function getAnnouncementStats(announcementId) {
  const ann = await knex('announcements').where({ id: announcementId }).first();
  if (!ann) throw new AnnouncementNotFoundError();

  // Kaç kişi okudu
  const [{ readCount }] = await knex('announcement_reads')
    .where('announcement_id', announcementId)
    .count('id as readCount');

  // Okumayan aktif kullanıcılar
  let unreadUsersQuery = knex('users')
    .where('is_active', true)
    .whereNotExists(
      knex('announcement_reads as ar')
        .where('ar.announcement_id', announcementId)
        .whereRaw('ar.user_id = users.id'),
    )
    .select('id', 'username', 'display_name', 'is_online');

  // Grup bazlı ise sadece o grubun üyeleri
  if (ann.scope === 'group') {
    const groupIds = await knex('announcement_groups')
      .where('announcement_id', announcementId)
      .pluck('group_id');

    unreadUsersQuery = unreadUsersQuery.whereIn(
      'id',
      knex('group_members').whereIn('group_id', groupIds).select('user_id'),
    );
  }

  const unreadUsers = await unreadUsersQuery;

  return {
    announcement: { id: ann.id, title: ann.title },
    readCount: parseInt(readCount, 10),
    unreadCount: unreadUsers.length,
    unreadUsers,
  };
}

/**
 * Duyuruyu sil (Admin)
 * announcement_groups ve announcement_reads tabloları CASCADE ile otomatik silinir.
 * Bildirimler (notifications) polimorfik olduğu için manuel silinmesi gerekir.
 */
export async function deleteAnnouncement(id) {
  return await knex.transaction(async (trx) => {
    // 1. İlişkili bildirimleri temizle
    await trx('notifications')
      .where({ reference_id: id, reference_type: 'announcement' })
      .delete();

    // 2. Duyuruyu sil (CASCADE sayesinde announcement_groups ve announcement_reads otomatik silinir)
    const count = await trx('announcements').where({ id }).delete();

    if (!count) throw new AnnouncementNotFoundError();
    return { id };
  });
}
