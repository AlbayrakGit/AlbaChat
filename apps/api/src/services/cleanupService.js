import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { knex } from '../db/knex.js';
import { s3Client } from '../utils/minio.js';

// Soft-deleted dosyaların gerçekten MinIO'dan silinmesi için grace period (saat)
const GRACE_HOURS = 24;

// ─── Depolama İstatistikleri ───────────────────────────────────────────────────

export async function getStorageStats() {
  const [[active], [deleted], byType, byGroup] = await Promise.all([
    knex('files').where('is_deleted', false)
      .sum('size_bytes as total_bytes').count('* as file_count'),
    knex('files').where('is_deleted', true)
      .sum('size_bytes as total_bytes').count('* as file_count'),
    knex('files').where('is_deleted', false)
      .select('mime_type')
      .sum('size_bytes as size_bytes')
      .count('* as file_count')
      .groupBy('mime_type')
      .orderBy('size_bytes', 'desc')
      .limit(10),
    knex('files as f')
      .join('groups as g', 'g.id', 'f.group_id')
      .where('f.is_deleted', false)
      .select('f.group_id', 'g.name as group_name')
      .sum('f.size_bytes as size_bytes')
      .count('f.id as file_count')
      .groupBy('f.group_id', 'g.name')
      .orderBy('size_bytes', 'desc')
      .limit(10),
  ]);

  return {
    active: {
      file_count: parseInt(active.file_count, 10) || 0,
      total_bytes: parseInt(active.total_bytes, 10) || 0,
    },
    deleted: {
      file_count: parseInt(deleted.file_count, 10) || 0,
      total_bytes: parseInt(deleted.total_bytes, 10) || 0,
    },
    by_type: byType.map((r) => ({
      mime_type: r.mime_type,
      size_bytes: parseInt(r.size_bytes, 10) || 0,
      file_count: parseInt(r.file_count, 10) || 0,
    })),
    by_group: byGroup.map((r) => ({
      group_id: r.group_id,
      group_name: r.group_name,
      size_bytes: parseInt(r.size_bytes, 10) || 0,
      file_count: parseInt(r.file_count, 10) || 0,
    })),
  };
}

// ─── Dosya Listesi (Admin) ─────────────────────────────────────────────────────

export async function listFiles({ page = 1, limit = 50, groupId, mimeType, showDeleted = false }) {
  const offset = (page - 1) * limit;

  const query = () =>
    knex('files as f')
      .join('users as u', 'u.id', 'f.uploaded_by')
      .join('groups as g', 'g.id', 'f.group_id')
      .modify((q) => {
        if (!showDeleted) q.where('f.is_deleted', false);
        if (groupId) q.where('f.group_id', groupId);
        if (mimeType) q.where('f.mime_type', 'like', `${mimeType}%`);
      });

  const [files, [{ count }]] = await Promise.all([
    query()
      .select(
        'f.id', 'f.original_name', 'f.mime_type', 'f.size_bytes',
        'f.group_id', 'f.is_deleted', 'f.deleted_at', 'f.created_at',
        'u.username as uploader_username', 'u.display_name as uploader_display_name',
        'g.name as group_name',
      )
      .orderBy('f.created_at', 'desc')
      .limit(limit)
      .offset(offset),
    query().count('f.id as count'),
  ]);

  return { files, total: parseInt(count, 10) || 0 };
}

// ─── Toplu Soft Delete ─────────────────────────────────────────────────────────

export async function bulkSoftDelete({ fileIds = [], groupId, mimeType, olderThanDays }) {
  const query = knex('files').where('is_deleted', false);

  if (fileIds.length > 0) {
    query.whereIn('id', fileIds);
  } else {
    if (groupId) query.where('group_id', groupId);
    if (mimeType) query.where('mime_type', 'like', `${mimeType}%`);
    if (olderThanDays) {
      const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
      query.where('created_at', '<', cutoff);
    }
  }

  const deleted = await query.update({ is_deleted: true, deleted_at: new Date() });
  return deleted;
}

// ─── Grace Period Dolmuş Dosyaları MinIO'dan Purge Et ─────────────────────────

export async function purgeExpiredFiles() {
  const cutoff = new Date(Date.now() - GRACE_HOURS * 60 * 60 * 1000);

  const files = await knex('files')
    .where('is_deleted', true)
    .where('deleted_at', '<', cutoff)
    .whereNotNull('storage_path')
    .select('id', 'storage_path', 'storage_bucket');

  let purged = 0;
  for (const file of files) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: file.storage_bucket, Key: file.storage_path }),
      );
      await knex('files').where({ id: file.id }).update({ storage_path: null });
      purged++;
    } catch (err) {
      console.error(`[Cleanup] MinIO silme hatası — file #${file.id}:`, err.message);
    }
  }
  return purged;
}

// ─── Tek Dosyayı Grace Period İçinde Geri Al ──────────────────────────────────

export async function restoreFile(fileId) {
  const file = await knex('files').where({ id: fileId, is_deleted: true }).first();
  if (!file) return null;

  // Grace period dolmuş ise restore edilemez (storage_path null = MinIO'dan silindi)
  if (!file.storage_path) return null;

  await knex('files').where({ id: fileId }).update({ is_deleted: false, deleted_at: null });
  return file;
}

// ─── Temizleme Politikası Çalıştır ────────────────────────────────────────────

export async function runPolicy(policyId) {
  const policy = await knex('file_cleanup_policies').where({ id: policyId, is_active: true }).first();
  if (!policy) return { matched: 0, deleted: 0, purged: 0 };

  const buildCondition = (q) => {
    if (policy.max_age_days) {
      const cutoff = new Date(Date.now() - policy.max_age_days * 24 * 60 * 60 * 1000);
      q.where('created_at', '<', cutoff);
    }
    if (policy.max_size_mb) {
      q.where('size_bytes', '>', policy.max_size_mb * 1024 * 1024);
    }
    if (policy.scope === 'group' && policy.group_id) {
      q.where('group_id', policy.group_id);
    }
    if (policy.mime_type_filter) {
      const types = policy.mime_type_filter.split(',').map((t) => t.trim()).filter(Boolean);
      if (types.length > 0) q.whereIn('mime_type', types);
    }
  };

  const [{ count: matchedCount }] = await knex('files')
    .where('is_deleted', false)
    .modify(buildCondition)
    .count('* as count');

  const deleted = await knex('files')
    .where('is_deleted', false)
    .modify(buildCondition)
    .update({ is_deleted: true, deleted_at: new Date() });

  await knex('file_cleanup_policies')
    .where({ id: policyId })
    .update({ last_run_at: new Date() });

  const purged = await purgeExpiredFiles();

  return { matched: parseInt(matchedCount, 10), deleted, purged };
}
