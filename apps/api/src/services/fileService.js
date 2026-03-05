import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fileTypeFromBuffer } from 'file-type';
import { randomUUID } from 'crypto';
import path from 'path';
import { knex } from '../db/knex.js';
import { s3Client, BUCKET, transformUrl } from '../utils/minio.js';

// ─── Hata Sınıfları ────────────────────────────────────────────────────────

export class FileTooLargeError extends Error {
  constructor() { super('Dosya boyutu çok büyük.'); this.code = 'FILE_TOO_LARGE'; }
}
export class FileTypeNotAllowedError extends Error {
  constructor(mime) {
    super(`Bu dosya türü desteklenmiyor: ${mime}`);
    this.code = 'FILE_TYPE_NOT_ALLOWED';
  }
}
export class FileNotFoundError extends Error {
  constructor() { super('Dosya bulunamadı.'); this.code = 'NOT_FOUND'; }
}
export class FileForbiddenError extends Error {
  constructor() { super('Bu dosyaya erişim izniniz yok.'); this.code = 'FORBIDDEN'; }
}

// ─── Konfigürasyon ─────────────────────────────────────────────────────────

const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10) * 1024 * 1024;

const ALLOWED_TYPES = new Set(
  (
    process.env.ALLOWED_FILE_TYPES ||
    'image/jpeg,image/png,image/gif,image/webp,image/svg+xml,' +
    'application/pdf,text/plain,' +
    'video/mp4,video/webm,' +
    'audio/mpeg,audio/ogg,audio/wav,' +
    'application/zip,application/x-rar-compressed,' +
    'application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
    'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ).split(','),
);

// ─── Servis Fonksiyonları ──────────────────────────────────────────────────

/**
 * Dosyayı MinIO'ya yükle ve files tablosuna kaydet.
 * Magic bytes ile MIME type doğrulaması yapılır.
 */
export async function uploadFile({ buffer, originalName, mimeType, uploadedBy, groupId }) {
  if (buffer.length > MAX_SIZE) throw new FileTooLargeError();

  // Grup üyeliği kontrolü
  const member = await knex('group_members').where({ group_id: groupId, user_id: uploadedBy }).first();
  if (!member) throw new FileForbiddenError();

  // Magic bytes ile gerçek MIME type kontrolü
  const detected = await fileTypeFromBuffer(buffer);
  const effectiveMime = detected?.mime || mimeType;

  if (!ALLOWED_TYPES.has(effectiveMime)) throw new FileTypeNotAllowedError(effectiveMime);

  // Benzersiz storage path
  const ext = path.extname(originalName).toLowerCase() || '';
  const storagePath = `${groupId}/${randomUUID()}${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: storagePath,
      Body: buffer,
      ContentType: effectiveMime,
    }),
  );

  const [file] = await knex('files')
    .insert({
      original_name: originalName,
      mime_type: effectiveMime,
      size_bytes: buffer.length,
      storage_path: storagePath,
      storage_bucket: BUCKET,
      uploaded_by: uploadedBy,
      group_id: groupId,
    })
    .returning('*');

  return file;
}

export async function getFileUrl(fileId, requesterId) {
  const file = await knex('files').where({ id: fileId, is_deleted: false }).first();
  if (!file) throw new FileNotFoundError();

  // Grup üyeliği kontrolü: Orijinal grupta mı yoksa dosyanın iletildiği/paylaşıldığı bir grupta mı?
  const sharedInGroups = await knex('messages')
    .where({ file_id: fileId })
    .select('group_id');

  const groupIds = [file.group_id, ...sharedInGroups.map(m => m.group_id)];

  const member = await knex('group_members')
    .whereIn('group_id', groupIds)
    .where({ user_id: requesterId })
    .first();

  if (!member) throw new FileForbiddenError();

  const url = transformUrl(await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: file.storage_path,
      ResponseContentDisposition: `inline; filename="${encodeURIComponent(file.original_name)}"`,
    }),
    { expiresIn: 3600 },
  ));

  const downloadUrl = transformUrl(await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: file.storage_path,
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(file.original_name)}"`,
    }),
    { expiresIn: 3600 },
  ));

  return { url, downloadUrl, file };
}

/**
 * Dosyayı soft delete yap.
 * MinIO'dan gerçek silme Sprint 10'daki cleanup job'ı tarafından yapılır.
 */
export async function deleteFile(fileId, requesterId, requesterRole) {
  const file = await knex('files').where({ id: fileId, is_deleted: false }).first();
  if (!file) throw new FileNotFoundError();

  if (parseInt(file.uploaded_by, 10) !== parseInt(requesterId, 10) && requesterRole !== 'admin') {
    throw new FileForbiddenError();
  }

  await knex('files').where({ id: fileId }).update({ is_deleted: true, deleted_at: new Date() });

  return { id: fileId };
}
