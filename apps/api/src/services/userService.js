import { knex } from '../db/knex.js';
import { hashPassword } from './authService.js';

const PUBLIC_FIELDS = [
  'id', 'username', 'display_name', 'avatar_url',
  'is_online', 'last_seen', 'role', 'is_active',
  'email', 'timezone', 'created_at',
];

/**
 * Kullanıcı listesi — arama + sayfalama
 */
export async function listUsers({ search = '', page = 1, limit = 50, includeInactive = false } = {}) {
  const offset = (page - 1) * limit;

  let query = knex('users').select(PUBLIC_FIELDS);

  if (!includeInactive) {
    query = query.where({ is_active: true });
  }

  if (search) {
    query = query.where((builder) => {
      builder
        .whereILike('username', `%${search}%`)
        .orWhereILike('display_name', `%${search}%`)
        .orWhereILike('email', `%${search}%`);
    });
  }

  const [countRow] = await query.clone().clearSelect().count('id as count');
  const total = parseInt(countRow.count, 10);

  const users = await query.orderBy('display_name', 'asc').limit(limit).offset(offset);

  return {
    users,
    meta: { page, limit, total, has_more: offset + users.length < total },
  };
}

/**
 * Tek kullanıcı getir
 */
export async function getUserById(id) {
  const user = await knex('users').select(PUBLIC_FIELDS).where({ id }).first();
  if (!user) throw new UserNotFoundError();
  return user;
}

/**
 * Profil güncelle (kullanıcı kendi profilini güncelleyebilir)
 */
export async function updateUser(id, data, requesterId, requesterRole) {
  // Sadece kendi profilini veya admin
  if (id !== requesterId && requesterRole !== 'admin') {
    throw new ForbiddenError();
  }

  const allowed = ['display_name', 'avatar_url', 'timezone'];
  if (requesterRole === 'admin') {
    allowed.push('email', 'username');
  }

  const updates = {};
  for (const key of allowed) {
    if (data[key] !== undefined) updates[key] = data[key];
  }

  if (Object.keys(updates).length === 0) {
    throw new ValidationError('Güncellenecek alan bulunamadı.');
  }

  updates.updated_at = new Date();

  await knex('users').where({ id }).update(updates);
  return getUserById(id);
}

/**
 * Hesap aktif/pasif (Admin)
 */
export async function setUserStatus(id, isActive) {
  const user = await knex('users').where({ id }).first('id', 'role');
  if (!user) throw new UserNotFoundError();
  if (user.role === 'admin') throw new ForbiddenError('Admin hesabı devre dışı bırakılamaz.');

  await knex('users').where({ id }).update({ is_active: isActive, updated_at: new Date() });
  return getUserById(id);
}

/**
 * Şifre sıfırla (Admin)
 */
export async function resetPassword(id, newPassword) {
  const hash = await hashPassword(newPassword);
  await knex('users').where({ id }).update({ password_hash: hash, updated_at: new Date() });

  // Tüm refresh token'larını iptal et
  await knex('refresh_tokens').where({ user_id: id }).update({ revoked: true });
}

// ─── Hata Sınıfları ───────────────────────────────────────────────────────────

export class UserNotFoundError extends Error {
  constructor() { super('Kullanıcı bulunamadı.'); this.code = 'USER_NOT_FOUND'; }
}
export class ForbiddenError extends Error {
  constructor(msg = 'Bu işlem için yetkiniz yok.') { super(msg); this.code = 'FORBIDDEN'; }
}
export class ValidationError extends Error {
  constructor(msg) { super(msg); this.code = 'VALIDATION_ERROR'; }
}
