import { knex } from '../db/knex.js';

// ─── Hata Sınıfları ───────────────────────────────────────────────────────────

export class GroupNotFoundError extends Error {
  constructor() { super('Grup bulunamadı.'); this.code = 'GROUP_NOT_FOUND'; }
}
export class GroupForbiddenError extends Error {
  constructor(msg = 'Bu işlem için yetkiniz yok.') { super(msg); this.code = 'FORBIDDEN'; }
}
export class GroupArchivedError extends Error {
  constructor() { super('Arşivlenmiş gruba işlem yapılamaz.'); this.code = 'GROUP_ARCHIVED'; }
}
export class MemberAlreadyExistsError extends Error {
  constructor() { super('Kullanıcı zaten grup üyesi.'); this.code = 'MEMBER_EXISTS'; }
}
export class MemberNotFoundError extends Error {
  constructor() { super('Kullanıcı bu grubun üyesi değil.'); this.code = 'MEMBER_NOT_FOUND'; }
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

async function getMemberRole(groupId, userId) {
  const m = await knex('group_members').where({ group_id: groupId, user_id: userId }).first('role');
  return m?.role || null;
}

function canManageGroup(requesterRole, memberRole) {
  return requesterRole === 'admin' || memberRole === 'owner' || memberRole === 'admin';
}

// ─── Servis Fonksiyonları ─────────────────────────────────────────────────────

/**
 * Kullanıcının üye olduğu gruplar
 */
export async function listUserGroups(userId) {
  const rows = await knex('groups as g')
    .join('group_members as gm', 'g.id', 'gm.group_id')
    .where('gm.user_id', userId)
    .where('g.is_archived', false)
    .select(
      'g.*',
      'gm.role as my_role',
      knex.raw(`
        CASE 
          WHEN g.type = 'direct' THEN COALESCE(
            (
              SELECT COALESCE(u.display_name, u.username)
              FROM group_members m2
              JOIN users u ON m2.user_id = u.id
              WHERE m2.group_id = g.id AND m2.user_id != ?
              LIMIT 1
            ),
            (
              SELECT COALESCE(u.display_name, u.username)
              FROM users u WHERE u.id = ?
            )
          )
          ELSE g.name
        END as resolved_name
      `, [userId, userId]),
      knex.raw(`
        CASE 
          WHEN g.type = 'direct' THEN (
            SELECT m2.user_id
            FROM group_members m2
            WHERE m2.group_id = g.id AND m2.user_id != ?
            LIMIT 1
          )
          ELSE NULL
        END as other_user_id
      `, [userId]),
      knex.raw(`
        CASE 
          WHEN g.type = 'direct' THEN (
            SELECT u.is_online
            FROM group_members m2
            JOIN users u ON m2.user_id = u.id
            WHERE m2.group_id = g.id AND m2.user_id != ?
            LIMIT 1
          )
          ELSE NULL
        END as other_user_online
      `, [userId])
    );

  const groups = rows.map(r => {
    if (r.type === 'direct' && r.resolved_name) {
      r.name = r.resolved_name;
    }
    delete r.resolved_name;
    return r;
  }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return groups;
}

/**
 * Grup detayı — sadece üye ise erişebilir
 */
export async function getGroupById(groupId, requesterId, requesterRole) {
  const group = await knex('groups').where({ id: groupId }).first();
  if (!group) throw new GroupNotFoundError();

  if (requesterRole !== 'admin') {
    const memberRole = await getMemberRole(groupId, requesterId);
    if (!memberRole) throw new GroupForbiddenError('Bu gruba erişim yetkiniz yok.');
  }

  return group;
}

/**
 * Yeni grup oluştur (Admin)
 */
export async function createGroup({ name, description, type, department_code, createdBy }) {
  const [group] = await knex('groups')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      type: type || 'private',
      department_code: department_code?.trim() || null,
      created_by: createdBy,
    })
    .returning('*');

  // Oluşturanı owner olarak ekle
  await knex('group_members').insert({
    group_id: group.id,
    user_id: createdBy,
    role: 'owner',
    added_by: createdBy,
  });

  return group;
}

/**
 * Grup güncelle (Admin veya group admin)
 */
export async function updateGroup(groupId, data, requesterId, requesterRole) {
  const group = await knex('groups').where({ id: groupId }).first();
  if (!group) throw new GroupNotFoundError();
  if (group.is_archived) throw new GroupArchivedError();

  const memberRole = await getMemberRole(groupId, requesterId);
  if (!canManageGroup(requesterRole, memberRole)) throw new GroupForbiddenError();

  const allowed = ['name', 'description', 'department_code'];
  const updates = {};
  for (const key of allowed) {
    if (data[key] !== undefined) updates[key] = data[key];
  }

  if (Object.keys(updates).length === 0) return group;

  updates.updated_at = new Date();
  const [updated] = await knex('groups').where({ id: groupId }).update(updates).returning('*');
  return updated;
}

/**
 * Grubu arşivle (Admin)
 */
export async function archiveGroup(groupId, requesterId, requesterRole) {
  const group = await knex('groups').where({ id: groupId }).first();
  if (!group) throw new GroupNotFoundError();

  const memberRole = await getMemberRole(groupId, requesterId);
  if (!canManageGroup(requesterRole, memberRole)) throw new GroupForbiddenError();

  const [updated] = await knex('groups')
    .where({ id: groupId })
    .update({ is_archived: true, updated_at: new Date() })
    .returning('*');
  return updated;
}

/**
 * Grup üye listesi
 */
export async function listGroupMembers(groupId, requesterId, requesterRole) {
  const group = await knex('groups').where({ id: groupId }).first();
  if (!group) throw new GroupNotFoundError();

  if (requesterRole !== 'admin') {
    const memberRole = await getMemberRole(groupId, requesterId);
    if (!memberRole) throw new GroupForbiddenError();
  }

  return knex('group_members as gm')
    .join('users as u', 'u.id', 'gm.user_id')
    .where('gm.group_id', groupId)
    .select(
      'u.id', 'u.username', 'u.display_name', 'u.avatar_url', 'u.is_online', 'u.last_seen',
      'gm.role as member_role', 'gm.joined_at'
    )
    .orderBy('u.display_name', 'asc');
}

/**
 * Üye ekle (Admin veya group admin)
 */
export async function addGroupMember(groupId, userId, requesterId, requesterRole) {
  const group = await knex('groups').where({ id: groupId }).first();
  if (!group) throw new GroupNotFoundError();
  if (group.is_archived) throw new GroupArchivedError();

  const requesterMemberRole = await getMemberRole(groupId, requesterId);
  if (!canManageGroup(requesterRole, requesterMemberRole)) throw new GroupForbiddenError();

  const existing = await knex('group_members').where({ group_id: groupId, user_id: userId }).first();
  if (existing) throw new MemberAlreadyExistsError();

  await knex('group_members').insert({
    group_id: groupId,
    user_id: userId,
    role: 'member',
    added_by: requesterId,
  });
}

/**
 * Üye çıkar (Admin veya group admin)
 */
export async function removeGroupMember(groupId, userId, requesterId, requesterRole) {
  const group = await knex('groups').where({ id: groupId }).first();
  if (!group) throw new GroupNotFoundError();

  const requesterMemberRole = await getMemberRole(groupId, requesterId);
  if (!canManageGroup(requesterRole, requesterMemberRole)) throw new GroupForbiddenError();

  const target = await knex('group_members').where({ group_id: groupId, user_id: userId }).first();
  if (!target) throw new MemberNotFoundError();
  if (target.role === 'owner') throw new GroupForbiddenError('Grup sahibi çıkarılamaz.');

  await knex('group_members').where({ group_id: groupId, user_id: userId }).delete();
}

/**
 * Üye rolü güncelle (Admin)
 */
export async function updateMemberRole(groupId, userId, newRole, requesterRole) {
  if (requesterRole !== 'admin') throw new GroupForbiddenError();

  const valid = ['admin', 'member'];
  if (!valid.includes(newRole)) {
    throw new Error('Geçersiz rol. admin veya member olmalı.');
  }

  const member = await knex('group_members').where({ group_id: groupId, user_id: userId }).first();
  if (!member) throw new MemberNotFoundError();
  if (member.role === 'owner') throw new GroupForbiddenError('Sahibin rolü değiştirilemez.');

  await knex('group_members').where({ group_id: groupId, user_id: userId }).update({ role: newRole });
}

/**
 * 1-1 direkt konuşma — yoksa oluştur, varsa döndür
 */
export async function getOrCreateDirectGroup(userA, userB) {
  // Mevcut direct grubu bul
  const existing = await knex('groups as g')
    .join('group_members as m1', (join) => join.on('g.id', 'm1.group_id').andOn(knex.raw('m1.user_id = ?', [userA])))
    .join('group_members as m2', (join) => join.on('g.id', 'm2.group_id').andOn(knex.raw('m2.user_id = ?', [userB])))
    .where('g.type', 'direct')
    .select(
      'g.*',
      knex.raw(`
        COALESCE(
          (SELECT COALESCE(display_name, username) FROM users WHERE id = ?),
          'direct'
        ) as resolved_name
      `, [userB])
    )
    .first();

  if (existing) {
    if (existing.resolved_name) existing.name = existing.resolved_name;
    delete existing.resolved_name;
    return existing;
  }

  // Yeni oluştur
  const [group] = await knex('groups')
    .insert({ name: 'direct', type: 'direct', created_by: userA })
    .returning('*');

  await knex('group_members').insert([
    { group_id: group.id, user_id: userA, role: 'member', added_by: userA },
    { group_id: group.id, user_id: userB, role: 'member', added_by: userA },
  ]);

  const targetUser = await knex('users').where({ id: userB }).first();
  if (targetUser) {
    group.name = targetUser.display_name || targetUser.username || 'direct';
  }

  return group;
}
